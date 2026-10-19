import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import activate, { __testOnlyResetProcessState } from "../extensions/loops/goal.js";
import { assessSuspiciousObjective } from "../extensions/faulty-objective-recovery.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, tmpCwd, seedState, tick } from "./harness/mock-pi.js";

// Visible screenshot lead and status vocabulary; no external repair is run.
const objective = "Clear the 4 repos flagged by `dracon-sync repos` so the fleet attention list empties: (1) dracon-utilities (STALLED, 19 ahead, PUSH FAIL 4h, push-stuck 5 failures); use sanctioned repairs only and park external failures with evidence.";
afterEach(() => {
  __testOnlyResetProcessState();
  fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ aggressiveMode: false }));
});

test("clear-repos imperative with failure counts is actionable; explicit report tails remain guarded", () => {
  assert.deepEqual(assessSuspiciousObjective(objective).reasons, []);
  assert.deepEqual(assessSuspiciousObjective(`Safely ${objective}`).reasons, []);
  for (const tail of [" Evidence: all repairs passed.", " Reviewer: approved.", " Focused tests: 19 pass."]) {
    assert.ok(assessSuspiciousObjective(objective + tail).reasons.includes("verification-fragment"));
  }
  assert.equal(assessSuspiciousObjective("5 failures; ran 19 tests").suspicious, true);
});

test("interviewed auto-accepted clear-repos draft activates without synthetic repair work", async () => {
  const cwd = tmpCwd();
  seedState(cwd, {});
  fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ aggressiveMode: false, autoAcceptDrafts: true }));
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: "clear-repos-draft" } });
  try {
    await pi.fire("session_start", { reason: "startup" }, ctx);
    await pi.command("goal", "", ctx);
    await pi.fire("message_start", { message: { role: "user", content: "draft seed" } }, ctx);
    await pi.fire("message_start", { message: { role: "user", content: "All four flagged repos; sanctioned repairs only; park external failures with evidence." } }, ctx);
    const result = await pi.runTool("propose_goal_draft", {
      objective,
      verificationContract: "The four selected repos have clear attention rows or a named external blocker with supporting evidence; no unauthorized repair is run.",
    }, ctx) as { content: Array<{ text: string }> };
    await tick(80);
    const saved = readState(cwd);
    assert.equal(saved.goal?.status, "active", JSON.stringify(result));
    assert.equal(saved.goal?.objective, objective);
    assert.equal(saved.list?.length ?? 0, 0);
    assert.doesNotMatch(fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8"), /"faulty_objective_repair_queued"|"faulty_objective_user_seed_trusted"/);
    assert.doesNotMatch(result.content.map(part => part.text).join("\n"), /confirmed but paused|suspicious objective/i);
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

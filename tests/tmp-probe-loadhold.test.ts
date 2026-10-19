// TEMP PROBE — not a committed test
import { test } from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, { __testOnlyResetOwnerSession, __testOnlyResetStaleFlag } from "../extensions/loops/goal.js";
import { makeMockCtx, MockPi, seedGoal, seedState, staleError, tick, tmpCwd } from "./harness/mock-pi.js";
import { readState } from "../extensions/goal-loop-core.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;

test("probe: stale resume_goal journal + durable hold", async () => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({}));
  const cwd = tmpCwd();
  seedState(cwd, {
    goal: seedGoal({
      objective: "probe objective — done when pinned",
      status: "paused",
      pauseKind: "blocked",
      pauseReason: "auditor disapproved — fix the gap",
    }),
  });
  const pi = new MockPi();
  activate(pi.api);
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `probe-${Date.now()}` } });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick(120);

  const before = readState(cwd);
  console.log("PROBE loadHoldAt after boot:", before.loadHoldAt);
  console.log("PROBE goal status after boot:", before.goal?.status);

  pi.sessionNameError = staleError();
  const result = await pi.runTool("resume_goal", { reason: "user said go" }, ctx) as { content: Array<{ text: string }> };
  console.log("PROBE tool reply:", result.content[0]!.text);

  const after = readState(cwd);
  console.log("PROBE durable loadHoldAt after refused resume:", after.loadHoldAt);
  console.log("PROBE durable goal status:", after.goal?.status);

  const lines = fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8").split("\n").filter(Boolean);
  const holds = lines.map((l) => JSON.parse(l)).filter((e) => String(e.type).includes("load_hold"));
  console.log("PROBE load_hold ledger rows:", JSON.stringify(holds.map((e) => ({ t: e.type, v: e.value }))));

  fs.rmSync(cwd, { recursive: true, force: true });
});

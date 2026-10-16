import assert from "node:assert/strict";
import fs from "node:fs";
import { test, beforeEach, afterEach } from "node:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import activate, { __testOnlyLoadState, __testOnlyRegisterAgentTools, __testOnlyRememberCtx, __testOnlyResetOwnerSession, __testOnlyResetStaleFlag, __testOnlyResetTerminalFlags } from "../extensions/loops/goal.js";
import { readState, LONG_RUNNING_JUDGMENT_POLICY } from "../extensions/goal-loop-core.js";
import { state } from "../extensions/goal-state.js";
import { loopPrompt } from "../extensions/goal-loop.js";
import { buildGoalAuditorPrompt } from "../extensions/goal-loop-auditor.js";
import { respecIncrementAuditGoal } from "../extensions/respec-builder-audit.js";
import { createRespecBuilder, adoptRespecRequirements, planRespecIncrement, claimRespecTask, beginRespecAudit } from "../extensions/respec-builder.js";
import { judgmentMatchesTarget, admitSolutionJudgment, type SolutionJudgmentInput } from "../extensions/durable-solution.js";
import { resumeSettlingCompletionAudit } from "../extensions/loops/goal-auditor-hooks.js";
import { MockPi, makeMockCtx, seedGoal, seedLoop, seedState, tmpCwd } from "./harness/mock-pi.js";

function reset(): void {
  __testOnlyResetOwnerSession(); __testOnlyResetStaleFlag(); __testOnlyResetTerminalFlags();
}
beforeEach(() => { reset(); fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, "{}"); });
afterEach(reset);

const inline: SolutionJudgmentInput = { choice: "inline", reason: "Reproduced loss of the blocker across state restore", durableFix: "Persist the typed decision with the owning revision", evidence: "repro: restored fixture loses followUp before the fix" };
const deferred: SolutionJudgmentInput = { choice: "deferred", reason: "Destructive migration is blocked by missing production permission", durableFix: "Replace the legacy storage after the migration is authorized", evidence: "permission preflight returns denied; existing storage remains usable", durableBlocked: true,
  blocker: { kind: "external-blocked", evidence: "production migration requires an owner-granted permission; local implementation is not blocked" },
  followUp: "When production permission is granted, run the migration and independently verify read/write round trips",
  workaround: { action: "Keep the read-only compatibility adapter", safety: "Do not write or migrate production records", rollback: "Remove the adapter flag to restore the previous read path", verification: "Run the adapter fixture test and assert zero writes and readable old records" } };

function harness(mode: "goal" | "list" | "loop" | "project") {
  const cwd = tmpCwd();
  const builder = adoptRespecRequirements(createRespecBuilder("durable storage"), [{ id: "R1", text: "round-trip storage", acceptance: "inspect the actual round trip" }]);
  seedState(cwd, mode === "goal" || mode === "list"
    ? { goal: seedGoal({ id: "judgment-owner", status: "active", policy: mode, revision: 4, objective: "Correct storage durably", verificationContract: "Inspect the actual round trip", autoContinue: false }) }
    : { loop: seedLoop({ active: true, target: "Correct storage durably", ...(mode === "project" ? { builder } : {}) }) });
  __testOnlyLoadState(cwd);
  const pi = new MockPi(); activate(pi.api); __testOnlyRegisterAgentTools(pi.api);
  const ctx = makeMockCtx(cwd); __testOnlyRememberCtx(ctx as unknown as ExtensionContext);
  return { cwd, pi, ctx };
}
function judgment(cwd: string) { const saved = readState(cwd); return saved.goal?.durableSolution ?? saved.loop?.durableSolution; }

for (const mode of ["goal", "list", "loop", "project"] as const) {
  test(`${mode}: supported durable-fix admission records evidence, not completion`, async () => {
    const { cwd, pi, ctx } = harness(mode);
    const before = readState(cwd);
    const result = await pi.runTool("record_goal_judgment", inline, ctx);
    assert.match(result.content[0]!.text, /Recorded durable-vs-defer judgment: inline/);
    const decision = judgment(cwd)!;
    assert.equal(decision.authority, "executor-assertion");
    assert.equal(decision.target.mode, mode);
    assert.equal(decision.evidence, inline.evidence);
    assert.equal(decision.durableFix, inline.durableFix);
    const after = readState(cwd);
    assert.equal(after.goal?.status, before.goal?.status);
    assert.equal(after.loop?.builder?.phase, before.loop?.builder?.phase);
    assert.equal(after.goal?.pendingCompletion, undefined);
    assert.equal(after.loop?.builder?.audit, undefined);
  });

  test(`${mode}: blocked safe/reversible/testable workaround and follow-up survive actual session restore`, async () => {
    const { cwd, pi, ctx } = harness(mode);
    const before = readState(cwd);
    const result = await pi.runTool("record_goal_judgment", deferred, ctx);
    assert.match(result.content[0]!.text, /Recorded durable-vs-defer judgment: deferred/);
    const saved = judgment(cwd)!;
    assert.equal(saved.followUp, deferred.followUp);
    assert.deepEqual(saved.workaround, deferred.workaround);
    assert.equal(saved.blocker!.kind, "external-blocked");
    // Real load hook applies consent/hold policy, not an invented replay marker.
    await pi.fire("session_start", { reason: "reload" }, ctx);
    const restored = judgment(cwd)!;
    assert.deepEqual(restored, saved);
    const after = readState(cwd);
    assert.equal(after.goal?.objective, before.goal?.objective);
    assert.equal(after.goal?.verificationContract, before.goal?.verificationContract);
    assert.equal(after.loop?.target, before.loop?.target);
    assert.deepEqual(after.loop?.builder?.requirements, before.loop?.builder?.requirements);
    assert.notEqual(after.goal?.status, "complete");
    assert.notEqual(after.loop?.builder?.phase, "complete");
    assert.equal(after.goal?.pendingCompletion, undefined);
  });
}

for (const bad of [
  { ...inline, evidence: undefined },
  { ...deferred, durableBlocked: false },
  { ...deferred, blocker: undefined },
  { ...deferred, workaround: { ...deferred.workaround!, rollback: "" } },
  { ...deferred, workaround: { ...deferred.workaround!, safety: "" } },
  { ...deferred, workaround: { ...deferred.workaround!, verification: "" } },
]) {
  test(`unsupported judgment is refused without a state mutation: evidence=${!!bad.evidence}, blocked=${bad.durableBlocked}, blocker=${!!bad.blocker}, rollback=${!!bad.workaround?.rollback}, safety=${!!bad.workaround?.safety}, verification=${!!bad.workaround?.verification}`, async () => {
    const { cwd, pi, ctx } = harness("goal");
    const before = readState(cwd);
    const result = await pi.runTool("record_goal_judgment", bad, ctx);
    assert.equal(result.isError, true);
    assert.deepEqual(readState(cwd), before);
    assert.equal(judgment(cwd), undefined);
  });
}

test("judgment is target/revision-bound and a changed contract cannot reuse it as current", () => {
  const target = { mode: "goal" as const, id: "owner", revision: 4 };
  const accepted = admitSolutionJudgment(inline, target, "2026-10-16T13:30:00.000Z");
  assert.equal(accepted.ok, true);
  assert.equal(judgmentMatchesTarget(accepted.judgment, target), true);
  assert.equal(judgmentMatchesTarget(accepted.judgment, { ...target, revision: 5 }), false);
  assert.equal(judgmentMatchesTarget(accepted.judgment, { ...target, id: "other" }), false);
});

for (const kind of ["installation", "journal-marker", "runtime-observation"] as const) {
  test(`${kind} cannot prove successful execution even without open tasks or after synthetic markers`, async () => {
    const { cwd, pi, ctx } = harness("goal");
    fs.appendFileSync(`${cwd}/.pi-glla/active.jsonl`, JSON.stringify({ at: new Date().toISOString(), type: "fake_runtime_verified", value: { loaded: true, execution: "successful" } }) + "\n");
    const result = await pi.runTool("complete_goal", { completionSummary: "Outcome: installation done", outcomeClaims: [{ required: "executed", kind, evidence: "metadata version matches; executor wrote a successful marker" }] }, ctx);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /not proof|does not establish/);
    assert.match(result.content[0]!.text, /No audit was dispatched/);
    assert.equal(readState(cwd).goal!.status, "active");
    assert.equal(readState(cwd).goal!.pendingCompletion, undefined);
  });
}

test("shared continuation and both auditor paths require independent evidence, not filled fields", async () => {
  const { cwd, pi, ctx } = harness("project");
  await pi.runTool("record_goal_judgment", deferred, ctx);
  const loop = readState(cwd).loop!;
  const continuation = loopPrompt(loop, "", "", "");
  assert.match(continuation, /DURABLE SOLUTION AND EVIDENCE/);
  assert.match(continuation, /executor assertion/);
  assert.ok(continuation.includes(deferred.followUp!));
  const building = planRespecIncrement(loop.builder!, [{ id: "T1", text: "round trip", requirementIds: ["R1"] }]);
  const auditing = beginRespecAudit(claimRespecTask(building, "T1"), "attempt", "adapter works");
  const projectGoal = respecIncrementAuditGoal(auditing, loop.startedAt, "2026-10-16T13:30:00Z", loop.durableSolution);
  const projectAudit = buildGoalAuditorPrompt(projectGoal, "done", "tests pass");
  assert.match(projectAudit, /independently verify its blocker, safety, rollback and checks/);
  assert.match(projectAudit, /installation metadata, executor-written journal markers/);
  assert.ok(projectAudit.includes(deferred.followUp!));
  assert.match(LONG_RUNNING_JUDGMENT_POLICY, /Recording this permits bounded work, not completion/);
  assert.equal(state.loop!.builder!.phase, "planning");
});

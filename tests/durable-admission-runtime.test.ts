import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import activate, { __testOnlyResetProcessState } from "../extensions/loops/goal.js";
import { appendStateSnapshot, archivedGoalPath, goalStateTransactionPath, readState, writeQueueItemFile } from "../extensions/goal-loop-core.js";
import { HELD_ON_RESTORE } from "../extensions/goal-loop-forever.js";
import { replaceState, state } from "../extensions/goal-state.js";
import { MockPi, makeMockCtx, seedGoal, seedLoop, seedState, tmpCwd } from "./harness/mock-pi.js";

afterEach(() => __testOnlyResetProcessState());

for (const storedClaim of [false, true]) {
  test(`registered resume refuses a real transaction write failure and reloads for retry (stored claim=${storedClaim})`, async () => {
    const cwd = tmpCwd();
    const pendingCompletion = storedClaim ? {
      completionSummary: "Outcome: repaired. Changed: gate. Evidence: regression. Tests: passed. Unresolved: none. Next: none.",
      verificationSummary: "regression passes", phase: "parked", claimedAt: new Date().toISOString(),
    } : undefined;
    seedState(cwd, { goal: seedGoal({ id: "resume-refusal", status: "paused", objective: "Implement durable admission", pauseKind: "decision", pauseReason: "needs approval", pendingCompletion }) });
    const pi = new MockPi(); activate(pi.api);
    const ctx = makeMockCtx(cwd, { sessionManager: { name: "resume-refusal" } });
    await pi.fire("session_start", { reason: "startup" }, ctx);
    const obstacle = goalStateTransactionPath(cwd);
    fs.mkdirSync(obstacle);
    const result = await pi.runTool("resume_goal", { reason: "approval supplied" }, ctx);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /Resume could not be saved/);
    const saved = readState(cwd);
    assert.equal(saved.goal?.status, "paused");
    assert.equal(state.goal?.status, "paused");
    assert.equal(!!saved.goal?.pendingCompletion, storedClaim);
    assert.doesNotMatch(fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8"), /"goal_resumed"|"audit_started"/);
    assert.ok(!ctx.ui.notifies.some(notice => /Resuming the stored completion claim|Resumed goal/.test(notice.message)));
    fs.rmdirSync(obstacle);
    if (storedClaim) {
      // An independent explicit supervisor freeze keeps startup from doing
      // its normally permitted stored-claim retry after storage is repaired.
      replaceState({ ...state, supervisorPausedAt: Date.now() });
      assert.equal(appendStateSnapshot(cwd, state), true);
    }
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
    __testOnlyResetProcessState();
    const next = new MockPi(); activate(next.api);
    const nextCtx = makeMockCtx(cwd, { sessionManager: { name: "resume-reload" } });
    try {
      await next.fire("session_start", { reason: "startup" }, nextCtx);
      assert.equal(readState(cwd).goal?.status, "paused", "restart preserves the refused pause");
      // The no-claim case proves a real durable retry without launching a
      // provider-backed auditor in this hermetic fixture.
      if (!storedClaim) {
        const retried = await next.runTool("resume_goal", { reason: "storage repaired" }, nextCtx);
        assert.notEqual(retried.isError, true);
        assert.equal(readState(cwd).goal?.status, "active");
        assert.match(fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8"), /"goal_resumed"/);
      }
    } finally { await next.fire("session_shutdown", { reason: "test-end" }, nextCtx); }
  });
}

test("registered carryover refuses final journal failure after predecessor archival, then reloads and retries", async () => {
  const cwd = tmpCwd();
  const predecessorId = "carryover-predecessor";
  const item = { id: "carryover-queued", objective: "Implement the next task", addedAt: new Date().toISOString() };
  seedState(cwd, {
    goal: seedGoal({ id: predecessorId, status: "paused", objective: "Implement the previous task" }),
    list: [item], loop: seedLoop({ active: false, stopReason: HELD_ON_RESTORE, target: "Improve the fixture" }),
  });
  fs.writeFileSync(path.join(cwd, ".pi-glla", "settings.json"), JSON.stringify({ carryover: "clear" }));
  assert.equal(writeQueueItemFile(cwd, item).wrote, true);
  const pi = new MockPi(); activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: "carryover-refusal" } });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  const ledger = path.join(cwd, ".pi-glla", "active.jsonl");
  const backup = `${ledger}.saved`;
  const archive = archivedGoalPath(cwd, predecessorId);
  let faulted = false;
  const setStatus = ctx.ui.setStatus.bind(ctx.ui);
  ctx.ui.setStatus = (key, text) => {
    setStatus(key, text);
    // Repaint follows a real persistence commit. Introduce an actual
    // filesystem refusal only AFTER the predecessor's terminal snapshot.
    if (!faulted && state.goal?.id === predecessorId && state.goal.status === "aborted" && fs.existsSync(archive)) {
      const committed = fs.readFileSync(ledger, "utf8").trim().split("\n").map(line => JSON.parse(line));
      if (!committed.some(entry => entry.type === "state" && entry.value?.goal?.id === predecessorId && entry.value.goal.status === "aborted")) return;
      faulted = true;
      fs.renameSync(ledger, backup);
      fs.mkdirSync(ledger);
    }
  };
  try {
    await pi.command("goal", "start Implement replacement work. Done when: regression passes", ctx);
    assert.equal(faulted, true, "failure injected after the real archive commit");
    assert.ok(ctx.ui.notifies.some(notice => /Carryover resolution could not be saved/.test(notice.message)));
    assert.notEqual(state.goal?.objective, "Implement replacement work");
  } finally {
    if (faulted) { fs.rmdirSync(ledger); fs.renameSync(backup, ledger); }
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
  const archiveBefore = fs.readFileSync(archive, "utf8");
  const recovered = readState(cwd);
  assert.notEqual(recovered.goal?.status, "active");
  assert.equal(recovered.list?.[0]?.id, item.id, "journal still owns the refused clear");
  assert.equal(recovered.loop?.stopReason, HELD_ON_RESTORE);
  assert.doesNotMatch(fs.readFileSync(ledger, "utf8"), /"carryover_resolved"/);
  __testOnlyResetProcessState();
  const next = new MockPi(); activate(next.api);
  const nextCtx = makeMockCtx(cwd, { sessionManager: { name: "carryover-reload" } });
  try {
    await next.fire("session_start", { reason: "startup" }, nextCtx);
    assert.notEqual(readState(cwd).goal?.id, predecessorId, "committed predecessor is not resurrected");
    await next.command("goal", "start Implement replacement work. Done when: regression passes", nextCtx);
    const retried = readState(cwd);
    assert.equal(retried.goal?.status, "active");
    assert.match(retried.goal?.objective ?? "", /Implement replacement work/);
    assert.equal(retried.list?.length, 0);
    assert.equal(retried.loop?.active, false);
    assert.notEqual(retried.loop?.stopReason, HELD_ON_RESTORE, "retry dismisses the held loop");
    assert.equal(fs.readFileSync(archive, "utf8"), archiveBefore);
  } finally { await next.fire("session_shutdown", { reason: "test-end" }, nextCtx); }
});

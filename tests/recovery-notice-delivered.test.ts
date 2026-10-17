// v0.39.38: the recovery-notice delivered stamp must only be claimed when it
// lands. sendContinuation used to clear autoResumedAt via updateGoal and then
// ledger recovery_notice_delivered unconditionally, so a failed persist left
// disk still arming the stamp while the ledger claimed delivery — the next
// restart re-injected the stale "YOU WERE RECOVERED" directive (and every
// turn went full via needsFullContinuation) with a clean ledger conscience.
//
// The fix gates the delivered row on updateGoal's boolean; on failure it
// ledgers recovery_notice_clear_persist_failed and notifies instead. The
// notice itself WAS in the accepted payload, so the live RAM clear stands —
// re-arming would duplicate a delivered notice every turn.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
} from "../extensions/loops/goal.js";
import { sendContinuation, resetContinuationDispatchState } from "../extensions/goal-continuation.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tmpCwd, tick, type MockCtx } from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
const pi = new MockPi();
activate(pi.api);

function ledgerText(cwd: string): string {
  try {
    return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8");
  } catch {
    return "";
  }
}

afterEach(() => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  pi.sent.length = 0;
});

async function bootWithRecoveredGoal(cwd: string): Promise<{ ctx: MockCtx; goalId: string }> {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ autoResume: true, aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  resetContinuationDispatchState(cwd);
  const goalId = `recovery-notice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  seedState(cwd, {
    goal: seedGoal({
      id: goalId,
      status: "active",
      policy: "goal",
      autoResumedAt: new Date(Date.now() - 60_000).toISOString(),
      autoResumedEvent: "heartbeat recovery for the regression test",
    }),
  });
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `recovery-notice-${Date.now()}-${Math.random()}` } });
  await pi.fire("session_start", { reason: "reload" }, ctx);
  await tick(150);
  return { ctx, goalId };
}

test("v0.39.38 a delivered recovery notice stamps durable delivery", async () => {
  const cwd = tmpCwd();
  const { ctx, goalId } = await bootWithRecoveredGoal(cwd);
  try {
    const sendsBefore = pi.sent.length;
    sendContinuation(goalId);
    await tick(300);
    console.log("DBG ledger tail:", JSON.stringify(ledgerText(cwd).trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l).type; } catch { return "?"; } }).slice(-10)));
    assert.ok(pi.sent.length > sendsBefore, "the continuation was actually sent");
    const sent = pi.sent.slice(sendsBefore).map((s) => s.message.content ?? "").join("\n");
    assert.ok(sent.includes("RECOVERY NOTICE"), "the sent turn carried the recovery notice");
    const ledger = ledgerText(cwd);
    assert.ok(ledger.includes("recovery_notice_delivered"), "durable delivery is ledgered on success");
    assert.equal(readState(cwd).goal?.autoResumedAt, undefined, "the disk stamp is cleared");
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

test("v0.39.38 an unpersistable delivered stamp is reported, not claimed", async () => {
  const cwd = tmpCwd();
  const { ctx, goalId } = await bootWithRecoveredGoal(cwd);
  try {
    // Break ONLY the goal markdown projection: goalMarkdownLanded then
    // fails, so updateGoal returns false while the dispatch sidecar and the
    // journal keep working — the turn still sends and the stamp path runs.
    const goalMd = path.join(cwd, ".pi-glla", "goals", `${goalId}.md`);
    fs.rmSync(goalMd, { force: true });
    fs.mkdirSync(goalMd, { recursive: true });
    const sendsBefore = pi.sent.length;
    sendContinuation(goalId);
    await tick(300);
    console.log("DBG ledger tail:", JSON.stringify(ledgerText(cwd).trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l).type; } catch { return "?"; } }).slice(-10)));
    assert.ok(pi.sent.length > sendsBefore, "the continuation was actually sent");
    const ledger = ledgerText(cwd);
    assert.ok(!ledger.includes("recovery_notice_delivered"), "no durable-delivery claim for an unpersisted stamp");
    assert.ok(ledger.includes("recovery_notice_clear_persist_failed"), "the gap is ledgered instead");
    assert.ok(
      ctx.ui.matching("delivered stamp could not be persisted").length >= 1,
      "the operator is told a restart would re-inject the stale notice",
    );
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

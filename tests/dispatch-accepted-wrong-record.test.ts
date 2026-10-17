// pi-goal-list-loop-audit — v0.39.37
// tests/dispatch-accepted-wrong-record.test.ts
//
// Audit finding: dispatchAccepted returns success on record mismatch,
// conflating sync-ack clears with genuine wrong-record races and ledgering
// sends that never proved delivery. The fix: a pending === null + same id
// match is a real sync-ack (success); a pending === null + different id is
// a wrong-record race (fail closed and ledger the diagnostic); a pending
// holding a different record is a wrong-record race too.
//
// These tests exercise the predicate directly so the unit-level contract
// stays visible even when the integration surface evolves.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
} from "../extensions/loops/goal.js";
import {
  clearContinuationStartWatchdog,
  dispatchAccepted,
  resetContinuationDispatchState,
  setPendingContinuationDispatchRef,
} from "../extensions/goal-continuation.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tick, tmpCwd, type MockCtx } from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
const pi = new MockPi();
activate(pi.api);

function ledger(cwd: string): string {
  try { return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8"); }
  catch { return ""; }
}

interface StubRecord {
  id: string; sentAt: number; generation: number; kind: "goal"; goalId: string; marker: string; ownerSessionId: string;
  version: 1; phase: "prepared"; resync: boolean;
}

function buildRecord(id: string, goalId: string, sentAt: number): StubRecord {
  return { id, sentAt, generation: 1, kind: "goal", goalId, marker: "wrong-record-test", ownerSessionId: "main", version: 1, phase: "prepared", resync: false };
}

async function boot(cwd: string): Promise<{ pi: MockPi; ctx: MockCtx; goalId: string }> {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  resetContinuationDispatchState(cwd);
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ autoResume: true, aggressiveMode: false }));
  const goalId = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `wrong-record-${Date.now()}-${Math.random()}` } });
  // Seed the active goal BEFORE session_start so the dispatchAccept
  // predicate's stale-goal check has a real, active goal identity.
  seedState(cwd, { goal: seedGoal({ id: goalId, status: "active", policy: "goal" }) });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick(80);
  assert.equal(readState(cwd).goal?.status, "active", "the goal is auto-resumed into active status");
  assert.equal(readState(cwd).goal?.id, goalId, "the active goal is in state");
  // session_start may clear the dispatch ref; clear it once so the
  // per-test setup drives the wrong-record scenario deterministically.
  clearContinuationStartWatchdog();
  return { pi, ctx, goalId };
}

afterEach(() => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ autoResume: false, aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
});


test("v0.39.37: pending holds a different record — wrong-record race fails closed", async () => {
  const cwd = tmpCwd();
  const { pi, ctx, goalId } = await boot(cwd);
  try {
    const original = buildRecord("dispatch-original", goalId, Date.now());
    setPendingContinuationDispatchRef(original);
    const replacement = buildRecord("dispatch-replacement", goalId, Date.now() + 1);
    setPendingContinuationDispatchRef(replacement);

    const accepted = dispatchAccepted(ctx as never, original as never);
    assert.equal(accepted, false, "the wrong-record accept must fail closed");
    assert.match(ledger(cwd), /continuation_dispatch_wrong_record/);
    // The wrong-record race must NOT have written an acceptance for the
    // ORIGINAL record id (it is the call target). A real session_start
    // acceptance is allowed to show up but only for its own id.
    assert.doesNotMatch(ledger(cwd), /continuation_dispatch_accepted[^}]*"id":"dispatch-original"/);
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

test("v0.39.37: pending===null + matching id is the legitimate sync-ack and still returns true", async () => {
  const cwd = tmpCwd();
  const { pi, ctx, goalId } = await boot(cwd);
  try {
    const live = buildRecord("dispatch-sync-ack", goalId, Date.now());
    setPendingContinuationDispatchRef(live);
    // The genuine sync-ack path: before_agent_start acked and cleared pending.
    clearContinuationStartWatchdog();
    const accepted = dispatchAccepted(ctx as never, live as never);
    assert.equal(accepted, true, "the genuine sync-ack still returns success");
    assert.doesNotMatch(ledger(cwd), /continuation_dispatch_wrong_record/);
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

test("v0.39.37: a lane-reset before the accept (pending null, no id match) fails closed", async () => {
  const cwd = tmpCwd();
  const { pi, ctx, goalId } = await boot(cwd);
  try {
    // A stale record id never tracked by the live cursor. The full reset
    // wipes both the pending ref AND the lastDispatchedRecordId cursor
    // (the only context where "stale" + "id mismatch" is meaningful).
    resetContinuationDispatchState(cwd);
    const stale = buildRecord("dispatch-stale", goalId, Date.now() - 1_000);
    const accepted = dispatchAccepted(ctx as never, stale as never);
    assert.equal(accepted, false, "a reset-cleared accept is not a sync-ack and must fail closed");
    assert.match(ledger(cwd), /continuation_dispatch_wrong_record/);
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

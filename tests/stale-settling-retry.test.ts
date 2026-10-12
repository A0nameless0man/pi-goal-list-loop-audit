// pi-goal-list-loop-audit — v0.39.31
// tests/stale-settling-retry.test.ts
//
// Regression suite for the Screenshot_20261012_110844/111046 incident
// (Darklord `i24kv8` already approved+archived, recovery noise still
// firing). The GLLA-owned gap: a settled-but-parked claim (status
// `paused`, pendingCompletion.phase `settling`) is owed an archive, not
// a new audit. Without a fence, a stale recovery callback would
// re-audit a goal the previous auditor already approved and overwrite
// the durable verdict with a fresh attemptId.
//
// Six sub-cases:
//  1. approved/archived work with stale recovery or callback activity
//     (provider-retry, session-recovery, hourly-backstop all fence).
//  2. live unfinished claims (retry-waiting) still reach
//     beginCompletionAudit for automatic origins.
//  3. restart rehydrates the same pendingCompletion — no extra audit.
//  4. ownership replacement: a settling claim whose goalId no longer
//     matches state.goal.id is not silently re-audited.
//  5. duplicate dispatch: two consecutive retries with a settling claim
//     write the fence ledger twice with the SAME attemptId; the durable
//     attemptId does not advance.
//  6. message/status tests: the footer for a settling-but-parked claim
//     reads `settled · verdict applied · awaiting archive` and never
//     reads AUDIT RUNNING / AUDIT TOOL WAIT / AWAITING VERDICT.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import activate, {
  __testOnlyLoadState,
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
  __testOnlyResetTerminalFlags,
} from "../extensions/loops/goal.js";
import { readState } from "../extensions/goal-loop-core.js";
import {
  MockPi,
  makeMockCtx,
  seedGoal,
  seedState,
  tmpCwd,
  type MockCtx,
} from "./harness/mock-pi.js";

const setEnv = (key: string, value: string | undefined): void => {
  const previous = process.env[key];
  Reflect.set(process.env, key, value ?? "");
  (Reflect.get(process.env, key) === undefined ? () => undefined : () => previous)();
  // The pattern above re-reads on demand; pin the original via a stack instead.
  (setEnv as unknown as { _prev: Map<string, string | undefined> })._prev ??= new Map();
  (setEnv as unknown as { _prev: Map<string, string | undefined> })._prev.set(key, previous);
};
const restoreEnv = (): void => {
  const prev = (setEnv as unknown as { _prev: Map<string, string | undefined> })._prev;
  if (!prev) return;
  for (const [key, value] of prev) {
    if (value === undefined) delete process.env[key];
    else Reflect.set(process.env, key, value);
  }
  prev.clear();
};

afterEach(() => {
  restoreEnv();
  __testOnlyResetAuditorSurface();
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  __testOnlyResetTerminalFlags();
});

function __testOnlyResetAuditorSurface(): void {
  try {
    // Mirror the harness in approved-audit-settles.test.ts.
    const mod = require("../extensions/loops/goal-auditor-surface.js") as { __testOnlyResetAuditorSurface?: () => void };
    mod.__testOnlyResetAuditorSurface?.();
  } catch {}
}

interface SeedOptions {
  status?: "paused" | "active" | "auditing" | "complete" | "aborted";
  phase?: "settling" | "retry-waiting" | "recovery-pending" | "starting" | "running" | "complete";
  pauseKind?: "wait" | "blocked" | "decision" | "error" | undefined;
  pauseReason?: string;
  attemptId?: string;
  verdictAt?: string;
  includeApprovedHistory?: boolean;
  goalId?: string;
}

function seedSettlingFixture(cwd: string, options: SeedOptions = {}): { goalId: string; attemptId: string } {
  const goalId = options.goalId ?? `settling-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const attemptId = options.attemptId ?? `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();
  const goal = seedGoal({
    id: goalId,
    status: options.status ?? "paused",
    objective: "Settlement driver parked this claim after the verdict landed but the archive failed",
    pauseKind: options.pauseKind ?? "blocked",
    pauseReason: options.pauseReason ?? "approval-archive-failed",
    pauseResumeAt: undefined,
    pendingCompletion: {
      at: nowIso,
      phase: options.phase ?? "settling",
      startedAt: nowIso,
      attemptId,
      verdictAt: options.verdictAt ?? nowIso,
      recoveryAt: nowIso,
      recoveryReason: "approval-archive-failed",
      completionSummary: "Outcome: shipped the parser.",
      verificationSummary: "evidence for the parser",
    },
    auditHistory: options.includeApprovedHistory === false
      ? []
      : [
          {
            at: nowIso,
            approved: true,
            regressionShieldPassed: true,
            model: "minimax/MiniMax-M3.1-Flash",
            completionSummary: "Outcome: shipped the parser.",
            verificationSummary: "evidence for the parser",
          },
        ],
  });
  seedState(cwd, { goal });
  return { goalId, attemptId };
}

function ledgerTypes(cwd: string): Array<{ type: string; value: unknown }> {
  return fs
    .readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; value: unknown });
}

function ledgerHas(cwd: string, type: string): boolean {
  return ledgerTypes(cwd).some((row) => row.type === type);
}

async function retryAudit(globalAny: unknown, origin: "manual" | "agent" | "provider-retry" | "session-retry" | "complete-goal" | "auto-resume"): Promise<void> {
  const fn = (globalAny as { retryStoredCompletionAudit?: (origin: string) => Promise<void> }).retryStoredCompletionAudit;
  if (!fn) throw new Error("retryStoredCompletionAudit is not registered on globalThis for this test");
  await fn(origin);
}

async function bootGoalLoop(cwd: string, sessionName: string): Promise<{ pi: MockPi; ctx: MockCtx }> {
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: sessionName } });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  return { pi, ctx };
}

// =================================================================
// 1. Stale recovery callback for a settling claim must fence.
// =================================================================
for (const origin of ["provider-retry", "session-retry", "auto-resume"] as const) {
  test(`stale retry refuses to re-audit a settling claim (origin=${origin})`, async () => {
    const cwd = tmpCwd();
    const pi = new MockPi();
    activate(pi.api);
    const ctx = makeMockCtx(cwd, { sessionManager: { name: `settling-fence-${origin}-${Date.now()}` } });
    // Mirror approved-audit-settles.test.ts: seed an empty state before
    // session_start, then install the seeded settling claim AFTER startup.
    seedState(cwd, { goal: null });
    await pi.fire("session_start", { reason: "startup" }, ctx);
    const { goalId, attemptId } = seedSettlingFixture(cwd, { phase: "settling" });
    __testOnlyLoadState(cwd);
    try {
      await retryAudit(globalThis, origin);
      const after = readState(cwd).goal;
      assert.equal(after?.id, goalId, "the goal is unchanged");
      assert.equal(after?.pendingCompletion?.attemptId, attemptId, "the attemptId is NOT advanced");
      assert.equal(after?.pendingCompletion?.phase, "settling", "the phase stays settling");
      assert.ok(!ledgerHas(cwd, "audit_started"), `no audit_started event was emitted for origin=${origin}`);
      const fence = ledgerTypes(cwd).find((row) => row.type === "stale_settling_retry_refused");
      assert.ok(fence, `stale_settling_retry_refused ledger entry must be written for origin=${origin}`);
      assert.equal((fence.value as { origin: string }).origin, origin);
      assert.equal((fence.value as { attemptId: string }).attemptId, attemptId);
    } finally {
      await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
    }
  });
}

// =================================================================
// 2. Live retry-waiting claims still reach beginCompletionAudit.
// =================================================================
for (const origin of ["provider-retry", "session-retry"] as const) {
  test(`live retry-waiting claim is unaffected by the fence (origin=${origin})`, async () => {
    const cwd = tmpCwd();
    const pi = new MockPi();
    activate(pi.api);
    const ctx = makeMockCtx(cwd, { sessionManager: { name: `retry-waiting-live-${origin}-${Date.now()}` } });
    seedState(cwd, { goal: null });
    await pi.fire("session_start", { reason: "startup" }, ctx);
    seedSettlingFixture(cwd, {
      phase: "retry-waiting",
      pauseKind: "wait",
      pauseReason: "auditor retry: 503 upstream unavailable",
    });
    __testOnlyLoadState(cwd);
    try {
      await retryAudit(globalThis, origin);
      const fence = ledgerTypes(cwd).find((row) => row.type === "stale_settling_retry_refused");
      assert.equal(fence, undefined, `no fence for retry-waiting claim (origin=${origin})`);
      const after = readState(cwd).goal;
      assert.ok(after, "the goal is still on disk after the retry");
      assert.ok(after?.auditHistory || after?.pendingCompletion, "the audit history or pending claim survives");
    } finally {
      await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
    }
  });
}

// =================================================================
// 3. Restart rehydrates the same pendingCompletion — no extra audit.
// =================================================================
test("session_start with a settling claim rehydrates without launching a new audit", async () => {
  const cwd = tmpCwd();
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: "settling-rehydrate" } });
  // Seed the settling claim BEFORE session_start; the activation should
  // leave it on disk with the same attemptId.
  const { attemptId } = seedSettlingFixture(cwd, { phase: "settling" });
  try {
    await pi.fire("session_start", { reason: "startup" }, ctx);
    const after = readState(cwd).goal;
    if (!after) {
      // Surface the actual disk + ledger content for the failing case so
      // the regression is diagnosable, not a silent skip.
      const ledger = fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8").split("\n").filter(Boolean);
      const terminalTypes = ["terminal_goal_slot_closed", "stale_settling_retry_refused", "audit_recovery_retry_suppressed", "completion_audit_recovery_pending", "main_model_recovery_retired"];
      const matched = ledger.filter((line) => terminalTypes.some((t) => line.includes(`"${t}"`)));
      throw new Error(
        `goal cleared during session_start; attemptId=${attemptId}; matched ledger entries=${JSON.stringify(matched)}; last 3 lines=${JSON.stringify(ledger.slice(-3))}`,
      );
    }
    assert.equal(after?.pendingCompletion?.attemptId, attemptId, "the same attemptId is on disk after session_start");
    assert.equal(after?.pendingCompletion?.phase, "settling", "the same phase is on disk after session_start");
    assert.ok(!ledgerHas(cwd, "audit_started"), "session_start did not launch a new audit");
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

// =================================================================
// 4. Ownership replacement: a settling claim with a stale goalId must
//    NOT silently re-audit under the new goal's id.
// =================================================================
test("settling claim whose goalId no longer matches the live goal is not silently re-audited", async () => {
  const cwd = tmpCwd();
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: "ownership-replace" } });
  seedState(cwd, { goal: null });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  // The live goal is the new active goal; the old settling claim is
  // archived away and the live state has no pendingCompletion. The retry
  // path must no-op on the `if (!goal?.pendingCompletion) return;` gate.
  seedState(cwd, {
    goal: seedGoal({
      id: "new-active",
      status: "active",
      objective: "successor goal that owns the live state",
    }),
  });
  __testOnlyLoadState(cwd);
  try {
    await retryAudit(globalThis, "provider-retry");
    const after = readState(cwd).goal;
    assert.equal(after?.id, "new-active", "the successor goal is unchanged");
    assert.ok(!ledgerHas(cwd, "audit_started"), "no new audit was launched against the successor goal");
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

// =================================================================
// 5. Duplicate dispatch: a settling claim with two consecutive retry
//    calls writes the fence ledger twice with the SAME attemptId.
// =================================================================
test("duplicate retry of a settling claim does not advance the attemptId", async () => {
  const cwd = tmpCwd();
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: "duplicate-dispatch" } });
  seedState(cwd, { goal: null });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  const { goalId, attemptId } = seedSettlingFixture(cwd, { phase: "settling" });
  __testOnlyLoadState(cwd);
  try {
    await retryAudit(globalThis, "provider-retry");
    await retryAudit(globalThis, "provider-retry");
    await retryAudit(globalThis, "session-retry");
    const after = readState(cwd).goal;
    assert.equal(after?.id, goalId);
    assert.equal(after?.pendingCompletion?.attemptId, attemptId, "the attemptId is preserved across the three retry calls");
    const fences = ledgerTypes(cwd).filter((row) => row.type === "stale_settling_retry_refused");
    assert.equal(fences.length, 3, "the fence is written once per retry call");
    for (const fence of fences) {
      assert.equal((fence.value as { attemptId: string }).attemptId, attemptId, "every fence references the same attemptId");
    }
    assert.ok(!ledgerHas(cwd, "audit_started"), "no audit was launched across the three calls");
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

// =================================================================
// 6. Message/status tests: the footer for a settling-but-parked claim
//    reads `settled · verdict applied · awaiting archive` and never
//    reads AUDIT RUNNING / AUDIT TOOL WAIT / AWAITING VERDICT.
// =================================================================
import { buildStatusText } from "../extensions/goal-loop-display.js";
import type { State } from "../extensions/goal-loop-core.js";
import { uiStatusContextFromRuntime } from "../extensions/ui-status-runtime.js";

test("settling-but-parked footer names the durable state, not the auditor", () => {
  const cwd = tmpCwd();
  const { goalId } = seedSettlingFixture(cwd, { phase: "settling", goalId: "settling-footer" });
  const state: State = { goal: readState(cwd).goal, list: [] } as unknown as State;
  // The uiStatusContextFromRuntime seam: a no-op supervisor with a valid
  // session open. The footer is independent of the supervisor signal.
  const ui = uiStatusContextFromRuntime(state, Date.now(), 1, {
    ownerKey: `goal:${goalId}`,
    generation: 1,
    observedAt: Date.now(),
    session: "open",
    turnActive: false,
  });
  const text = buildStatusText(state, undefined, Date.now(), undefined, { uiStatusContext: ui }, 80);
  assert.ok(text, "the footer rendered");
  assert.match(text ?? "", /settled/);
  assert.match(text ?? "", /verdict applied · awaiting archive/);
  assert.doesNotMatch(text ?? "", /AUDIT RUNNING/);
  assert.doesNotMatch(text ?? "", /AUDIT TOOL WAIT/);
  assert.doesNotMatch(text ?? "", /AWAITING VERDICT/);
  assert.doesNotMatch(text ?? "", /AUDIT STARTING/);
});

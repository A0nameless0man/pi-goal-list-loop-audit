// pi-goal-list-loop-audit
// tests/legacy-quota-waiting-migration.test.ts
//
// Goal 20261018011518 (chosen 2026-10-17): verify the legacy quota-waiting
// completion-claim migration with REAL persisted legacy fixtures — the exact
// pre-v0.34.142 writer shape (phase quota-waiting, quotaAttempts/quotaFirstAt/
// quotaAutoRetryUntil, pauseKind wait + pauseResumeAt, recoveryEpisodeKey
// lineage). The migration itself (normalizePendingCompletion +
// normalizeAuditPhase) already exists; this file proves the whole journey
// without duplicating it:
//   1. LOAD: the fixture lands in retry-waiting with counters mapped,
//      legacy keys gone, lineage + claim + park fields intact.
//   2. RESTART WITHOUT CONSENT: the migrated claim holds for explicit
//      /goal resume — no auto-dispatch, no fresh attempt, reason stands.
//   3. EXPLICIT RESUME: the stored claim retries with ownership lineage
//      (priorAttemptId + recoveryEpisodeKey) preserved.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
} from "../extensions/loops/goal.js";
import { __testOnlyResetAuditorSurface } from "../extensions/loops/goal-auditor-surface.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, tick, tmpCwd, type MockCtx } from "./harness/mock-pi.js";

/** Write a REAL legacy fixture: the exact pre-v0.34.142 writer shape. */
function writeLegacyFixture(cwd: string): void {
  fs.mkdirSync(path.join(cwd, ".pi-glla"), { recursive: true });
  const firstAt = new Date(Date.now() - 60_000).toISOString();
  fs.writeFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), JSON.stringify({
    type: "state",
    value: {
      goal: {
        id: "g-legacy-quota",
        objective: "legacy quota-waiting claim — done when migrated",
        status: "paused",
        policy: "goal",
        recoveryEpisodeKey: "2026-08-01T10:00:00.000Z:legacy123",
        recoveryNoticeKeys: [],
        pendingCompletion: {
          phase: "quota-waiting",
          at: "2026-08-01T10:00:00.000Z",
          completionSummary: "legacy quota claim",
          verificationSummary: "legacy evidence",
          attemptId: "legacy-attempt-7",
          recoveryEpisodeKey: "2026-08-01T10:00:00.000Z:legacy123",
          recoveryNoticeKeys: [],
          quotaAttempts: 1,
          quotaFirstAt: firstAt,
          quotaAutoRetryUntil: new Date(Date.now() + 3_600_000).toISOString(),
          quotaSignal: "MiniMax quota wall",
          retryAfterSec: 300,
          retryFromUpstream: false,
          resetAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
        pauseKind: "wait",
        pauseResumeAt: new Date(Date.now() + 300_000).toISOString(),
        pauseReason: "auditor retry: MiniMax quota wall",
        pauseSuggestedAction: "Auto-retry in 5m — or /goal resume to retry now",
      },
      list: [],
    },
    at: "2026-08-01T10:01:00.000Z",
  }) + "\n");
}

function ledgerTypes(cwd: string): string[] {
  return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8")
    .split("\n").filter(Boolean).map((line) => (JSON.parse(line) as { type: string }).type);
}

async function boot(pi: MockPi, cwd: string): Promise<MockCtx> {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `legacy-quota-${Date.now()}-${Math.random()}` } });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick(120);
  return ctx;
}

afterEach(() => {
  __testOnlyResetAuditorSurface();
  __testOnlyResetStaleFlag();
  __testOnlyResetOwnerSession();
});

test("legacy quota-waiting fixture loads into retry-waiting with counters mapped and lineage intact", async () => {
  const pi = new MockPi();
  activate(pi.api);
  const cwd = tmpCwd();
  writeLegacyFixture(cwd);
  const ctx = await boot(pi, cwd);
  try {
    const goal = readState(cwd).goal as any;
    const pending = goal.pendingCompletion;
    assert.equal(pending?.phase, "retry-waiting", "legacy phase lands in the current spelling");
    assert.equal(pending?.retryAttempts, 1, "quotaAttempts maps to retryAttempts");
    assert.equal(typeof pending?.retryFirstAt, "string", "quotaFirstAt maps to retryFirstAt");
    assert.equal(typeof pending?.retryUntil, "string", "quotaAutoRetryUntil maps to retryUntil");
    assert.equal(pending?.quotaAttempts, undefined, "legacy quota key not exposed to runtime");
    assert.equal(pending?.quotaFirstAt, undefined);
    assert.equal(pending?.quotaAutoRetryUntil, undefined);
    assert.equal(pending?.completionSummary, "legacy quota claim", "claim content survives");
    assert.equal(pending?.attemptId, "legacy-attempt-7", "no fresh attempt minted on load");
    assert.equal(pending?.recoveryEpisodeKey, "2026-08-01T10:00:00.000Z:legacy123", "ownership lineage survives");
    assert.equal(goal?.id, "g-legacy-quota", "goal identity survives");
    assert.equal(goal?.pauseKind, "wait", "park kind survives");
    assert.equal(typeof goal?.pauseResumeAt, "string", "park horizon survives");
    assert.match(goal?.pauseReason ?? "", /auditor retry/, "park reason survives");
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

test("migrated legacy claim holds across a consent-less restart: no auto-dispatch, reason stands", async () => {
  const pi = new MockPi();
  activate(pi.api);
  const cwd = tmpCwd();
  writeLegacyFixture(cwd);
  const ctx = await boot(pi, cwd);
  try {
    await tick(500);
    const goal = readState(cwd).goal as any;
    assert.equal(goal.status, "paused", "cold restart without consent keeps the park standing");
    assert.equal(goal.pendingCompletion?.phase, "retry-waiting", "migrated phase stands");
    assert.equal(goal.pendingCompletion?.attemptId, "legacy-attempt-7", "no fresh attempt without consent");
    assert.equal(goal.pendingCompletion?.completionSummary, "legacy quota claim");
    assert.match(goal.pauseReason ?? "", /auditor retry/, "original park reason stands");
    assert.ok(!ledgerTypes(cwd).includes("audit_started"), "no auditor submitted on a cold load");
    const notices = ctx.ui.notifies.map((entry) => entry.message).join("\n");
    assert.match(notices, /retries it, or enable Auto-resume/, "the hold message names explicit resume");
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

test("explicit /goal resume retries the migrated legacy claim with lineage preserved", async () => {
  const pi = new MockPi();
  activate(pi.api);
  const cwd = tmpCwd();
  writeLegacyFixture(cwd);
  const ctx = await boot(pi, cwd);
  try {
    await pi.command("goal", "resume", ctx);
    await tick();
    const goal = readState(cwd).goal as any;
    assert.equal(goal.status, "auditing", "explicit resume relaunches the stored claim");
    assert.equal(goal.pendingCompletion?.completionSummary, "legacy quota claim", "the agent's summary survives resume");
    assert.notEqual(goal.pendingCompletion?.attemptId, "legacy-attempt-7", "the bounded retry mints a fresh attempt");
    assert.equal(goal.pendingCompletion?.priorAttemptId, "legacy-attempt-7", "attempt lineage preserved");
    assert.equal(goal.pendingCompletion?.recoveryEpisodeKey, "2026-08-01T10:00:00.000Z:legacy123", "ownership lineage preserved");
    assert.ok(ledgerTypes(cwd).some((t) => t.includes("resume")), "the resume path is ledgered");
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

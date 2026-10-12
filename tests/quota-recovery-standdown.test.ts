// pi-goal-list-loop-audit — quota recovery vs storage stand-down
// (note.md #later Screenshot_20261011_211430).
//
// The screenshot shows persistence failures ("Goal update was not fully
// persisted", "Auditor recovery stopped because its durable cursor could
// not be saved") on a card the user read as "we have quota but we didn't
// retry". The true stop cause was the storage safety hold — but two
// GLLA-owned defects made it worse: (1) the degraded latch clears on the
// next successful write, yet the stand-down gates returned before attempting
// any write, so a repaired disk stayed latched and resume/probe paths
// refused forever; (2) quota-wait and storage-hold both render WAITING.
// A manual resume/probe now rechecks persistence once: a landing write
// self-heals and the path proceeds, a failed write keeps the stand-down.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
} from "../extensions/loops/goal.js";
import { __testOnlyResetAuditorSurface } from "../extensions/loops/goal-auditor-surface.js";
import {
  appendLedger,
  isPersistenceDegraded,
  readState,
  recheckPersistenceAfterRepair,
  waitingStatusLabel,
} from "../extensions/goal-loop-core.js";
import { state } from "../extensions/goal-state.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tick, tmpCwd, type MockCtx } from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;

function setSettings(extra: Record<string, unknown>): void {
  fs.writeFileSync(
    GLOBAL_SETTINGS_PATH,
    JSON.stringify({ autoResume: true, aggressiveMode: false, ...extra }),
  );
}

/** A cwd whose .pi-glla writes always fail (mirrors persistence-hardening). */
function brokenCwd(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glla-quota-standdown-"));
  fs.writeFileSync(path.join(dir, ".pi-glla"), "not a directory");
  return dir;
}

function latchDegraded(): void {
  appendLedger(brokenCwd(), "state", { goal: null, list: [] });
  assert.equal(isPersistenceDegraded(), true, "setup: failure latched");
}

function healLatch(): void {
  appendLedger(tmpCwd(), "state", { goal: null, list: [] });
  assert.equal(isPersistenceDegraded(), false, "teardown: latch healed");
}

function ledgerTypes(cwd: string): string[] {
  return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8").split("\n").filter(Boolean)
    .map((line) => (JSON.parse(line) as { type: string }).type);
}

async function pausedRecoveryBoot(cwd: string): Promise<{ pi: MockPi; ctx: MockCtx }> {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  seedState(cwd, {
    goal: seedGoal({ status: "paused", pauseKind: "wait", pauseReason: "main model recovery — retrying", pauseResumeAt: new Date(Date.now() + 3_600_000).toISOString() }),
    mainModelRecovery: {
      kind: "goal",
      primary: "provider/primary",
      active: "provider/primary",
      attempted: ["provider/primary"],
      attempts: 1,
      retryAt: new Date(Date.now() + 3_600_000).toISOString(),
      reason: "main model recovery — provider unavailable",
    },
  });
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `quota-standdown-${Date.now()}-${Math.random()}` } });
  ctx.model = { provider: "provider", id: "primary" } as typeof ctx.model;
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick(120);
  return { pi, ctx };
}

afterEach(() => {
  __testOnlyResetAuditorSurface();
  __testOnlyResetStaleFlag();
  __testOnlyResetOwnerSession();
  setSettings({});
  if (isPersistenceDegraded()) healLatch();
});

// ---- pure: the recheck contract ----

test("recheck on a healthy store is a no-op that reports clear", () => {
  assert.equal(isPersistenceDegraded(), false);
  assert.equal(recheckPersistenceAfterRepair(tmpCwd(), "test"), false);
});

test("recheck against a broken store keeps the stand-down", () => {
  latchDegraded();
  try {
    assert.equal(recheckPersistenceAfterRepair(brokenCwd(), "test"), true, "still degraded");
    assert.equal(isPersistenceDegraded(), true);
  } finally {
    healLatch();
  }
});

test("recheck against a repaired store self-heals", () => {
  const cwd = tmpCwd();
  latchDegraded();
  assert.equal(recheckPersistenceAfterRepair(cwd, "test"), false, "a landing write clears the latch");
  assert.equal(isPersistenceDegraded(), false);
  assert.ok(ledgerTypes(cwd).includes("persistence_recheck"), "the probe write is ledgered");
});

// ---- pure: waiting vs storage-hold status ----

test("waitingStatusLabel names a storage hold instead of a live wait", () => {
  assert.equal(waitingStatusLabel(false), "WAITING");
  assert.equal(waitingStatusLabel(true), "WAITING (storage hold)");
});

// ---- runtime: repaired disk resumes the parked recovery ----

test("probe after a storage repair re-heals and resumes instead of refusing", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await pausedRecoveryBoot(cwd);
  latchDegraded();
  try {
    await pi.command("goal", "resume", ctx);
    await tick(500);
    assert.equal(isPersistenceDegraded(), false, "the resume-time recheck healed the repaired store");
    assert.ok(ledgerTypes(cwd).includes("persistence_recheck"));
    assert.equal(readState(cwd).goal?.status, "active", "the parked recovery resumes after repair");
    assert.equal(ctx.ui.matching("Retrying the saved main-model recovery now").length, 1, "single probe entry, no duplicate dispatch");
    assert.deepEqual(pi.modelSelections, [], "same-model retry drives no switch");
  } finally {
    healLatch();
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

// ---- runtime: still-broken disk stands down honestly ----

test("probe with storage still broken stands down without dispatch", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await pausedRecoveryBoot(cwd);
  const gllaDir = path.join(cwd, ".pi-glla");
  const backup = `${gllaDir}.bak`;
  fs.renameSync(gllaDir, backup);
  fs.writeFileSync(gllaDir, "not a directory");
  appendLedger(cwd, "state", { goal: null, list: [] });
  assert.equal(isPersistenceDegraded(), true, "setup: failure latched");
  try {
    await pi.command("goal", "resume", ctx);
    await tick(400);
    assert.equal(isPersistenceDegraded(), true, "the stand-down holds while writes fail");
    assert.equal(state.goal?.status, "paused", "the goal stays parked");
    assert.equal(ctx.ui.matching("Recovery probe settled — resuming").length, 0, "no release without durable state");
    assert.deepEqual(pi.modelSelections, [], "no model switch without durable state");
  } finally {
    fs.unlinkSync(gllaDir);
    fs.renameSync(backup, gllaDir);
    healLatch();
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

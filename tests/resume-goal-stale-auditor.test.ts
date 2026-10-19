// pi-goal-list-loop-audit — resume_goal tool, stale-session consent gates
//
// Audit finding 2026-10-17 (HIGH, open at v0.39.39):
//   "Stale-session resume releases cold-restore auditor suppression before
//    refusal, unhiding prior auditor feedback the gate was meant to keep
//    hidden until consent (extensions/loops/goal-tools.ts:3206)"
//
// The /goal resume COMMAND path already carried a regression
// (tests/auditor-blank-until-resume.test.ts — "rejected stale /goal resume
// leaves the auditor surface suppressed"). The agent-side resume_goal TOOL
// had no equivalent coverage, so the finding could not be closed with
// evidence either way.
//
// A SECOND defect was found while verifying the first (2026-10-19): the same
// tool spent the COLD-LOAD CONSENT GATE on a refusal. It cleared the hold in
// RAM, journalled "load_hold_released" and told the user "automation is live
// again" — and then refused the resume. The durable projection still held the
// gate, so the live state drifted from the durable one and the journal
// claimed a release that never landed.
//
// What this file pins:
//   1. A stale-session resume_goal refuses and leaves the cold-restore
//      AUDITOR gate closed (prior auditor feedback stays out of fresh model
//      context and out of the feedback UI).
//   2. The same refusal holds when a pending main-model recovery is armed —
//      that branch releases the auditor surface on an admitted resume, so it
//      is the branch most likely to leak.
//   3. A refused stale resume does not spend the cold-load consent gate: no
//      journal row, no "automation is live again" notice, and the durable
//      projection keeps the hold.
//   4. CONTROL: an admitted (fresh-session) resume_goal DOES release both
//      gates — the refusal must not become a blanket refusal to consent.
//
// The auditor gate is keyed by goal id (extensions/loops/goal-auditor-surface.ts);
// goal-aware readers use goal.id, so that is the key asserted here.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
} from "../extensions/loops/goal.js";
import {
  __testOnlyResetAuditorSurface,
  auditorSurfaceSuppressed,
} from "../extensions/loops/goal-auditor-surface.js";
import { continuationPrompt } from "../extensions/goal-continuation.js";
import { buildWidgetLines } from "../extensions/goal-loop-display.js";
import { readState, type Goal, type State } from "../extensions/goal-loop-core.js";
import {
  makeMockCtx,
  MockPi,
  seedGoal,
  seedState,
  staleError,
  tick,
  tmpCwd,
  type MockCtx,
} from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
const AUDIT_REPORT = "Required fixes: keep the objective visible, but do not resume it silently.";

function goalWithAudit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return seedGoal({
    objective: "stale-resume objective — done when pinned",
    status: "paused",
    pauseKind: "blocked",
    pauseReason: "auditor disapproved — fix the gap",
    pauseSuggestedAction: "/goal resume after fixing the gap",
    autoContinue: true,
    pendingTasks: ["stale auditor task that must wait for resume"],
    auditHistory: [{
      at: new Date(Date.now() - 60_000).toISOString(),
      approved: false,
      disapproved: true,
      impossible: false,
      regressionShieldPassed: true,
      revision: 0,
      report: `<disapproved>\n${AUDIT_REPORT}\n</disapproved>`,
    }],
    ...overrides,
  });
}

function armedRecovery(): Record<string, unknown> {
  return {
    primary: "anthropic/mock-model",
    active: "anthropic/mock-model",
    attempted: ["anthropic/mock-model"],
    attempts: 1,
    reason: "provider recovery",
    manualResumeRequired: true,
    resumeCurrent: true,
    kind: "goal",
  };
}

function widgetText(state: State): string {
  return (buildWidgetLines(state) ?? []).join("\n");
}

function ledgerRows(cwd: string): Array<{ type: string; via?: string }> {
  const file = path.join(cwd, ".pi-glla", "active.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => {
    const entry = JSON.parse(line) as { type: string; value?: { via?: string } };
    return { type: entry.type, via: entry.value?.via };
  });
}

async function boot(pi: MockPi, cwd: string): Promise<MockCtx> {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `resume-stale-${Date.now()}-${Math.random()}` } });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick(120);
  return ctx;
}

/**
 * The API-stale shape: the captured ExtensionAPI is dead (pi replaced the
 * session) while the invocation context still answers. This is the shape
 * `warnIfStaleAtEntry` exists for — `foreignToolGuard` cannot see it,
 * because the context and the owner identity are both still healthy.
 *
 * `invalidateHostSession` is deliberately NOT used here: it also poisons
 * ctx.isIdle/ctx.hasPendingMessages, which trips the EARLIER foreign-tool
 * guard and would hide the resume path under test.
 */
function invalidateExtensionApiOnly(pi: MockPi): void {
  pi.sessionNameError = staleError();
}

afterEach(() => {
  __testOnlyResetAuditorSurface();
  __testOnlyResetStaleFlag();
  __testOnlyResetOwnerSession();
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ aggressiveMode: false }));
});

test("stale resume_goal leaves the cold-restore auditor gate closed", async () => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({}));
  const cwd = tmpCwd();
  try {
    seedState(cwd, { goal: goalWithAudit() });
    const pi = new MockPi();
    activate(pi.api);
    const ctx = await boot(pi, cwd);
    const goalId = readState(cwd).goal!.id;
    assert.equal(auditorSurfaceSuppressed(goalId), true, "precondition: the cold restore closed the gate");

    invalidateExtensionApiOnly(pi);
    const result = await pi.runTool("resume_goal", { reason: "user said go" }, ctx) as {
      content: Array<{ text: string }>;
    };

    assert.match(result.content[0]!.text, /stale session/i, "the stale resume is refused");
    assert.equal(auditorSurfaceSuppressed(goalId), true, "a refused stale resume cannot grant auditor-context consent");
    assert.doesNotMatch(continuationPrompt(readState(cwd).goal as Goal), /LATEST AUDITOR/, "the old report is not exposed");
    assert.doesNotMatch(widgetText(readState(cwd)), /Required fixes/, "the old report is not painted");
    assert.equal(readState(cwd).goal?.status, "paused", "the refused resume does not reactivate the goal");
    assert.equal(pi.sent.length, 0, "the refused resume dispatches nothing");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("stale resume_goal with an armed main-model recovery still leaves the gate closed", async () => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({}));
  const cwd = tmpCwd();
  try {
    seedState(cwd, {
      goal: goalWithAudit(),
      mainModelRecovery: armedRecovery(),
    } as unknown as Parameters<typeof seedState>[1]);
    const pi = new MockPi();
    activate(pi.api);
    const ctx = await boot(pi, cwd);
    const goalId = readState(cwd).goal!.id;
    assert.equal(auditorSurfaceSuppressed(goalId), true, "precondition: the cold restore closed the gate");

    invalidateExtensionApiOnly(pi);
    const result = await pi.runTool("resume_goal", { reason: "user said go" }, ctx) as {
      content: Array<{ text: string }>;
    };

    assert.match(result.content[0]!.text, /stale session/i, "the stale resume is refused");
    assert.equal(auditorSurfaceSuppressed(goalId), true, "the recovery branch cannot release a stale session's gate");
    assert.doesNotMatch(continuationPrompt(readState(cwd).goal as Goal), /LATEST AUDITOR/, "the old report is not exposed");
    assert.equal(readState(cwd).goal?.status, "paused", "the refused resume does not reactivate the goal");
    assert.equal(pi.sent.length, 0, "the refused resume dispatches nothing");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("a refused stale resume_goal does not spend the cold-load consent gate", async () => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({}));
  const cwd = tmpCwd();
  try {
    seedState(cwd, { goal: goalWithAudit() });
    const pi = new MockPi();
    activate(pi.api);
    const ctx = await boot(pi, cwd);
    const heldAt = readState(cwd).loadHoldAt;
    assert.equal(typeof heldAt, "number", "precondition: the cold restore engaged the consent gate");

    invalidateExtensionApiOnly(pi);
    await pi.runTool("resume_goal", { reason: "user said go" }, ctx);

    assert.equal(readState(cwd).loadHoldAt, heldAt, "the durable gate survives a refused resume");
    assert.ok(
      !ledgerRows(cwd).some((row) => row.type === "load_hold_released" && row.via === "agent-resume"),
      "no journal row claims a release that never happened",
    );
    assert.equal(
      ctx.ui.matching("Load hold released").length,
      0,
      "the user is not told automation is live when the gate is still held",
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("an admitted resume_goal releases the auditor gate and the consent gate (control)", async () => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({}));
  const cwd = tmpCwd();
  try {
    seedState(cwd, { goal: goalWithAudit() });
    const pi = new MockPi();
    activate(pi.api);
    const ctx = await boot(pi, cwd);
    const goalId = readState(cwd).goal!.id;
    assert.equal(auditorSurfaceSuppressed(goalId), true, "precondition: the cold restore closed the gate");
    assert.equal(typeof readState(cwd).loadHoldAt, "number", "precondition: the cold restore engaged the consent gate");

    const result = await pi.runTool("resume_goal", { reason: "user said go" }, ctx) as {
      content: Array<{ text: string }>;
    };

    assert.match(result.content[0]!.text, /active again/, "the fresh-session resume is admitted");
    assert.equal(auditorSurfaceSuppressed(goalId), false, "an admitted resume grants auditor-context consent");
    assert.match(continuationPrompt(readState(cwd).goal as Goal), /LATEST AUDITOR/, "the report returns after consent");
    assert.equal(readState(cwd).loadHoldAt, undefined, "an admitted resume releases the consent gate durably");
    assert.ok(
      ledgerRows(cwd).some((row) => row.type === "load_hold_released" && row.via === "agent-resume"),
      "the durable release is journalled",
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

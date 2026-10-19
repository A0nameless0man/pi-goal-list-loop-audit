// pi-goal-list-loop-audit — resume_goal tool, stale-session auditor gate
//
// Audit finding 2026-10-17 (HIGH, still open at v0.39.39):
//   "Stale-session resume releases cold-restore auditor suppression before
//    refusal, unhiding prior auditor feedback the gate was meant to keep
//    hidden until consent (extensions/loops/goal-tools.ts:3206)"
//
// The /goal resume COMMAND path already carries a regression
// (tests/auditor-blank-until-resume.test.ts — "rejected stale /goal resume
// leaves the auditor surface suppressed"). The agent-side resume_goal TOOL
// had no equivalent coverage, so the finding could not be closed with
// evidence either way.
//
// What this file pins:
//   1. A stale-session resume_goal refuses and leaves the cold-restore
//      auditor gate CLOSED (prior auditor feedback stays out of fresh
//      model context and out of the feedback UI).
//   2. The same refusal holds when a pending main-model recovery is armed
//      — that branch is the one that releases the auditor surface on an
//      admitted resume, so it is the branch most likely to leak.
//   3. A refused stale resume does not reactivate the goal, does not
//      dispatch a continuation, and does not claim the goal was resumed.
//   4. CONTROL: an admitted (fresh-session) resume_goal DOES release the
//      gate — the refusal must not become a blanket refusal to consent.
//
// The gate is keyed by goal id (extensions/loops/goal-auditor-surface.ts);
// goal-aware readers use goal.id, so that is the key asserted here.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";

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
  invalidateHostSession,
  makeMockCtx,
  MockPi,
  seedGoal,
  seedState,
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

async function boot(pi: MockPi, cwd: string): Promise<MockCtx> {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `resume-stale-${Date.now()}-${Math.random()}` } });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick(120);
  return ctx;
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

    invalidateHostSession(pi, ctx);
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

    invalidateHostSession(pi, ctx);
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

test("an admitted resume_goal releases the auditor gate (control)", async () => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({}));
  const cwd = tmpCwd();
  try {
    seedState(cwd, { goal: goalWithAudit() });
    const pi = new MockPi();
    activate(pi.api);
    const ctx = await boot(pi, cwd);
    const goalId = readState(cwd).goal!.id;
    assert.equal(auditorSurfaceSuppressed(goalId), true, "precondition: the cold restore closed the gate");

    const result = await pi.runTool("resume_goal", { reason: "user said go" }, ctx) as {
      content: Array<{ text: string }>;
    };

    assert.match(result.content[0]!.text, /active again/, "the fresh-session resume is admitted");
    assert.equal(auditorSurfaceSuppressed(goalId), false, "an admitted resume grants auditor-context consent");
    assert.match(continuationPrompt(readState(cwd).goal as Goal), /LATEST AUDITOR/, "the report returns after consent");
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

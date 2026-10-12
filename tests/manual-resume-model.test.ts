// pi-goal-list-loop-audit — manual resume adopts the retry model
// (note.md #later Screenshot_20261011_192005).
//
// The status card reported `model: primary <stale> · inherited from
// session` while the user was retrying on a different model: a persisted
// recovery cursor names the episode-creation model as `primary`, and a
// manual resume never re-anchored it. Worse, a committed-but-unreconciled
// `pendingModelSwitch` could re-drive setModel at the next probe, silently
// overriding the fresh selection. A manual resume now adopts the current
// session model for recovery tracking (forbidden selections excepted).

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
} from "../extensions/loops/goal.js";
import { __testOnlyResetAuditorSurface } from "../extensions/loops/goal-auditor-surface.js";
import { readState, formatMainModelRecoveryStatus } from "../extensions/goal-loop-core.js";
import { state, persistStateLine } from "../extensions/goal-state.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tick, tmpCwd, type MockCtx } from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;

const CURRENT = { provider: "minimax", id: "MiniMax-M3.1-Flash" };
const CURRENT_REF = "minimax/MiniMax-M3.1-Flash";
const STALE_REF = "opencode-go/muse-spark-1.3-contributor";

function setSettings(extra: Record<string, unknown>): void {
  fs.writeFileSync(
    GLOBAL_SETTINGS_PATH,
    JSON.stringify({ autoResume: true, aggressiveMode: false, ...extra }),
  );
}

function ledgerTypes(cwd: string): string[] {
  return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8").split("\n").filter(Boolean)
    .map((line) => (JSON.parse(line) as { type: string }).type);
}

function ledgerEntries(cwd: string, type: string): Array<Record<string, unknown>> {
  return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8").split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; value: Record<string, unknown> })
    .filter((entry) => entry.type === type)
    .map((entry) => entry.value ?? {});
}

async function resumeBoot(
  cwd: string,
  opts: { recovery?: Record<string, unknown>; goalOverrides?: Record<string, unknown> },
): Promise<{ pi: MockPi; ctx: MockCtx }> {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  seedState(cwd, {
    goal: seedGoal({
      status: "paused",
      pauseKind: "blocked",
      pauseReason: "waiting on the operator",
      ...(opts.goalOverrides ?? {}),
    }),
    ...(opts.recovery ? { mainModelRecovery: opts.recovery } : {}),
  });
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `resume-model-${Date.now()}-${Math.random()}` } });
  ctx.model = { ...CURRENT } as typeof ctx.model;
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick(120);
  return { pi, ctx };
}

afterEach(() => {
  __testOnlyResetAuditorSurface();
  __testOnlyResetStaleFlag();
  __testOnlyResetOwnerSession();
  setSettings({});
});

// ---- changed model: the user's retry model wins over the stale cursor ----

test("manual resume re-anchors a stale recovery cursor to the current model", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await resumeBoot(cwd, {
    recovery: {
      kind: "goal",
      primary: STALE_REF,
      active: STALE_REF,
      attempted: [STALE_REF],
      attempts: 2,
      reason: "main model recovery — provider unavailable",
    },
  });
  try {
    await pi.command("goal", "resume", ctx);
    await tick(200);
    const saved = readState(cwd);
    assert.equal(saved.goal?.status, "active", "the goal resumes");
    assert.equal(saved.mainModelRecovery?.primary, CURRENT_REF, "primary tracks the retry model, not the stale cursor");
    assert.equal(saved.mainModelRecovery?.active, CURRENT_REF);
    assert.equal(saved.mainModelRecovery?.pendingModelSwitch, undefined);
    const reanchors = ledgerEntries(cwd, "manual_resume_model_reanchored");
    assert.equal(reanchors.length, 1, "exactly one re-anchor is ledgered");
    assert.equal(reanchors[0]?.["from"], STALE_REF);
    assert.equal(reanchors[0]?.["to"], CURRENT_REF);
    assert.deepEqual(pi.modelSelections, [], "no model switch is driven — the session already uses the retry model");
    const statusLines = formatMainModelRecoveryStatus(saved.mainModelRecovery as never);
    assert.ok(statusLines.some((l) => l.includes(`Current: ${CURRENT_REF}`)), `status names the retry model (${JSON.stringify(statusLines)})`);
    assert.ok(statusLines.some((l) => l.startsWith(`  Order: ${CURRENT_REF}`)), "status order starts at the retry model");
    const notices = ctx.ui.notifies.map((n) => n.message).join("\n");
    assert.match(notices, new RegExp(`adopts your current model \\(${CURRENT_REF.replace(/[./-]/g, "\\$&")}\\)`), "the resume names the adopted model");
    assert.equal(ctx.ui.matching("Resumed goal").length, 1, "one resume, no duplicate dispatch");
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

// ---- unchanged model: no re-anchor, no noise ----

test("manual resume on the unchanged model leaves the cursor alone", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await resumeBoot(cwd, {
    recovery: {
      kind: "goal",
      primary: CURRENT_REF,
      active: CURRENT_REF,
      attempted: [CURRENT_REF],
      attempts: 1,
      reason: "main model recovery — provider unavailable",
    },
  });
  try {
    await pi.command("goal", "resume", ctx);
    await tick(200);
    const saved = readState(cwd);
    assert.equal(saved.goal?.status, "active");
    assert.equal(saved.mainModelRecovery?.primary, CURRENT_REF);
    assert.deepEqual(ledgerTypes(cwd).filter((t) => t === "manual_resume_model_reanchored"), [], "no re-anchor when already anchored");
    assert.deepEqual(pi.modelSelections, [], "no model switch is driven");
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

// ---- interrupted recovery: a stale pending switch is dropped, never driven ----

test("manual resume drops an interrupted stale switch instead of restoring it", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await resumeBoot(cwd, {
    recovery: {
      kind: "goal",
      primary: STALE_REF,
      active: STALE_REF,
      attempted: [STALE_REF],
      attempts: 3,
      pendingModelSwitch: "fallback/fb-1",
      retryAt: new Date(Date.now() + 3_600_000).toISOString(),
      reason: "main model recovery — provider unavailable",
    },
  });
  try {
    await pi.command("goal", "resume", ctx);
    await tick(500);
    const saved = readState(cwd);
    assert.equal(saved.mainModelRecovery?.pendingModelSwitch, undefined, "the obsolete switch intent is dropped");
    assert.equal(saved.mainModelRecovery?.primary, CURRENT_REF, "primary tracks the retry model");
    const reanchors = ledgerEntries(cwd, "manual_resume_model_reanchored");
    assert.equal(reanchors.length, 1);
    assert.equal(reanchors[0]?.["clearedSwitch"], "fallback/fb-1");
    const driven = pi.modelSelections.map((m) => `${(m as { provider: string }).provider}/${(m as { id: string }).id}`);
    assert.ok(!driven.includes("fallback/fb-1"), `the stale switch is never driven (${JSON.stringify(driven)})`);
    assert.equal(saved.goal?.status, "active", "the probe validates the retry model, then the park releases exactly once");
    assert.equal(ctx.ui.matching("Recovery probe settled — resuming").length, 1, "single release, no duplicate dispatch");
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

// ---- forbidden current selection: never adopted into the durable cursor ----

test("manual resume never adopts a forbidden current model", async () => {
  const cwd = tmpCwd();
  setSettings({ forbiddenModels: ["minimax"] });
  const { pi, ctx } = await resumeBoot(cwd, {
    recovery: {
      kind: "goal",
      primary: STALE_REF,
      active: STALE_REF,
      attempted: [STALE_REF],
      attempts: 1,
      reason: "main model recovery — provider unavailable",
    },
  });
  try {
    await pi.command("goal", "resume", ctx);
    await tick(200);
    const saved = readState(cwd);
    assert.equal(saved.goal?.status, "active", "the goal still resumes");
    assert.equal(saved.mainModelRecovery?.primary, STALE_REF, "a forbidden selection is not blessed into the cursor");
    assert.deepEqual(ledgerTypes(cwd).filter((t) => t === "manual_resume_model_reanchored"), [], "no re-anchor");
    assert.equal(ledgerEntries(cwd, "manual_resume_model_kept").length, 1, "the decline is ledgered");
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

// ---- pending audit: claim preserved, model still adopted, no agent turn ----

test("manual resume with a pending claim adopts the model without disturbing the audit", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await resumeBoot(cwd, {
    recovery: {
      kind: "goal",
      primary: STALE_REF,
      active: STALE_REF,
      attempted: [STALE_REF],
      attempts: 1,
      reason: "main model recovery — provider unavailable",
    },
  });
  // Inject the claim AFTER boot: session_start auto-retries a seeded claim
  // on its own, which would put the goal on the auditing branch before the
  // manual resume under test ever runs.
  state.goal = {
    ...state.goal!,
    pendingCompletion: {
      attemptId: "audit-attempt-1",
      at: new Date().toISOString(),
    },
  };
  persistStateLine(cwd, state);
  await tick(60);
  try {
    await pi.command("goal", "resume", ctx);
    await tick(300);
    const saved = readState(cwd);
    assert.equal(saved.mainModelRecovery?.primary, CURRENT_REF, "model adoption is independent of the audit path");
    assert.ok(saved.goal?.pendingCompletion, "the stored completion claim is preserved");
    const resumed = ledgerEntries(cwd, "goal_resumed").filter((e) => e["via"] === "manual-audit");
    assert.equal(resumed.length, 1, "exactly one audit dispatch, no duplicate auditor");
    assert.equal(
      ctx.ui.notifies.some((n) => n.message.includes("starting the detached auditor now (no agent turn needed)")),
      true,
      "resume takes the direct-audit path",
    );
    assert.equal(ctx.ui.matching("Resumed goal").length, 0, "no agent-turn resume alongside the audit");
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

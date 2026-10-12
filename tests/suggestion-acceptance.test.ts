// pi-goal-list-loop-audit — suggestion acceptance (note.md #later 175739).
//
// A blocked/error pause carrying a concrete command is an implicit question
// with no accept path. pause_goal promotes it to an Accept-first decision so
// the existing card + picker + budget machinery carries it.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
} from "../extensions/loops/goal.js";
import { __testOnlyResetAuditorSurface } from "../extensions/loops/goal-auditor-surface.js";
import {
  extractSuggestedCommand,
  suggestionAcceptancePromotion,
  readState,
} from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tick, tmpCwd, type MockCtx } from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;

type GoalView = {
  status: string;
  pauseKind?: string;
  pauseOptions?: string[];
  pauseRecommended?: number;
  pauseSuggestedAction?: string;
  midRunDecisionCount?: number;
};

function setSettings(extra: Record<string, unknown>): void {
  fs.writeFileSync(
    GLOBAL_SETTINGS_PATH,
    JSON.stringify({ autoResume: true, aggressiveMode: false, ...extra }),
  );
}

async function activeBoot(cwd: string, policy: "goal" | "list" = "goal"): Promise<{ pi: MockPi; ctx: MockCtx }> {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  seedState(cwd, { goal: seedGoal({ status: "active", policy }) });
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `suggestion-${Date.now()}-${Math.random()}` } });
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

// ---- pure extraction ----

test("extractSuggestedCommand: screenshot-shaped tweak suggestion extracts the exact command", () => {
  const cmd = extractSuggestedCommand(
    'Run /goal tweak "Restore the original selective automatic Git LFS implementation." This changes scope explicitly.',
  );
  assert.equal(cmd, '/goal tweak "Restore the original selective automatic Git LFS implementation."');
});

test("extractSuggestedCommand: bare resume/stop commands extract cleanly", () => {
  assert.equal(extractSuggestedCommand("/goal resume to continue"), "/goal resume");
  assert.equal(extractSuggestedCommand("then run /loop stop; fix first"), "/loop stop");
  assert.equal(extractSuggestedCommand("inspect /list show for details"), "/list show");
});

test("extractSuggestedCommand: vague prose, bare verbs, and quoteless tweak yield nothing", () => {
  assert.equal(extractSuggestedCommand("Pick an option to continue."), undefined);
  assert.equal(extractSuggestedCommand(undefined), undefined);
  assert.equal(extractSuggestedCommand("run /goal to continue"), undefined);
  assert.equal(extractSuggestedCommand("run /goal tweak the objective"), undefined);
  assert.equal(extractSuggestedCommand("maybe /goal resume or /goal cancel later"), "/goal resume");
});

// ---- pure promotion shape ----

test("suggestionAcceptancePromotion: accept-first options use policy-correct verbs", () => {
  const goal = suggestionAcceptancePromotion('Run /goal tweak "Fix X."', "goal")!;
  assert.equal(goal.options.length, 3);
  assert.match(goal.options[0]!, /^Accept and run \/goal tweak "Fix X\."\s*$/);
  assert.match(goal.options[1]!, /\/goal resume/);
  assert.match(goal.options[2]!, /\/goal cancel/);
  assert.equal(goal.recommended, 1);
  const list = suggestionAcceptancePromotion("/list resume to continue", "list")!;
  assert.match(list.options[1]!, /\/list resume/);
  assert.equal(suggestionAcceptancePromotion("no command here", "goal"), undefined);
});

// ---- tool-level behavior ----

test("pause_goal: blocked pause with a concrete command lands as an Accept-first decision", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await activeBoot(cwd);
  try {
    await pi.runTool("pause_goal", {
      reason: "Scope repair is still blocked: the continuation retains a checkpoint-only objective.",
      suggestedAction: 'Run /goal tweak "Restore the implementation objective." This changes scope explicitly.',
      kind: "blocked",
    }, ctx);
    const g = readState(cwd).goal as GoalView;
    assert.equal(g.status, "paused");
    assert.equal(g.pauseKind, "decision");
    assert.equal(g.pauseOptions?.length, 3);
    assert.match(g.pauseOptions![0]!, /^Accept and run \/goal tweak "Restore the implementation objective\."\s*$/);
    assert.equal(g.pauseRecommended, 1);
    assert.equal(g.midRunDecisionCount, 1, "the promotion counts against the mid-run budget");
    assert.match(g.pauseSuggestedAction!, /\/goal tweak/, "the exact command stays on the card");
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

test("pause_goal: list policy promotes with list verbs", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await activeBoot(cwd, "list");
  try {
    await pi.runTool("pause_goal", {
      reason: "Item cannot proceed without a scope call.",
      suggestedAction: "Run /list resume after fixing access.",
      kind: "error",
    }, ctx);
    const g = readState(cwd).goal as GoalView;
    assert.equal(g.pauseKind, "decision");
    assert.match(g.pauseOptions![0]!, /^Accept and run \/list resume\s*$/);
    assert.match(g.pauseOptions![1]!, /\/list resume/);
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

test("pause_goal: vague suggestion stays a plain pause; explicit decisions pass through", async () => {
  const cwd = tmpCwd();
  setSettings({});
  const { pi, ctx } = await activeBoot(cwd);
  try {
    await pi.runTool("pause_goal", {
      reason: "Waiting on user input with no concrete fix.",
      suggestedAction: "Tell me how to proceed.",
      kind: "blocked",
    }, ctx);
    let g = readState(cwd).goal as GoalView;
    assert.equal(g.pauseKind, "blocked");
    assert.equal(g.pauseOptions, undefined);
    assert.equal(g.midRunDecisionCount ?? 0, 0, "no question asked, no budget spent");

    await pi.runTool("resume_goal", { reason: "user answered; continuing" }, ctx);
    await pi.runTool("pause_goal", {
      reason: "Genuine permission boundary: destructive deploy needs consent.",
      suggestedAction: "Approve the deploy to continue.",
      kind: "decision",
      options: ["approve the deploy", "hold the deploy"],
      recommended: 1,
    }, ctx);
    g = readState(cwd).goal as GoalView;
    assert.equal(g.pauseKind, "decision");
    assert.deepEqual(g.pauseOptions, ["approve the deploy", "hold the deploy"]);
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

test("pause_goal: promoted suggestion honors the decision budget instead of asking again", async () => {
  const cwd = tmpCwd();
  setSettings({ decisionPauseBudget: 0 });
  const { pi, ctx } = await activeBoot(cwd);
  try {
    const res = await pi.runTool("pause_goal", {
      reason: "Blocked with a concrete fix available.",
      suggestedAction: 'Run /goal tweak "Restore the implementation objective."',
      kind: "blocked",
    }, ctx) as { content: Array<{ text: string }> };
    const g = readState(cwd).goal as GoalView;
    assert.equal(g.status, "active", "over-budget promotion auto-defaults instead of pausing");
    assert.match(res.content[0]!.text, /Accept and run \/goal tweak/);
    assert.match(res.content[0]!.text, /Left out/i);
  } finally {
    await pi.fire("session_shutdown", { reason: "quit" }, ctx);
  }
});

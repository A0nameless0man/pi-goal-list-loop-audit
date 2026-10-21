// pi-goal-list-loop-audit — v0.38.51
// tests/list-bare-draft.test.ts
//
// Contract (user note 2026-09-12): bare /list drafts from context like bare
// /goal does; /list show remains the viewer. Pins:
//   1. bare /list enters LIST drafting (agent list_add is blocked with the
//      drafting-gate message);
//   2. /list show still renders the queue;
//   3. the stale guard mirrors cmdSet's empty-goal path: a stale bare /list
//      latches no drafting gate, so a later list_add lands normally.
// Cleanup uses the honest user path: an explicit /goal start with a
// "Done when:" clause cancels the drafting session (goal-commands.ts).
//
// Shared-process hazard (note.md): this file activates the goal.js module
// singleton at module scope, so it copies list-settings-route.test.ts's
// afterEach cleanup and the __testOnlyResetOwnerSession() in freshSession.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { globalSettingsPath, type Settings } from "../extensions/goal-settings.js";
import { waitForDrafterRetry } from "../extensions/drafter-recovery.js";

import activate, { __testOnlyResetStaleFlag, __testOnlyResetOwnerSession } from "../extensions/loops/goal.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, tmpCwd, seedState, invalidateHostSession, tick, type MockCtx } from "./harness/mock-pi.js";

const pi = new MockPi();
activate(pi.api);

const MAIN_SM = { name: "main-session-manager" };
afterEach(() => {
  pi.execHandler = null;
  pi.sendMessageError = null;
  pi.sessionNameError = null;
  __testOnlyResetOwnerSession(); // release the claim so later files are unaffected
});

function ownerCtx(cwd: string): MockCtx {
  return makeMockCtx(cwd, { sessionManager: MAIN_SM });
}
async function freshSession(cwd: string, reason: string): Promise<MockCtx> {
  __testOnlyResetOwnerSession(); // behavioral-orchestrator's owner claim precedes this file
  const ctx = ownerCtx(cwd);
  await pi.fire("session_start", { reason }, ctx);
  return ctx;
}

type RetryRuntime = { wait?: typeof waitForDrafterRetry };
const recoverDraft = (ctx: MockCtx, runtime: RetryRuntime = {}) =>
  (globalThis as unknown as { handleDrafterModelFailure: (ctx: MockCtx, error: string, runtime: RetryRuntime) => Promise<boolean> })
    .handleDrafterModelFailure(ctx, "503 upstream unavailable", runtime);
const restoreDraft = () =>
  (globalThis as unknown as { restoreDrafterModel: () => Promise<void> }).restoreDrafterModel();
const immediateRetry: RetryRuntime = { wait: async (_ms, signal) => !signal.aborted };
const recoveryPrompts = () => pi.userMessages.filter(message => message.message.includes("The drafting model turn failed.")).length;

async function withDrafter(
  settings: Partial<Settings>,
  run: (fixture: { ctx: MockCtx; session: any; selected: any; backup: any; manual: any; api: any }) => Promise<void>,
): Promise<void> {
  const file = globalSettingsPath();
  const saved = fs.readFileSync(file, "utf8");
  const originalApi = { setModel: pi.api.setModel, getThinkingLevel: pi.api.getThinkingLevel, setThinkingLevel: pi.api.setThinkingLevel };
  const session = { provider: "test", id: "session", reasoning: true, thinkingLevelMap: { max: "max", xhigh: "xhigh" } };
  const selected = { provider: "test", id: "selected", reasoning: true };
  const backup = { provider: "test", id: "backup", reasoning: true };
  const manual = { provider: "test", id: "manual", reasoning: true };
  const cwd = tmpCwd();
  seedState(cwd, {});
  const ctx = ownerCtx(cwd) as any;
  ctx.model = session;
  ctx.thinkingLevel = "max";
  ctx.modelRegistry = {
    getAvailable: () => [session, selected, backup, manual],
    hasConfiguredAuth: () => true,
    find: (provider: string, id: string) => [session, selected, backup, manual].find(model => model.provider === provider && model.id === id),
  };
  const api = pi.api as any;
  api.getThinkingLevel = () => ctx.thinkingLevel;
  api.setThinkingLevel = (level: string) => { ctx.thinkingLevel = level; };
  api.setModel = async (model: unknown) => {
    const previousModel = ctx.model;
    pi.modelSelections.push(model);
    ctx.model = model;
    await pi.fire("model_select", { model, previousModel, source: "set" }, ctx);
    return true;
  };
  fs.writeFileSync(file, JSON.stringify({ aggressiveMode: false, ...settings }));
  pi.modelSelections.length = 0;
  pi.userMessages.length = 0;
  try {
    __testOnlyResetStaleFlag();
    __testOnlyResetOwnerSession();
    await pi.fire("session_start", { reason: "startup" }, ctx);
    await pi.command("list", "", ctx);
    await run({ ctx, session, selected, backup, manual, api });
  } finally {
    await restoreDraft();
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
    Object.assign(api, originalApi);
    fs.writeFileSync(file, saved);
  }
}

// ────────────────────────────────────────────────────────────────────
// Bare /list drafts from context like bare /goal
// ────────────────────────────────────────────────────────────────────

test("v0.38.51: bare /list enters list drafting — agent list_add is gated", async () => {
  __testOnlyResetStaleFlag();
  const cwd = tmpCwd();
  seedState(cwd, {});
  const ctx = await freshSession(cwd, "startup");
  await tick();

  await pi.command("list", "", ctx);
  await tick();

  const blocked = await pi.runTool("list_add", { items: ["gated item — done when pinned"] }, ctx);
  assert.match(blocked.content[0]!.text, /LIST DRAFTING IN PROGRESS/, "bare /list latched the list-drafting gate");

  // Honest user exit: an explicit objective cancels the drafting session.
  await pi.command("goal", "start cleanup objective — done when: pinned", ctx);
  await tick();
  const added = await pi.runTool("list_add", { items: ["after draft — done when pinned"] }, ctx);
  assert.match(added.content[0]!.text, /item\(s\) queued/, "explicit start cleared the gate; the item waits behind the active goal");
});

test("v0.38.51: /list show still renders the queue (viewer preserved)", async () => {
  __testOnlyResetStaleFlag();
  const cwd = tmpCwd();
  seedState(cwd, {});
  const ctx = await freshSession(cwd, "startup");
  await tick();
  await pi.command("goal", "start active one — done when: pinned", ctx);
  await tick();
  await pi.command("list", "add waiting one — done when: pinned", ctx);
  await tick();

  await pi.command("list", "show", ctx);
  await tick();

  const last = ctx.ui.notifies.at(-1)?.message ?? "";
  assert.match(last, /List \(1\)/, "show renders the waiting queue");
  assert.match(last, /waiting one/, "the queued item renders");
  const state = readState(cwd) as { goal: { objective: string } | null };
  assert.ok(state.goal && state.goal.objective.includes("active one"), "show mutated nothing — the active goal is untouched");
});

test("v0.38.51: stale bare /list latches no drafting gate — a later list_add lands", async () => {
  __testOnlyResetStaleFlag();
  const cwd = tmpCwd();
  seedState(cwd, {});
  const ctx = await freshSession(cwd, "startup");
  await tick();
  invalidateHostSession(pi, ctx);

  await pi.command("list", "", ctx);
  await tick();

  // The lifecycle replacement arrives: a fresh session_start rebinds. If
  // the stale bare /list had latched the (module-global) drafting gate,
  // this fresh context's list_add would still be blocked.
  __testOnlyResetStaleFlag();
  pi.sendMessageError = null;
  pi.sessionNameError = null;
  const fresh = await freshSession(cwd, "startup");
  await tick();
  const added = await pi.runTool("list_add", { items: ["stale-seed item — done when pinned"] }, fresh);
  assert.match(added.content[0]!.text, /item\(s\) added|item.*active/i, "a stale bare /list left no drafting gate behind");
  await pi.command("list", "cancel", fresh);
});

// Meaningful regressions: these run the real drafting lease and host event
// handlers. Only the recovery clock is injectable; no provider is contacted.
test("drafter provider error reaches the original session model AND thinking through agent_end", async () => {
  await withDrafter({ drafterModel: "test/selected", drafterThinkingLevel: "low" }, async ({ ctx, selected, session }) => {
    assert.equal(ctx.model, selected);
    assert.equal(ctx.thinkingLevel, "low");
    await pi.fire("agent_end", { messages: [{ role: "assistant", content: [], stopReason: "error", errorMessage: "503 upstream unavailable" }] }, ctx);
    assert.equal(ctx.model, session);
    assert.equal(ctx.thinkingLevel, "max");
    assert.equal(recoveryPrompts(), 1);
    assert.deepEqual(pi.modelSelections, [selected, session]);
    await restoreDraft();
    assert.equal(ctx.thinkingLevel, "max");
  });
});

test("drafter recovery retains original thinking across configured alternatives, then exhausts without extra prompts", async () => {
  await withDrafter({ drafterModel: "test/selected", drafterModelFallbacks: ["test/backup"], drafterThinkingLevel: "low" }, async ({ ctx, selected, backup, session }) => {
    assert.equal(await recoverDraft(ctx, immediateRetry), true);
    assert.equal(ctx.model, backup);
    assert.equal(ctx.thinkingLevel, "low");
    assert.equal(await recoverDraft(ctx, immediateRetry), true);
    assert.equal(ctx.model, session);
    assert.equal(ctx.thinkingLevel, "max");
    assert.equal(await recoverDraft(ctx, immediateRetry), false);
    assert.equal(await recoverDraft(ctx, immediateRetry), false);
    assert.equal(recoveryPrompts(), 2);
    assert.deepEqual(pi.modelSelections, [selected, backup, session]);
  });
});

test("drafter rejected restoration retains its lease until a later restoration succeeds", async () => {
  await withDrafter({ drafterModel: "test/selected", drafterThinkingLevel: "low" }, async ({ ctx, selected, session, api }) => {
    const select = api.setModel;
    let accept = false;
    api.setModel = async (model: unknown) => model === session && !accept ? false : select(model);
    assert.equal(await recoverDraft(ctx, immediateRetry), false);
    assert.equal(ctx.model, selected);
    assert.equal(ctx.thinkingLevel, "low");
    // A new interview must not overwrite pending restoration with a lease
    // that incorrectly calls the failed drafter its original session.
    const prompts = pi.userMessages.length;
    await pi.command("list", "", ctx);
    assert.equal(pi.userMessages.length, prompts);
    accept = true;
    await restoreDraft();
    assert.equal(ctx.model, session);
    assert.equal(ctx.thinkingLevel, "max");
    const selections = pi.modelSelections.length;
    await restoreDraft();
    assert.equal(pi.modelSelections.length, selections, "successful restoration releases the lease");
  });
});

test("implicit session drafting has one bounded same-model retry, not an empty chain or endless replay", async () => {
  await withDrafter({ drafterThinkingLevel: "low" }, async ({ ctx, session }) => {
    assert.equal(ctx.model, session);
    assert.equal(ctx.thinkingLevel, "max");
    assert.equal(await recoverDraft(ctx, immediateRetry), true);
    assert.equal(await recoverDraft(ctx, immediateRetry), false);
    assert.equal(await recoverDraft(ctx, immediateRetry), false);
    assert.equal(recoveryPrompts(), 1);
    assert.equal(pi.modelSelections.length, 0, "same-model retry does not change the user's model");
  });
});

test("cancelling an interview during its retry wait aborts recovery before any delayed selection or prompt", async () => {
  await withDrafter({ drafterModel: "test/selected", drafterThinkingLevel: "low" }, async ({ ctx, selected, session }) => {
    let waiting: AbortSignal | undefined;
    const recovery = recoverDraft(ctx, { wait: async (_ms, signal) => {
      waiting = signal;
      return waitForDrafterRetry(60_000, signal);
    } });
    assert.ok(waiting);
    await pi.command("goal", "start explicit cancellation — done when: pinned", ctx);
    assert.equal(await recovery, false);
    assert.equal(waiting!.aborted, true);
    assert.equal(ctx.model, session);
    assert.equal(ctx.thinkingLevel, "max");
    assert.equal(recoveryPrompts(), 0);
    assert.deepEqual(pi.modelSelections, [selected, session], "only the explicit cancellation restores the session");
  });
});

test("a manual model selection during retry delay supersedes the old drafter and restoration", async () => {
  await withDrafter({ drafterModel: "test/selected", drafterThinkingLevel: "low" }, async ({ ctx, manual, api }) => {
    let resume!: (ready: boolean) => void;
    let signal!: AbortSignal;
    const recovery = recoverDraft(ctx, { wait: (_ms, currentSignal) => {
      signal = currentSignal;
      return new Promise(resolve => { resume = resolve; });
    } });
    await api.setModel(manual);
    assert.equal(signal.aborted, true, "manual model_select cancels even a long retry delay immediately");
    (ctx as any).thinkingLevel = "medium";
    resume(true);
    assert.equal(await recovery, false);
    await restoreDraft();
    assert.equal(ctx.model, manual);
    assert.equal(ctx.thinkingLevel, "medium");
    assert.equal(recoveryPrompts(), 0);
  });
});

for (const shutdown of [true, false]) test(`host replacement (shutdown=${shutdown}) cannot receive the old drafter's model, dial or prompt`, async () => {
  await withDrafter({ drafterModel: "test/selected", drafterThinkingLevel: "low" }, async ({ ctx, manual, api }) => {
    let waiting: AbortSignal | undefined;
    const recovery = recoverDraft(ctx, { wait: async (_ms, signal) => {
      waiting = signal;
      return waitForDrafterRetry(60_000, signal);
    } });
    // Cover both a normal reload and a file-backed host successor that
    // arrives without shutdown. An arbitrary in-memory child is not a host.
    if (shutdown) {
      await pi.fire("session_shutdown", { reason: "reload" }, ctx);
      assert.equal(waiting!.aborted, true);
      await restoreDraft();
    }
    const replacement = makeMockCtx(ctx.cwd, { sessionManager: {
      getSessionFile: () => `${ctx.cwd}/replacement.jsonl`, getBranch: () => [],
    } }) as any;
    replacement.model = manual;
    replacement.thinkingLevel = "medium";
    api.getThinkingLevel = () => replacement.thinkingLevel;
    api.setThinkingLevel = (level: string) => { replacement.thinkingLevel = level; };
    api.setModel = async (model: unknown) => { replacement.model = model; pi.modelSelections.push(model); return true; };
    await pi.fire("session_start", { reason: "reload" }, replacement);
    assert.equal(await recovery, false);
    assert.equal(waiting!.aborted, true);
    assert.equal(replacement.model, manual);
    assert.equal(replacement.thinkingLevel, "medium");
    assert.equal(recoveryPrompts(), 0);
    await pi.fire("session_shutdown", { reason: "test-end" }, replacement);
  });
});

test("cancellation serializes restoration behind an already-started model switch", async () => {
  await withDrafter({ drafterModel: "test/selected", drafterModelFallbacks: ["test/backup"], drafterThinkingLevel: "low" }, async ({ ctx, backup, session, api }) => {
    const select = api.setModel;
    let finishSwitch!: () => void;
    api.setModel = (model: unknown) => model === backup
      ? new Promise<boolean>(resolve => { finishSwitch = () => { (ctx as any).model = backup; pi.modelSelections.push(backup); resolve(true); }; })
      : select(model);
    const recovery = recoverDraft(ctx, immediateRetry);
    await Promise.resolve();
    assert.ok(finishSwitch);
    const cancellation = pi.command("goal", "start cancel delayed switch — done when: pinned", ctx);
    finishSwitch();
    await cancellation;
    assert.equal(await recovery, false);
    assert.equal(ctx.model, session);
    assert.equal(ctx.thinkingLevel, "max");
    assert.equal(recoveryPrompts(), 0);
  });
});

test("restoration preserves a deliberate thinking-only change by the user", async () => {
  await withDrafter({ drafterModel: "test/selected", drafterThinkingLevel: "low" }, async ({ ctx, session }) => {
    (ctx as any).thinkingLevel = "medium";
    await restoreDraft();
    assert.equal(ctx.model, session);
    assert.equal(ctx.thinkingLevel, "medium");
  });
});

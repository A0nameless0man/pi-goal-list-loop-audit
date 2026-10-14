import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import activate, { __testOnlyResetOwnerSession, __testOnlyResetStaleFlag } from "../extensions/loops/goal.js";
import { __testOnlyLoopInfrastructureScheduler, clearLoopTimer, runLoopTick, scheduleLoopTick } from "../extensions/goal-loop.js";
import { state, replaceState, persistStateLine } from "../extensions/goal-state.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, seedLoop, seedState, tmpCwd } from "./harness/mock-pi.js";

async function fixture(kind?: "audit", autoResume = true) {
  const cwd = tmpCwd(), pi = new MockPi();
  fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ autoResume }));
  __testOnlyResetOwnerSession(); __testOnlyResetStaleFlag(); activate(pi.api);
  seedState(cwd, { loop: seedLoop({ target: "recover metric", kind, measureCmd: "echo metric", direction: "max", maxIterations: 0, bestValue: 10, lastValue: 10, iteration: 1, stallCount: 2, consecutiveStuck: 2, history: [{ iteration: 1, value: 10, improved: true, at: new Date().toISOString() }] }) });
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `infra-${Math.random()}` } });
  let now = Date.now();
  const timers: { callback: () => void; delay: number; handle: NodeJS.Timeout }[] = [];
  const restore = __testOnlyLoopInfrastructureScheduler(() => now, (callback, delay) => {
    const handle = setTimeout(() => {}, 1_000_000); handle.unref(); timers.push({ callback, delay, handle }); return handle;
  });
  await pi.fire("session_start", { reason: "reload" }, ctx);
  clearLoopTimer(); timers.length = 0; pi.sent.length = 0;
  let calls = 0, healthy = false;
  pi.execHandler = (cmd) => {
    if (cmd !== "bash") return { code: 0, stdout: "", stderr: "" };
    calls++;
    if (!healthy && calls % 3 === 0) throw new Error("transport/auth configuration unavailable");
    if (!healthy && calls % 3 === 1) return {} as any;
    return { code: healthy ? 0 : 1, stdout: healthy ? "11" : "999", stderr: "" };
  };
  return { cwd, pi, ctx: ctx as unknown as ExtensionContext, timers, calls: () => calls, now: () => now, due: () => { now = state.loop!.infrastructureRetry!.nextRetryAt; }, healthy: () => { healthy = true; }, close: async () => { clearLoopTimer(); for (const t of timers) clearTimeout(t.handle); restore(); await pi.fire("session_shutdown", {}, ctx); } };
}

async function settle() { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); }

for (const kind of [undefined, "audit"] as const) test(`${kind ?? "metric"} actual adapter survives 2105 infrastructure episodes then productive recovery`, async () => {
  const f = await fixture(kind);
  const original = JSON.parse(JSON.stringify(state.loop));
  try {
    for (let i = 0; i < 2105; i++) {
      await runLoopTick(f.ctx);
      assert.equal(f.calls(), i + 1);
      const loop = state.loop!;
      assert.equal(loop.active, true);
      assert.equal(loop.iteration, original.iteration);
      assert.equal(loop.bestValue, original.bestValue);
      assert.equal(loop.lastValue, original.lastValue);
      assert.equal(loop.stallCount, original.stallCount);
      assert.equal(loop.consecutiveStuck, original.consecutiveStuck);
      assert.deepEqual(loop.history, original.history);
      assert.equal(loop.infrastructureRetry!.failures, i + 1);
      assert.ok(f.timers.at(-1)!.delay <= 300_000);
      await runLoopTick(f.ctx); // an early duplicate wake cannot measure
      assert.equal(f.calls(), i + 1);
      if (i % 500 === 0) {
        replaceState(readState(f.cwd));
        scheduleLoopTick(f.ctx);
        assert.equal(f.timers.at(-1)!.delay, state.loop!.infrastructureRetry!.nextRetryAt - f.now());
      }
      f.due();
    }
    f.healthy();
    const wake = f.timers.at(-1)!;
    wake.callback(); wake.callback();
    await settle();
    assert.equal(f.calls(), 2106, "one due callback owns exactly one measurement");
    const saved = readState(f.cwd).loop!;
    assert.equal(saved.iteration, 2);
    assert.equal(saved.bestValue, 11);
    assert.equal(saved.history.length, 2);
    assert.equal(saved.infrastructureRetry, undefined);
    assert.equal(saved.active, true);
  } finally { await f.close(); }
});

test("provider errors retain existing main-model recovery and recover without numeric accounting", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 20; i++) {
      await f.pi.fire("agent_end", { messages: [{ role: "assistant", stopReason: "error", errorMessage: "unknown provider failure", content: [] }] }, f.ctx);
      assert.equal(state.loop!.iteration, 1);
      assert.equal(state.loop!.history.length, 1);
      assert.ok(state.mainModelRecovery, "existing main-model owner retains the provider wait");
      assert.equal(state.mainModelRecovery!.manualResumeRequired, undefined);
    }
    f.healthy();
    await f.pi.fire("agent_end", { messages: [{ role: "assistant", stopReason: "end_turn", content: [{ type: "text", text: "Implemented and verified a productive recovery." }] }] }, f.ctx);
    assert.equal(readState(f.cwd).loop!.bestValue, 11);
    assert.equal(readState(f.cwd).loop!.infrastructureRetry, undefined);
  } finally { await f.close(); }
});

test("loop error fallback outside main-model eligibility has pacing instead of count cutoff", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 20; i++) {
      await f.pi.fire("agent_end", { messages: [{ role: "assistant", stopReason: "error", errorMessage: "output token limit exceeded", content: [] }] }, f.ctx);
      assert.equal(state.loop!.active, true);
      assert.equal(state.loop!.iteration, 1);
      assert.equal(state.loop!.infrastructureRetry!.failures, i + 1);
      assert.equal(state.loop!.infrastructureRetryKind, "provider");
      f.due();
    }
  } finally { await f.close(); }
});

test("queued metric callbacks obey freeze, stop and bounds, and superseded callbacks cannot run", async () => {
  const f = await fixture();
  try {
    await runLoopTick(f.ctx);
    const stale = f.timers.at(-1)!;
    scheduleLoopTick(f.ctx);
    f.due(); stale.callback(); await settle(); assert.equal(f.calls(), 1);
    const current = f.timers.at(-1)!;
    replaceState({ ...state, supervisorPausedAt: Date.now() });
    current.callback(); await settle(); assert.equal(f.calls(), 1);
    replaceState({ ...state, supervisorPausedAt: undefined });
    scheduleLoopTick(f.ctx);
    replaceState({ ...state, loop: { ...state.loop!, active: false, stopReason: "stopped by user" } });
    f.timers.at(-1)!.callback(); await settle(); assert.equal(f.calls(), 1);
    replaceState({ ...state, loop: { ...state.loop!, active: true, tokenBudget: 0 } });
    scheduleLoopTick(f.ctx); f.timers.at(-1)!.callback(); await settle();
    assert.equal(f.calls(), 1);
    assert.equal(readState(f.cwd).loop!.active, false);
    assert.match(readState(f.cwd).loop!.stopReason!, /token budget exhausted/);
  } finally { await f.close(); }
});

test("a stale async measurement after refinement cannot attach a reading or git regression", async () => {
  const f = await fixture();
  try {
    let finish!: (value: any) => void;
    const git: string[][] = [];
    f.pi.execHandler = (cmd, args) => cmd === "bash" ? new Promise(resolve => { finish = resolve; }) : (git.push(args), { code: 0, stdout: "", stderr: "" });
    const pending = runLoopTick(f.ctx);
    replaceState({ ...state, loop: { ...state.loop!, measureCmd: "new metric" } });
    finish({ code: 0, stdout: "1", stderr: "" }); await pending;
    assert.equal(state.loop!.lastValue, 10);
    assert.equal(state.loop!.iteration, 1);
    assert.deepEqual(git, []);
  } finally { await f.close(); }
});

for (const mode of ["future", "overdue", "cold"] as const) test(`metric ${mode} lifecycle reload respects saved due date and consent`, async () => {
  const f = await fixture();
  try {
    await runLoopTick(f.ctx);
    if (mode === "overdue") f.due();
    await f.pi.fire("session_shutdown", {}, f.ctx);
    f.timers.length = 0;
    fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ autoResume: mode !== "cold" }));
    __testOnlyResetOwnerSession(); __testOnlyResetStaleFlag();
    f.healthy();
    await f.pi.fire("session_start", { reason: "startup" }, f.ctx);
    if (mode === "cold") {
      assert.equal(state.loop!.active, false);
      assert.equal(f.timers.length, 0);
      await runLoopTick(f.ctx); assert.equal(f.calls(), 1);
    } else {
      assert.equal(state.loop!.active, true);
      assert.equal(f.timers.at(-1)!.delay, mode === "overdue" ? 0 : state.loop!.infrastructureRetry!.nextRetryAt - f.now());
      f.due();
      const wake = f.timers.at(-1)!; wake.callback(); wake.callback(); await settle();
      assert.equal(f.calls(), 2);
      assert.equal(readState(f.cwd).loop!.bestValue, 11);
    }
  } finally { await f.close(); }
});

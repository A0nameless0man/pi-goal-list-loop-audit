import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { withPressureSession, providerError } from './harness/context-pressure.js';
import { hangDeadlineMs, waitFor } from './harness/host-budget.js';
import { __testOnlyResetProcessState } from '../extensions/loops/goal.js';
import { state, persistStateLine } from '../extensions/goal-state.js';
import { readState } from '../extensions/goal-loop-core.js';
import { clearMainModelRecoveryTimer, mainModelRecoveryRuntimeStatus, probeMainModelRecovery } from '../extensions/goal-recovery.js';

// Drive registered agent_end and the real durable recovery probe, not a retry
// model. Advance only the cadence clock; no provider calls or quota requests.
// Isolate the first stress case from prior files as well as subsequent cases.
// Shared singleton timers/holds must not leak in from earlier suite fixtures.
beforeEach(() => __testOnlyResetProcessState());
afterEach(() => __testOnlyResetProcessState());

// 2101 simulated failures per mode. This is a real integration stress test:
// every iteration fires a live agent_end, persists durable recovery state and
// runs the recovery probe, so the wall-clock cost is minutes on a loaded host.
// The per-test wall-clock cap is a hang guard, not a throughput assertion.
// Apply the same measured host budget as other integration waits so a healthy
// 2101-cycle run is not abandoned mid-fixture on a contended host. All cycles,
// durable state assertions and the independent no-output watchdog remain.
//
// v0.39.52: the cap was 300s. On a host at load 50 the `goal` mode needs
// ~334s of wall time, and the budget it was given came out at ~333s — the
// CPU probe measured this process as barely slowed down (it burns its 25ms
// probe at full speed even when the machine is saturated), so the budget never
// grew for the pressure that was actually slowing the test down. The hang
// guard now takes the worse of the CPU probe and the machine's load, and the
// base is 600s so a legitimately slow run has ~13x the idle cost of the
// slowest mode (46.7s) to work with. A genuinely wedged run is still bounded:
// this test prints a heartbeat every 250 cycles, so the suite-level stall
// watchdog kills a silent suite long before this cap.
const STRESS_TEST_TIMEOUT_MS = 600_000;

for (const mode of ['goal', 'list', 'loop'] as const) {
  test(`${mode}: 2101 provider exhaustion failures preserve work then continue`, { timeout: hangDeadlineMs(STRESS_TEST_TIMEOUT_MS) }, async () => {
    await withPressureSession(async (pi, ctx, cwd) => {
      fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ autoResume: true, aggressiveMode: false, mainModelFallbacks: [], hourlyRetryProbe: false }));
      ctx.getContextUsage = () => ({ tokens: 1000, contextWindow: 272000, percent: 1 });
      const queue = [{ id: 'queued-work', objective: 'retain queued contract', verificationContract: 'queue acceptance', addedAt: new Date().toISOString() }];
      state.list = queue as typeof state.list;
      if (state.goal) state.goal = { ...state.goal, verificationContract: 'independent acceptance required' };
      persistStateLine(cwd, state);
      const originalGoal = state.goal && { id: state.goal.id, objective: state.goal.objective, verificationContract: state.goal.verificationContract };
      const originalLoop = state.loop && { startedAt: state.loop.startedAt, iteration: state.loop.iteration, history: structuredClone(state.loop.history), maxIterations: state.loop.maxIterations };
      const realNow = Date.now;
      let clock = realNow();
      Date.now = () => clock;
      try {
        for (let n = 0; n < 2101; n++) {
          await pi.fire('agent_end', providerError('Retry failed after 15 attempts: 429 rate limit exceeded'), ctx);
          const recovery = state.mainModelRecovery;
          assert.ok(recovery?.retryAt, `failure ${n} has a durable paced retry`);
          assert.equal(readState(cwd).mainModelRecovery?.retryAt, recovery.retryAt, `failure ${n} journal retains the retry deadline`);
          assert.equal(mainModelRecoveryRuntimeStatus()?.retryTimerArmed, true);
          assert.equal(recovery.manualResumeRequired, undefined);
          assert.ok(Date.parse(recovery.retryAt) > clock);
          assert.equal(mode === 'loop' ? state.loop?.active : state.goal?.status === 'active', false);
          clock = Date.parse(recovery.retryAt);
          clearMainModelRecoveryTimer();
          await probeMainModelRecovery(ctx as unknown as ExtensionContext);
          assert.equal(mode === 'loop' ? state.loop?.active : state.goal?.status === 'active', true);
          // Emit bounded progress ONLY after real durable assertions pass.
          // The suite's independent silence watchdog still terminates a stuck
          // event/probe; never substitute timer output or reduce 2101 cycles.
          if (n === 0 || (n + 1) % 250 === 0 || n === 2100) {
            console.error(`[provider-exhaustion] ${mode}: ${n + 1}/2101 durable failure/probe cycles verified`);
          }
        }
        assert.ok(state.mainModelRecovery!.attempts > 2100);
        assert.ok(clock - realNow() > 24 * 3600000, 'episode outlives the legacy horizon');
        if (originalLoop) assert.deepEqual({ startedAt: readState(cwd).loop?.startedAt, iteration: readState(cwd).loop?.iteration, history: readState(cwd).loop?.history, maxIterations: readState(cwd).loop?.maxIterations }, originalLoop, 'all dead turns preserve loop history and bounds');
        // Provider recovery alone is not numeric evidence: the healthy loop
        // measurement must also return a verified reading.
        if (mode === 'loop') pi.execHandler = () => ({ code: 0, stdout: '2\n', stderr: '' });
        await pi.fire('tool_call', {}, ctx);
        await pi.fire('agent_end', { messages: [{ role: 'assistant', stopReason: 'end_turn', content: [{ type: 'text', text: 'The provider is healthy again. Continuing the retained work; independent acceptance is still required.' }] }] }, ctx);
        const saved = readState(cwd);
        assert.equal(saved.mainModelRecovery, undefined);
        assert.deepEqual(saved.list, queue);
        if (originalGoal) assert.deepEqual({ id: saved.goal?.id, objective: saved.goal?.objective, verificationContract: saved.goal?.verificationContract }, originalGoal);
        if (originalLoop) {
          assert.equal(saved.loop?.startedAt, originalLoop.startedAt);
          assert.equal(saved.loop?.maxIterations, originalLoop.maxIterations);
          assert.equal(saved.loop?.iteration, originalLoop.iteration + 1, 'only the healthy registered event consumes an iteration');
          assert.deepEqual(saved.loop?.history.slice(0, originalLoop.history.length), originalLoop.history);
          assert.equal(saved.loop?.history.length, originalLoop.history.length + 1, 'healthy work appends exactly one measurement');
        }
      } finally { Date.now = realNow; }
      // v0.39.52: this used to sleep a fixed 1200ms and then assert the
      // continuation had been sent. On a busy host the send lands later than
      // that and a healthy recovery was reported as a failure. Wait for the
      // effect instead of guessing how long it takes.
      await waitFor(() => pi.sent.length > 0, {
        timeoutMs: 30_000,
        message: 'successful recovery delivers the retained work continuation',
      });
    }, mode);
  });
}

test('provider probe cannot unpause a stored completion claim', async () => {
  await withPressureSession(async (_pi, ctx, cwd) => {
    fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ aggressiveMode: false, mainModelFallbacks: [], hourlyRetryProbe: false }));
    const claim = { at: new Date().toISOString(), phase: 'retry-waiting', summary: 'unverified claim' };
    state.goal = { ...state.goal!, status: 'paused', pauseKind: 'wait', pauseReason: 'main model recovery', pendingCompletion: claim as NonNullable<typeof state.goal>['pendingCompletion'] };
    state.mainModelRecovery = { primary: 'provider/primary', active: 'provider/primary', attempted: ['provider/primary'], attempts: 2101, kind: 'goal', reason: 'provider unavailable', owner: { kind: 'goal', id: state.goal.id } };
    persistStateLine(cwd, state);
    await probeMainModelRecovery(ctx as unknown as ExtensionContext);
    assert.equal(readState(cwd).goal?.status, 'paused');
    assert.deepEqual(JSON.parse(JSON.stringify(readState(cwd).goal?.pendingCompletion)), claim);
  });
});

for (const bound of ['iterations', 'time', 'tokens'] as const) {
  test(`loop: healthy recovery still enforces the retained ${bound} bound`, async () => {
    await withPressureSession(async (pi, ctx, cwd) => {
      fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ autoResume: true, aggressiveMode: false, mainModelFallbacks: [], hourlyRetryProbe: false }));
      ctx.getContextUsage = () => ({ tokens: 1000, contextWindow: 272000, percent: 1 });
      pi.execHandler = () => ({ code: 0, stdout: '2\n', stderr: '' });
      state.loop = {
        ...state.loop!, maxIterations: bound === 'iterations' ? 2 : 0,
        ...(bound === 'time' ? { timeLimitHours: 1, startedAt: new Date(Date.now() - 2 * 3600000).toISOString() } : {}),
        ...(bound === 'tokens' ? { tokenBudget: 100, tokensUsed: 100 } : {}),
      };
      persistStateLine(cwd, state);
      await pi.fire('agent_end', providerError('429 rate limit exceeded'), ctx);
      assert.equal(readState(cwd).loop?.iteration, 1, 'provider failure is not productive work');
      clearMainModelRecoveryTimer();
      await probeMainModelRecovery(ctx as unknown as ExtensionContext);
      await pi.fire('tool_call', {}, ctx);
      await pi.fire('agent_end', { messages: [{ role: 'assistant', stopReason: 'end_turn', content: [{ type: 'text', text: 'Verified the retained target with fresh independent evidence after the healthy provider probe.' }] }] }, ctx);
      // v0.39.52: this used to sleep a fixed 150ms and then assert the
      // recovery had settled. Same defect as the fixed 1200ms sleep above —
      // wait for the condition rather than assuming a wall time.
      await waitFor(() => readState(cwd).mainModelRecovery === undefined, {
        timeoutMs: 30_000,
        message: 'healthy provider settles the recovery',
      });
      const saved = readState(cwd);
      assert.equal(saved.mainModelRecovery, undefined, 'healthy provider settles the recovery');
      assert.equal(saved.loop?.active, false, 'recovery never removes the original work bound');
      assert.match(saved.loop?.stopReason ?? '', bound === 'iterations' ? /max iterations reached/ : bound === 'time' ? /time bound reached/ : /token budget exhausted/);
    }, 'loop');
  });
}

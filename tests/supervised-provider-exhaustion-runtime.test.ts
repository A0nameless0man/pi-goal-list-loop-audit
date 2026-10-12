import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { withPressureSession, providerError } from './harness/context-pressure.js';
import { tick } from './harness/mock-pi.js';
import { state, persistStateLine } from '../extensions/goal-state.js';
import { readState } from '../extensions/goal-loop-core.js';
import { clearMainModelRecoveryTimer, mainModelRecoveryRuntimeStatus, probeMainModelRecovery, mainModelRecoverySucceeded } from '../extensions/goal-recovery.js';

// Drive registered agent_end and the real durable recovery probe, not a retry
// model. Advance only the cadence clock; no provider calls or quota requests.
for (const mode of ['goal', 'list', 'loop'] as const) {
  test(`${mode}: 2101 provider exhaustion failures preserve work then continue`, async () => {
    await withPressureSession(async (pi, ctx, cwd) => {
      fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ autoResume: true, aggressiveMode: false, mainModelFallbacks: [], hourlyRetryProbe: false }));
      ctx.getContextUsage = () => ({ tokens: 1000, contextWindow: 272000, percent: 1 });
      const queue = [{ id: 'queued-work', objective: 'retain queued contract', verificationContract: 'queue acceptance', status: 'queued' }];
      state.list = queue as typeof state.list;
      if (state.goal) state.goal = { ...state.goal, verificationContract: 'independent acceptance required' };
      persistStateLine(cwd, state);
      const originalGoal = state.goal && { id: state.goal.id, objective: state.goal.objective, verificationContract: state.goal.verificationContract };
      const originalLoop = state.loop && { startedAt: state.loop.startedAt, iteration: state.loop.iteration, history: state.loop.history, maxIterations: state.loop.maxIterations };
      const realNow = Date.now;
      let clock = realNow();
      Date.now = () => clock;
      try {
        for (let n = 0; n < 2101; n++) {
          await pi.fire('agent_end', providerError('Retry failed after 15 attempts: 429 rate limit exceeded'), ctx);
          const recovery = state.mainModelRecovery;
          assert.ok(recovery?.retryAt, `failure ${n} has a durable paced retry`);
          assert.equal(mainModelRecoveryRuntimeStatus()?.retryTimerArmed, true);
          assert.equal(recovery.manualResumeRequired, undefined);
          assert.ok(Date.parse(recovery.retryAt) > clock);
          assert.equal(mode === 'loop' ? state.loop?.active : state.goal?.status === 'active', false);
          clock = Date.parse(recovery.retryAt);
          clearMainModelRecoveryTimer();
          await probeMainModelRecovery(ctx as unknown as ExtensionContext);
          assert.equal(mode === 'loop' ? state.loop?.active : state.goal?.status === 'active', true);
        }
        assert.ok(state.mainModelRecovery!.attempts > 2100);
        assert.ok(clock - realNow() > 24 * 3600000, 'episode outlives the legacy horizon');
        mainModelRecoverySucceeded(ctx as unknown as ExtensionContext);
        const saved = readState(cwd);
        assert.equal(saved.mainModelRecovery, undefined);
        assert.deepEqual(saved.list, queue);
        if (originalGoal) assert.deepEqual({ id: saved.goal?.id, objective: saved.goal?.objective, verificationContract: saved.goal?.verificationContract }, originalGoal);
        if (originalLoop) assert.deepEqual({ startedAt: saved.loop?.startedAt, iteration: saved.loop?.iteration, history: saved.loop?.history, maxIterations: saved.loop?.maxIterations }, originalLoop);
      } finally { Date.now = realNow; }
      await tick(1200);
      assert.ok(pi.sent.length > 0, 'successful recovery delivers the retained work continuation');
    }, mode);
  });
}

test('provider probe cannot unpause a stored completion claim', async () => {
  await withPressureSession(async (_pi, ctx, cwd) => {
    fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ aggressiveMode: false, mainModelFallbacks: [], hourlyRetryProbe: false }));
    const claim = { at: new Date().toISOString(), phase: 'retry-waiting', summary: 'unverified claim' };
    state.goal = { ...state.goal!, status: 'paused', pauseKind: 'wait', pauseReason: 'main model recovery', pendingCompletion: claim as typeof state.goal.pendingCompletion };
    state.mainModelRecovery = { primary: 'provider/primary', active: 'provider/primary', attempted: ['provider/primary'], attempts: 2101, kind: 'goal', reason: 'provider unavailable', owner: { kind: 'goal', id: state.goal.id } };
    persistStateLine(cwd, state);
    await probeMainModelRecovery(ctx as unknown as ExtensionContext);
    assert.equal(readState(cwd).goal?.status, 'paused');
    assert.deepEqual(readState(cwd).goal?.pendingCompletion, claim);
  });
});

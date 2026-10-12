import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { withPressureSession, providerError } from './harness/context-pressure.js';
import { tick } from './harness/mock-pi.js';
import { state, persistStateLine } from '../extensions/goal-state.js';
import { readState } from '../extensions/goal-loop-core.js';
import { clearMainModelRecoveryTimer, mainModelRecoveryRuntimeStatus, probeMainModelRecovery, scheduleMainModelRecoveryTimer, mainModelRecoverySucceeded } from '../extensions/goal-recovery.js';

for (const mode of ['goal', 'list', 'loop'] as const) {
  test(`${mode}: reload preserves recovery ownership and queue, consent and pause fence probes`, async () => {
    await withPressureSession(async (pi, ctx, cwd) => {
      const settings = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
      const configure = (autoResume: boolean) => fs.writeFileSync(settings, JSON.stringify({ autoResume, aggressiveMode: false, mainModelFallbacks: [], hourlyRetryProbe: false }));
      configure(true);
      ctx.getContextUsage = () => ({ tokens: 1000, contextWindow: 272000, percent: 1 });
      state.list = [{ id: 'queued', objective: 'queue survives reload', verificationContract: 'queue evidence' }] as typeof state.list;
      if (state.goal) state.goal = { ...state.goal, verificationContract: 'retained acceptance' };
      persistStateLine(cwd, state);
      await pi.fire('agent_end', providerError('Retry failed after 15 attempts: 429 rate limit exceeded'), ctx);
      const retained = JSON.parse(JSON.stringify(readState(cwd)));
      assert.ok(retained.mainModelRecovery?.owner);
      configure(false);
      await pi.fire('session_start', { reason: 'reload' }, ctx);
      assert.deepEqual(readState(cwd).mainModelRecovery?.owner, retained.mainModelRecovery.owner);
      assert.equal(mainModelRecoveryRuntimeStatus()?.retryTimerArmed, false, 'cold reload requires consent');
      await probeMainModelRecovery(ctx as unknown as ExtensionContext);
      assert.equal(mode === 'loop' ? state.loop?.active : state.goal?.status === 'active', false);
      assert.equal(pi.sent.length, 0);
      configure(true);
      await pi.fire('session_start', { reason: 'reload' }, ctx);
      assert.equal(mainModelRecoveryRuntimeStatus()?.retryTimerArmed, true, 'consented reload restores timer');
      await pi.command('glla', 'pause', ctx);
      await probeMainModelRecovery(ctx as unknown as ExtensionContext);
      assert.equal(mode === 'loop' ? state.loop?.active : state.goal?.status === 'active', false);
      assert.equal(pi.sent.length, 0);
      const saved = JSON.parse(JSON.stringify(readState(cwd)));
      assert.deepEqual(saved.goal, retained.goal);
      assert.deepEqual(saved.loop, retained.loop);
      assert.deepEqual(saved.list, retained.list);
      await pi.command(mode, mode === 'loop' ? 'stop' : 'cancel', ctx);
      assert.equal(readState(cwd).mainModelRecovery, undefined);
      assert.equal(mainModelRecoveryRuntimeStatus()?.retryTimerArmed, false);
      await tick(30);
      assert.equal(pi.sent.length, 0);
    }, mode);
  });
}

test('a dequeued old timer cannot probe a replacement recovery episode', async () => {
  await withPressureSession(async (pi, ctx, cwd) => {
    fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ aggressiveMode: false, mainModelFallbacks: [], hourlyRetryProbe: false }));
    state.goal = { ...state.goal!, status: 'paused', pauseKind: 'wait', pauseReason: 'main model recovery' };
    state.mainModelRecovery = { primary: 'provider/primary', active: 'provider/primary', attempted: ['provider/primary'], attempts: 2101, kind: 'goal', reason: 'provider unavailable', firstFailureAt: new Date().toISOString(), recoveryEpisodeKey: 'old', owner: { kind: 'goal', id: state.goal.id }, retryAt: new Date(Date.now() + 3600000).toISOString() };
    persistStateLine(cwd, state);
    const realTimeout = globalThis.setTimeout;
    let dequeued!: () => void;
    globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      if (delay && delay > 1000) dequeued = () => callback(...args);
      return realTimeout(callback, delay, ...args);
    }) as typeof setTimeout;
    try { scheduleMainModelRecoveryTimer(ctx as unknown as ExtensionContext, 3600000); }
    finally { globalThis.setTimeout = realTimeout; }
    assert.ok(dequeued);
    clearMainModelRecoveryTimer();
    state.mainModelRecovery = { ...state.mainModelRecovery, recoveryEpisodeKey: 'replacement' };
    persistStateLine(cwd, state);
    const before = JSON.parse(JSON.stringify(readState(cwd)));
    dequeued();
    await tick(30);
    assert.deepEqual(JSON.parse(JSON.stringify(readState(cwd))), before);
    assert.equal(pi.sent.length, 0);
    assert.equal(pi.modelSelections.length, 0);
  });
});

test('late successful settlement cannot adopt a replaced goal owner', async () => {
  await withPressureSession(async (pi, ctx, cwd) => {
    state.goal = { ...state.goal!, status: 'paused', pauseKind: 'wait', pauseReason: 'main model recovery', verificationContract: 'new owner acceptance' };
    state.mainModelRecovery = { primary: 'provider/primary', active: 'provider/primary', attempted: ['provider/primary'], attempts: 2101, kind: 'goal', reason: 'provider unavailable', owner: { kind: 'goal', id: 'replaced-owner' } };
    persistStateLine(cwd, state);
    const goal = JSON.parse(JSON.stringify(readState(cwd).goal));
    mainModelRecoverySucceeded(ctx as unknown as ExtensionContext);
    assert.equal(readState(cwd).mainModelRecovery, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(readState(cwd).goal)), goal);
    await tick(30);
    assert.equal(pi.sent.length, 0);
  });
});

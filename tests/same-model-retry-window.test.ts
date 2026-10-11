import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { sameModelRetryDeadline, sameModelRetryPhaseActive, classifyMainModelFailure } from '../extensions/main-model-recovery.js';
import { sanitizeMainModelRecovery } from '../extensions/goal-loop-core.js';
import { createGoalRecovery, parkMainModelAfterFailure, probeMainModelRecovery, scheduleMainModelRecoveryTimer } from '../extensions/goal-recovery.js';
import { state, replaceState } from '../extensions/goal-state.js';
import { globalSettingsPath } from '../extensions/goal-settings.js';
import { buildWidgetLines } from '../extensions/goal-loop-display.js';

const now = Date.parse('2026-10-11T14:00:00Z');
test('count and time bound primary retries independently; no candidate preserves paced retry', () => {
  const recovery = { sameModelRetries: 2, sameModelPhaseStartedAt: new Date(now - 180_000).toISOString() };
  assert.equal(sameModelRetryPhaseActive(recovery, 10, true, now), false);
  assert.equal(sameModelRetryPhaseActive(recovery, 10, false, now), true);
  assert.equal(sameModelRetryPhaseActive({ ...recovery, sameModelPhaseStartedAt: new Date(now).toISOString() }, 10, true, now), true);
  assert.equal(sameModelRetryPhaseActive({ sameModelRetries: 10 }, 10, true, now), false);
  assert.equal(sameModelRetryPhaseActive(undefined, 0, true, now), false);
  assert.equal(sameModelRetryDeadline({ firstFailureAt: new Date(now).toISOString() }), now + 120_000, 'legacy episode age anchors initial primary phase');
});

test('bounded recovery card states retry progress and fallback eligibility without claiming a successful switch', () => {
  const fixture: any = { list: [], goal: { id: 'ui', objective: 'work', policy: 'goal', status: 'paused', pauseKind: 'wait', pauseSource: 'system', pauseReason: 'main model recovery', createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), usage: { tokensUsed: 0, tokensLimit: 1000000 } },
    mainModelRecovery: { primary: 'provider/free', active: 'provider/free', attempted: ['provider/free'], attempts: 3, sameModelRetries: 2,
      sameModelPhaseStartedAt: new Date(now - 180_000).toISOString(), kind: 'goal', owner: { kind: 'goal', id: 'ui' }, reason: 'provider error', retryAt: new Date(now + 1000).toISOString() } };
  const extras = { uiStatusContext: { now }, mainModelSameModelRetries: 10, mainModelFallbacks: ['provider/forbidden', 'provider/backup'], modelProvenance: { skippedForbiddenRefs: ['provider/forbidden'] } };
  const lines = buildWidgetLines(fixture, undefined, now, undefined, 200, extras)!;
  assert.ok(lines.length <= 8);
  assert.match(lines.join('\n'), /retry: same model 2\/10/);
  assert.match(lines.join('\n'), /fallback: eligible now.*next candidate provider\/backup/);
  assert.doesNotMatch(lines.join('\n'), /next candidate provider\/forbidden|switched to/);
});

test('real recovery clamps reset waits, rotates after slow failures, and restores old long waits', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'glla-retry-window-'));
  const settingsPath = globalSettingsPath();
  const original = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : undefined;
  const calls: string[] = [], timers: number[] = [];
  const ctx: any = { cwd, model: { provider: 'provider', id: 'free' },
    modelRegistry: { find: (provider: string, id: string) => ({ provider, id, reasoning: true }), hasConfiguredAuth: () => true },
    ui: { notify: () => {} }, abort: () => {} };
  const flags: any = { sessionGeneration: 1, mainModelRecoveryTimer: null, hourlyProbeTimer: null, hourlyProbeFireAt: null,
    extensionApi: { setModel: async (model: any) => { calls.push(`${model.provider}/${model.id}`); ctx.model = model; return true; }, getThinkingLevel: () => 'high', setThinkingLevel: () => {} } };
  try {
    fs.writeFileSync(settingsPath, JSON.stringify({ mainModelFallbacks: ['provider/backup'], mainModelSameModelRetries: 10, hourlyRetryProbe: false }));
    replaceState({ goal: { id: 'window', status: 'active', objective: 'work', tasks: [], startedAt: new Date().toISOString() }, loop: null } as any);
    createGoalRecovery(flags, { activeGoalSurfaceCommand: (c: string) => `/goal ${c}`, clearDetachedAuditRuntime: () => {},
      updateGoal: (patch: any) => { Object.assign(state.goal!, patch); return true; }, clearContinuationTimer: () => {},
      freshCtxForGeneration: () => ctx, isSupervising: () => true, notifyExternal: () => {}, persistState: () => {},
      recoverySurfaceCommand: (_k: string, c: string) => `/goal ${c}`, scheduleContinuation: () => {},
      scheduleSessionTimeout: (_fn: () => void, ms: number) => { timers.push(ms); return null; } } as any);
    parkMainModelAfterFailure(ctx, classifyMainModelFailure('429 Rate limit exceeded. Retry-After: 14400'));
    assert.equal(state.goal?.status, 'paused');
    assert.ok(timers.length && timers.every(ms => ms <= 120_000), 'a primary reset hint must not postpone testing an independent backup for hours');
    assert.ok(Date.parse(state.mainModelRecovery!.retryAt!) - Date.now() <= 120_000);
    assert.equal(state.goal?.pauseResumeAt, state.mainModelRecovery!.retryAt, 'durable goal and recovery agree with the bounded timer');
    const start = new Date(Date.now() - 180_000).toISOString();
    state.mainModelRecovery = { ...state.mainModelRecovery!, sameModelPhaseStartedAt: start, sameModelRetries: 2,
      firstFailureAt: start, retryAt: new Date(Date.now() + 3_600_000).toISOString() };
    state.goal!.pauseResumeAt = state.mainModelRecovery.retryAt;
    timers.length = 0;
    scheduleMainModelRecoveryTimer(ctx, 3_600_000);
    assert.deepEqual(timers, [1000], 'reload of a legacy long wait reaches the backup gate promptly');
    assert.ok(Date.parse(state.mainModelRecovery.retryAt!) - Date.now() <= 1000);
    assert.equal(state.goal!.pauseResumeAt, state.mainModelRecovery.retryAt);
    const previous = Date.now();
    await probeMainModelRecovery(ctx);
    assert.deepEqual(calls, ['provider/backup'], 'two slow failures may exhaust elapsed time without consuming all ten retries');
    assert.equal(state.mainModelRecovery?.sameModelRetries, 0);
    assert.ok(Date.parse(state.mainModelRecovery!.sameModelPhaseStartedAt!) >= previous, 'backup owns a fresh phase, not primary age');
    assert.equal(state.goal!.status, 'active');
    const restored = sanitizeMainModelRecovery(state.mainModelRecovery);
    assert.equal(restored?.sameModelPhaseStartedAt, state.mainModelRecovery!.sameModelPhaseStartedAt);
  } finally {
    replaceState({ goal: null, loop: null } as any);
    if (original === undefined) fs.rmSync(settingsPath, { force: true }); else fs.writeFileSync(settingsPath, original);
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

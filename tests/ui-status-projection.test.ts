import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { State } from '../extensions/goal-loop-core.js';
import { buildUiStatusCard, buildUiStatusFooter } from '../extensions/goal-loop-display.js';
import { projectUiStatus, uiStatusOwnerKey, type UiStatusEvidence } from '../extensions/ui-status.js';

const NOW = Date.parse('2026-10-10T12:00:00Z');
function fixture(): State {
  return { goal: { id: 'ui-owner', objective: 'UI fixture', status: 'active', policy: 'goal',
    autoContinue: true, usage: { tokensUsed: 0, tokensLimit: 1_000_000 },
    createdAt: new Date(NOW).toISOString(), updatedAt: new Date(NOW).toISOString() }, list: [] };
}
function observed(state: State, patch: Partial<UiStatusEvidence> = {}): UiStatusEvidence {
  return { ownerKey: uiStatusOwnerKey(state)!, generation: 2, session: 'open', observedAt: NOW, ...patch };
}
function recovery(state: State): void {
  state.mainModelRecovery = { primary: 'provider/model', active: 'provider/model', attempted: [], attempts: 6,
    kind: 'goal', owner: { kind: 'goal', id: state.goal!.id }, reason: 'Rate limit', retryAt: new Date(NOW + 5 * 3600_000).toISOString() };
}

test('scheduled external assessment requires current-owner heartbeat registration', () => {
  const state = fixture();
  const at = new Date(NOW + 600_000).toISOString();
  Object.assign(state.goal!, { status: 'paused', pauseKind: 'wait', pauseResumeAt: at });
  const registered = observed(state, { scheduledCheck: { resumeAt: at, heartbeatArmed: true } });
  const live = projectUiStatus(state, { now: NOW, generation: 2, evidence: registered });
  assert.equal(live.execution, 'waiting');
  assert.equal(live.actionability, 'automatic');
  assert.equal(live.checkAt, at);
  assert.match(live.nextAction, /progress, not completion/);
  for (const width of [40, 120]) for (const compact of [true, false]) {
    const card = buildUiStatusCard(state, live, NOW, undefined, width, compact).join('\n');
    assert.match(card, /WAITING/);
    assert.match(card.replace(/\s+/g, ' '), /check: 10 Oct 2026,.*12:10 UTC/);
    if (!compact) assert.match(card, /wake: GLLA assessment heartbeat/);
    else assert.doesNotMatch(card, /wake: GLLA assessment heartbeat/);
    assert.doesNotMatch(card, /BLOCKED|paused by/);
    assert.match(buildUiStatusFooter(live, NOW, undefined, width), /WAITING/);
  }
  for (const patch of [
    { scheduledCheck: undefined },
    { scheduledCheck: { resumeAt: at, heartbeatArmed: false } },
    { scheduledCheck: { resumeAt: new Date(NOW).toISOString(), heartbeatArmed: true } },
    { observedAt: NOW - 31_000 }, { ownerKey: 'goal:other' }, { generation: 1 },
  ]) {
    assert.equal(projectUiStatus(state, { now: NOW, generation: 2,
      evidence: { ...registered, ...patch } }).execution, 'unconfirmed');
  }
  assert.equal(projectUiStatus(state, { now: NOW }).execution, 'unconfirmed');
  for (const patch of [{ supervisorPausedAt: NOW }, { loadHoldAt: NOW }]) {
    assert.equal(projectUiStatus({ ...state, ...patch }, { now: NOW, generation: 2,
      evidence: registered }).execution, 'blocked');
  }
  assert.equal(projectUiStatus(state, { now: NOW, generation: 2,
    evidence: registered, persistenceHold: 'writes failing' }).execution, 'blocked');
});

test('unconfirmed saved checks keep a human time in compact and detailed cards', () => {
  const state = fixture();
  const at = new Date(NOW + 600_000).toISOString();
  Object.assign(state.goal!, { status: 'paused', pauseKind: 'wait', pauseResumeAt: at });
  const registered = observed(state, { scheduledCheck: { resumeAt: at, heartbeatArmed: true } });
  // A reopened session has no runtime sample; stale or mismatched samples
  // must use the same readable fallback without implying an armed wake.
  for (const evidence of [undefined,
    { ...registered, observedAt: NOW - 31_000 },
    { ...registered, ownerKey: 'goal:other' },
    { ...registered, generation: 1 },
    { ...registered, session: 'closed' as const },
  ]) {
    const status = projectUiStatus(state, { now: NOW, generation: 2, evidence });
    assert.equal(status.execution, 'unconfirmed');
    assert.equal(status.actionability, 'inspect');
    assert.equal(status.checkAt, at, 'the durable timestamp stays machine-readable');
    assert.match(status.nextAction, /10 Oct 2026, 12:10 UTC/);
    assert.match(status.nextAction, /unconfirmed/);
    assert.doesNotMatch(status.nextAction, /2026-10-10T|No action needed/);
    for (const width of [40, 120]) for (const compact of [true, false]) {
      const card = buildUiStatusCard(state, status, NOW, undefined, width, compact).join('\n');
      // Wrapped lines have rail glyphs; normalize only those display glyphs.
      const text = card.replace(/[│├─└]/g, ' ').replace(/\s+/g, ' ');
      assert.match(text, /10 Oct 2026, 12:10 UTC/);
      assert.match(text, /unconfirmed/i);
      assert.match(text, /\/glla status/);
      assert.doesNotMatch(text, /2026-10-10T|No action needed/);
      if (compact) {
        assert.match(text, /next: Check saved for 10 Oct 2026,/);
        assert.doesNotMatch(text, /check: 10 Oct/);
      } else assert.match(text, /check: 10 Oct 2026, 12:10 UTC/);
    }
  }
});

test('background activity is attributed to the owned dependency, not parent chat', () => {
  const state = fixture();
  state.goal!.backgroundWait = { version: 1, id: 'wait-1', targetId: state.goal!.id,
    sessionId: 'session-1', createdAt: new Date(NOW).toISOString(), reason: 'Owned worker',
    dependencies: [{ runId: 'run-1', outcome: 'pending' }] };
  const evidence = observed(state, { turnActive: true, lastActivityAt: NOW,
    backgroundWait: { waitId: 'wait-1', registered: true } });
  const waiting = projectUiStatus(state, { now: NOW, generation: 2, evidence });
  assert.equal(waiting.execution, 'waiting', 'chat is not worker activity');
  assert.equal(waiting.lastActivityAt, undefined);
  assert.match(waiting.nextAction, /unknown\/stale/);
  for (const at of [NOW, NOW - 31_000]) {
    const status = projectUiStatus(state, { now: NOW, generation: 2,
      evidence: { ...evidence, backgroundWait: { waitId: 'wait-1', registered: true, lastActivityAt: at } } });
    assert.equal(status.execution, at === NOW ? 'running' : 'waiting');
  }
  assert.equal(projectUiStatus(state, { now: NOW, generation: 2,
    evidence: { ...evidence, backgroundWait: { waitId: 'other', registered: true, lastActivityAt: NOW } } }).execution, 'unconfirmed');
  const future = projectUiStatus(state, { now: NOW, generation: 2,
    evidence: { ...evidence, backgroundWait: { waitId: 'wait-1', registered: true, lastActivityAt: NOW + 1 } } });
  assert.equal(future.execution, 'waiting');
  assert.equal(future.lastActivityAt, undefined, 'invalid future activity cannot leak into a rendered age');
});

test('saved active or auditing state never proves execution', () => {
  const state = fixture();
  assert.equal(projectUiStatus(state, { now: NOW }).execution, 'unconfirmed');
  state.goal!.status = 'auditing';
  state.goal!.pendingCompletion = { phase: 'running', completionSummary: 'saved', at: new Date(NOW - 15 * 86400_000).toISOString() };
  assert.equal(projectUiStatus(state, { now: NOW }).execution, 'unconfirmed');
});

test('saved deadline differs from attributed armed timer', () => {
  const state = fixture(); recovery(state);
  const saved = projectUiStatus(state, { now: NOW });
  assert.equal(saved.execution, 'unconfirmed');
  assert.equal(saved.retryAt, state.mainModelRecovery!.retryAt);
  const runtime = projectUiStatus(state, { now: NOW, generation: 2, evidence: observed(state,
    { recovery: { retryTimerArmed: true, hourlyTimerArmed: false, switchInFlight: false } }) });
  assert.equal(runtime.execution, 'retry-armed');
  assert.equal(runtime.retryKind, 'regular');
});

test('replaced owner, generation, stale or future snapshots do not establish liveness', () => {
  const state = fixture();
  for (const patch of [{ ownerKey: 'goal:replaced' }, { generation: 1 }, { observedAt: NOW - 31_000 }, { observedAt: NOW + 1 }]) {
    assert.equal(projectUiStatus(state, { now: NOW, generation: 2, evidence: observed(state, { turnActive: true, ...patch }) }).execution, 'unconfirmed');
  }
});

test('manual decision and supervisor holds outrank provider timers', () => {
  const state = fixture(); recovery(state);
  state.goal!.status = 'paused'; state.goal!.pauseKind = 'decision';
  state.goal!.pauseReason = 'Choose permitted destination'; state.goal!.pauseSuggestedAction = 'Choose a destination';
  const context = { now: NOW, generation: 2, evidence: observed(state,
    { recovery: { retryTimerArmed: true, hourlyTimerArmed: false, switchInFlight: false } }) };
  assert.equal(projectUiStatus(state, context).execution, 'blocked');
  assert.equal(projectUiStatus(state, context).nextAction, 'Choose a destination');
  state.supervisorPausedAt = NOW;
  assert.equal(projectUiStatus(state, context).blocker, 'Supervisor paused');
});

test('silence does not prove death; independently observed closure does', () => {
  const state = fixture();
  assert.equal(projectUiStatus(state, { now: NOW, generation: 2, evidence: observed(state,
    { lastActivityAt: NOW - 15 * 86400_000 }) }).execution, 'unconfirmed');
  assert.equal(projectUiStatus(state, { now: NOW, generation: 2, evidence: observed(state,
    { session: 'closed' }) }).execution, 'dormant');
});

test('in-budget tool is a wait and queued is not running', () => {
  const state = fixture();
  assert.equal(projectUiStatus(state, { now: NOW, generation: 2, evidence: observed(state,
    { tool: { name: 'bash', startedAt: NOW - 61 * 60_000, budgetMs: 120 * 60_000 } }) }).execution, 'tool-wait');
  assert.equal(projectUiStatus(state, { now: NOW, generation: 2, evidence: observed(state, { turnQueued: true }) }).execution, 'queued');
});

test('hourly-only timer does not advertise a regular saved deadline', () => {
  const state = fixture(); recovery(state);
  const status = projectUiStatus(state, { now: NOW, generation: 2, evidence: observed(state,
    { recovery: { retryTimerArmed: false, hourlyTimerArmed: true, switchInFlight: false } }) });
  assert.equal(status.execution, 'retry-armed');
  assert.equal(status.retryKind, 'hourly');
  assert.equal(status.retryAt, undefined);
});

test('terminal state outranks old observations; workflow issue survives independently', () => {
  const state = fixture();
  const context = { now: NOW, generation: 2, evidence: observed(state, { turnActive: true }), workflowIssue: 'Replan required before audit' };
  assert.equal(projectUiStatus(state, context).workflowIssue, context.workflowIssue);
  state.goal!.status = 'complete';
  assert.equal(projectUiStatus(state, context).execution, 'complete');
});

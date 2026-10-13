import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { State } from '../extensions/goal-loop-core.js';
import { buildStatusText, buildWidgetLines, type AuditDisplayProgress } from '../extensions/goal-loop-display.js';
import { uiStatusOwnerKey } from '../extensions/ui-status.js';

const now = Date.parse('2026-10-11T21:00:00Z');
function fixture(): State {
  return { goal: { id: 'audit-storage', policy: 'goal', status: 'auditing', objective: 'Inspect the saved audit',
    autoContinue: true, createdAt: new Date(now - 60000).toISOString(), updatedAt: new Date(now).toISOString(),
    usage: { tokensUsed: 0, tokensLimit: 1000000 },
    pendingCompletion: { phase: 'running', at: new Date(now - 60000).toISOString(), completionSummary: 'Saved claim' } }, list: [] };
}
const progress: AuditDisplayProgress = { phase: 'thinking', label: 'running', startedAt: now - 60000,
  elapsedMs: 60000, lastActivityAt: now - 1000 };

test('closed host admission is not erased by cached live audit progress', () => {
  const state = fixture();
  const uiStatusContext = { now, generation: 1, evidence: { ownerKey: uiStatusOwnerKey(state)!, generation: 1,
    session: 'closed' as const, observedAt: now, lastActivityAt: now - 1000, turnActive: true } };
  const extras = { uiStatusContext, compactAuditCard: true };
  const card = buildWidgetLines(state, progress, now, undefined, 120, extras)!.join('\n');
  const footer = buildStatusText(state, progress, now, undefined, extras, 160)!;
  assert.match(card + footer, /DORMANT/);
  assert.match(card, /Reopen project/);
  assert.doesNotMatch(card + footer, /Audit running|AUDIT RUNNING|No action needed|review applies automatically/);
});

test('persistence stop outranks cached live audit progress on compact and detailed surfaces', () => {
  for (const compactAuditCard of [true, false]) for (const width of [40, 120]) {
    const state = fixture();
    const uiStatusContext = { now, generation: 1, persistenceHold: 'Audit recovery cursor could not be saved',
      evidence: { ownerKey: uiStatusOwnerKey(state)!, generation: 1, session: 'open' as const,
        observedAt: now, lastActivityAt: now - 1000, turnActive: true } };
    const extras = { uiStatusContext, compactAuditCard };
    const card = buildWidgetLines(state, progress, now, undefined, width, extras)!.join('\n');
    const footer = buildStatusText(state, progress, now, undefined, extras, width)!;
    assert.match(card, /BLOCKED/);
    assert.match(card, /\/glla status/);
    assert.doesNotMatch(card, /Audit running|No action needed|review applies automatically|detached worker/);
    assert.doesNotMatch(footer, /AUDIT RUNNING|DETACHED.*LIVE|SUPERVISING|auditor.*thinking/);
    if (width === 120) assert.match(footer, /persistence failure/);
    assert.equal(state.goal!.status, 'auditing', 'presentation must preserve the saved pending claim');
  }
});

function parkedFixture(): State {
  const state = fixture();
  Object.assign(state.goal!, { status: 'paused', pauseKind: 'blocked',
    pauseReason: 'completion audit blocked — no verdict: silent host successor',
    pauseSuggestedAction: 'The completion claim is stored; /goal resume starts exactly one fresh auditor.' });
  state.goal!.pendingCompletion!.phase = 'recovery-pending';
  state.mainModelRecovery = { primary: 'provider/primary', active: 'provider/primary', attempted: ['provider/primary'],
    attempts: 2101, kind: 'goal', reason: 'provider unavailable', owner: { kind: 'goal', id: state.goal!.id },
    retryAt: new Date(now + 60000).toISOString() };
  return state;
}

for (const hold of ['closed', 'load', 'persistence', 'supervisor'] as const) {
  test(`paused pending claim: ${hold} admission outranks legacy recovery rendering`, () => {
    for (const compactAuditCard of [true, false]) {
      const state = parkedFixture();
      if (hold === 'load') state.loadHoldAt = now;
      if (hold === 'supervisor') state.supervisorPausedAt = now;
      const before = JSON.stringify(state);
      const extras = { compactAuditCard, uiStatusContext: { now, generation: 1,
        persistenceHold: hold === 'persistence' ? 'Audit cursor could not be saved' : undefined,
        evidence: { ownerKey: uiStatusOwnerKey(state)!, generation: 1,
          session: hold === 'closed' ? 'closed' as const : 'open' as const,
          observedAt: now, lastActivityAt: now - 1000, turnActive: true } } };
      const card = buildWidgetLines(state, progress, now, undefined, 160, extras)!.join('\n');
      const footer = buildStatusText(state, progress, now, undefined, extras, 240)!;
      assert.match(card, hold === 'closed' ? /DORMANT/ : /BLOCKED/);
      assert.match(card + footer, hold === 'closed' ? /Reopen project/ : hold === 'load' ? /continuation consent/ : hold === 'supervisor' ? /supervisor hold/ : /persistence failure/);
      assert.doesNotMatch(card + footer, /RECOVERING|Audit running|No action needed/);
      if (hold === 'closed') assert.match(card, /no verdict: silent host successor/);
      assert.equal(JSON.stringify(state), before, 'display cannot mutate or resume the stored claim');
    }
  });
}

test('ordinary cold parked no-verdict claim retains exact legacy wording without an admission hold', () => {
  const state = parkedFixture();
  delete state.mainModelRecovery;
  const card = buildWidgetLines(state, null, now, undefined, 160, { uiStatusContext: { now } })!.join('\n');
  assert.match(card, /completion audit: parked — no review recorded/);
  assert.match(card, /completion claim was not evaluated/);
  assert.doesNotMatch(card, /DORMANT|RECOVERING/);
});

test('closed admission preserves ordinary prerequisite and decision blockers without unpausing', () => {
  for (const pauseKind of ['blocked', 'decision'] as const) {
    const state = fixture();
    Object.assign(state.goal!, { status: 'paused', pauseKind, pauseReason: 'Human approval is required',
      pauseSuggestedAction: pauseKind === 'decision' ? '/goal decide resolves the pending choice' : 'Resolve human approval before /goal resume' });
    delete state.goal!.pendingCompletion;
    const before = JSON.stringify(state);
    const extras = { uiStatusContext: { now, generation: 1, evidence: { ownerKey: uiStatusOwnerKey(state)!,
      generation: 1, session: 'closed' as 'closed' | 'open', observedAt: now } } };
    const card = buildWidgetLines(state, null, now, undefined, 160, extras)!.join('\n');
    assert.match(card, /DORMANT/);
    assert.match(card, /Human approval is required/);
    assert.match(card, pauseKind === 'decision' ? /\/goal decide/ : /Resolve human approval/);
    assert.equal(JSON.stringify(state), before);
    extras.uiStatusContext.evidence.session = 'open';
    const openCard = buildWidgetLines(state, null, now, undefined, 160, extras)!.join('\n');
    assert.match(openCard, /BLOCKED/);
    assert.match(openCard, /Human approval is required/);
    assert.equal(JSON.stringify(state), before);
  }
});

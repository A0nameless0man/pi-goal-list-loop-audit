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

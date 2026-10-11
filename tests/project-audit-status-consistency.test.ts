import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleWidth } from '@earendil-works/pi-tui';
import type { State } from '../extensions/goal-loop-core.js';
import { buildStatusText, buildWidgetLines } from '../extensions/goal-loop-display.js';
import { createRespecBuilder, adoptRespecRequirements, planRespecIncrement, claimRespecTask, beginRespecAudit } from '../extensions/respec-builder.js';
import { setRespecAuditLive, type RespecAuditLive } from '../extensions/respec-builder-ui.js';
import { uiStatusOwnerKey } from '../extensions/ui-status.js';

const now = Date.parse('2026-10-11T21:00:00Z');
function fixture(): State {
  const adopted = adoptRespecRequirements(createRespecBuilder('Export the project'), [{ id: 'export', text: 'Export', acceptance: 'Round trip' }]);
  const planned = planRespecIncrement(adopted, [{ id: 'task', text: 'Implement export', requirementIds: ['export'] }]);
  const builder = beginRespecAudit(claimRespecTask(planned, 'task'), 'project-status', 'Round trip checked');
  return { goal: null, list: [], loop: { active: true, builder, target: builder.vision, iteration: 1, maxIterations: 0,
    plateauWindow: 5, stallCount: 0, bestValue: null, lastValue: null, history: [], startedAt: new Date(now - 60000).toISOString() } };
}
function extras(state: State) {
  return { compactAuditCard: true, maxWidgetLines: 8, uiStatusContext: { now, generation: 1,
    evidence: { ownerKey: uiStatusOwnerKey(state)!, generation: 1, session: 'open' as const, observedAt: now, turnActive: true } } };
}

test('project is explicitly a loop, with visible clocks and bounded tool-wait evidence', () => {
  const state = fixture(); const builder = state.loop!.builder!;
  const progress: RespecAuditLive = { phase: 'running', workerPhase: 'tool_executing', startedAt: now - 800000,
    currentTool: 'bash', currentToolStartedAt: now - 677000, lastActivityAt: now - 677000, toolTimeoutMs: 900000 };
  try {
    setRespecAuditLive(builder, progress);
    for (const width of [40, 120]) {
      const card = buildWidgetLines(state, undefined, now, undefined, width, extras(state))!;
      assert.match(card[0]!, /Loop \/ Project/);
      assert.match(card.join('\n'), /Audit tool wait/);
      assert.match(card.join('\n'), /audit elapsed/);
      assert.match(card.join('\n'), /last activity:/);
      assert.ok(card.length <= 8);
      assert.ok(card.every(line => visibleWidth(line) <= width));
    }
    const footer = buildStatusText(state, undefined, now, undefined, extras(state), 160)!;
    assert.match(footer, /TOOL WAIT/);
    assert.match(footer, /loop \/ project/);
    assert.doesNotMatch(footer, /EXECUTION UNCONFIRMED/);
  } finally { setRespecAuditLive(builder); }
});

test('project auditor stale or missing activity cannot inherit a busy host running badge', () => {
  const state = fixture(); const builder = state.loop!.builder!;
  try {
    for (const [age, word] of [[40000, 'EXECUTION UNCONFIRMED'], [240000, 'AUDIT QUIET'], [7200000, 'AUDIT STALLED']] as const) {
      setRespecAuditLive(builder, { phase: 'running', startedAt: now - age, lastActivityAt: now - age });
      const footer = buildStatusText(state, undefined, now, undefined, extras(state), 160)!;
      assert.ok(footer.includes(word), footer);
      const card = buildWidgetLines(state, undefined, now, undefined, 120, extras(state))!.join('\n');
      assert.doesNotMatch(card, /auditor: running|no action needed/i);
    }
  } finally { setRespecAuditLive(builder); }
});

test('stopped project excludes cached live worker and names the containing loop', () => {
  const state = fixture(); const builder = state.loop!.builder!;
  setRespecAuditLive(builder, { phase: 'running', startedAt: now - 1000, lastActivityAt: now });
  state.loop!.active = false; state.loop!.stopReason = 'stopped by user (/loop stop)';
  try {
    const card = buildWidgetLines(state, undefined, now, undefined, 120)!.join('\n');
    assert.match(card, /Loop \/ Project · Audit stopped/);
    assert.doesNotMatch(card, /auditor: running|no action needed|\/loop resume/i);
  } finally { setRespecAuditLive(builder); }
});

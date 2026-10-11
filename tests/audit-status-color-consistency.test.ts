import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { State } from '../extensions/goal-loop-core.js';
import { buildWidgetLines, buildStatusText, type AuditDisplayProgress, type DisplayTheme } from '../extensions/goal-loop-display.js';
import { uiStatusOwnerKey } from '../extensions/ui-status.js';

const now = Date.parse('2026-10-11T21:00:00Z');
function fixture(): State {
  return { goal: { id: 'audit-colors', policy: 'goal', status: 'auditing', objective: 'Verify audit presentation', autoContinue: true,
    createdAt: new Date(now - 60000).toISOString(), updatedAt: new Date(now).toISOString(), usage: { tokensUsed: 0, tokensLimit: 1000000 },
    pendingCompletion: { phase: 'running', at: new Date(now - 60000).toISOString(), completionSummary: 'Saved claim' } }, list: [] };
}
function render(progress?: AuditDisplayProgress) {
  const state = fixture();
  const colors: Array<{ color: string; text: string }> = [];
  const theme: DisplayTheme = { fg: (color, text) => { colors.push({ color, text }); return text; } };
  const uiStatusContext = { now, generation: 1, evidence: { ownerKey: uiStatusOwnerKey(state)!, generation: 1,
    session: 'open' as const, observedAt: now, turnActive: true, lastActivityAt: now } };
  const extras = { uiStatusContext, compactAuditCard: true, maxWidgetLines: 12 };
  const card = buildWidgetLines(state, progress, now, theme, 120, extras)!.join('\n');
  const footer = buildStatusText(state, progress, now, theme, extras, 120)!;
  return { colors, card, footer };
}

test('fresh audit heading, compact phase and footer all use live-success semantics', () => {
  const { colors, card, footer } = render({ phase: 'thinking', label: 'running', startedAt: now - 19000, elapsedMs: 19000,
    lastActivityAt: now - 1000, toolCalls: [{ name: 'read', argsPrefix: '', finishedAt: now - 1000 }] });
  assert.match(card, /GOAL · auditing · RUNNING/);
  assert.match(card, /Audit running/);
  assert.match(card, /audit elapsed 19s/);
  assert.match(card, /activity 1s ago/);
  assert.match(footer, /AUDIT RUNNING/);
  for (const segment of ['RUNNING', 'Audit running', 'AUDIT RUNNING']) {
    const painted = colors.filter(entry => entry.text === segment || entry.text.startsWith(`${segment} ·`));
    assert.ok(painted.length, segment);
    assert.ok(painted.every(entry => entry.color === 'success'), JSON.stringify(painted));
  }
  assert.ok(colors.filter(entry => /^[│├└]/.test(entry.text)).every(entry => entry.color === 'dim'));
});

test('busy parent cannot turn a missing or stale auditor into a running heading', () => {
  for (const progress of [undefined, { phase: 'thinking' as const, lastActivityAt: now - 40000, startedAt: now - 60000, elapsedMs: 60000 }]) {
    const { card, footer } = render(progress);
    assert.match(card, /EXECUTION UNCONFIRMED/);
    assert.doesNotMatch(card, /auditing · RUNNING|Audit running/);
    assert.doesNotMatch(card, /last progress 0s.*runtime/, 'parent activity is not an auditor heartbeat');
    assert.doesNotMatch(card + footer, /No action needed|review applies automatically|AUDIT RUNNING/);
    assert.match(card, /\/(?:glla|goal) status/);
  }
});

test('quiet and stalled audit heading agree with worker phase despite busy parent', () => {
  for (const [age, label, color] of [[240000, 'QUIET', 'warning'], [7200000, 'STALLED', 'error']] as const) {
    const { card, footer, colors } = render({ phase: 'thinking', lastActivityAt: now - age, elapsedMs: age, startedAt: now - age });
    assert.match(card, new RegExp(`AUDIT ${label}`));
    assert.match(footer, new RegExp(`AUDIT ${label}`));
    assert.doesNotMatch(card, /auditing · RUNNING/);
    assert.ok(colors.filter(entry => entry.text === `AUDIT ${label}`).every(entry => entry.color === color));
  }
});

test('in-budget detached tool wait is informational on heading, phase and footer', () => {
  const { card, footer, colors } = render({ phase: 'tool_executing', currentTool: 'bash', currentToolStartedAt: now - 677000,
    toolTimeoutMs: 900000, lastActivityAt: now - 677000, startedAt: now - 800000, elapsedMs: 800000 });
  assert.match(card, /TOOL WAIT/);
  assert.match(card, /Waiting on bash/);
  assert.match(footer, /AUDIT TOOL WAIT/);
  for (const entry of colors.filter(entry => /^(TOOL WAIT|Waiting on bash|AUDIT TOOL WAIT)/.test(entry.text))) assert.equal(entry.color, 'accent');
});

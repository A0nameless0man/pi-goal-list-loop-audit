import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleWidth } from '@earendil-works/pi-tui';
import { auditorLatestAction, buildWidgetLines, buildStatusText, type AuditDisplayProgress, type WidgetExtras } from '../extensions/goal-loop-display.js';
import type { State } from '../extensions/goal-loop-core.js';
import { uiStatusContextFromRuntime } from '../extensions/ui-status-runtime.js';
const now = Date.parse('2026-10-12T10:00:00Z');
function fixture() {
  const state: State = { goal: { id: 'action-owner', objective: 'Assess the actual worker evidence', status: 'auditing', policy: 'goal',
    autoContinue: true, usage: { tokensUsed: 0, tokensLimit: 0 }, createdAt: new Date(now - 600_000).toISOString(), updatedAt: new Date(now).toISOString(),
    pendingCompletion: { at: new Date(now - 120_000).toISOString(), phase: 'running', attemptId: 'attempt-1' } }, list: [] };
  const audit: AuditDisplayProgress = { ownerKey: 'goal:action-owner', generation: 2, attemptId: 'attempt-1', phase: 'thinking',
    lastActivityAt: now - 5000, elapsedMs: 120_000, toolCalls: [{ name: 'read', argsPrefix: JSON.stringify({ path: '/private/source/Widget.svelte' }), finishedAt: now - 8000 }] };
  return { state, audit };
}
function extras(state: State, audit: AuditDisplayProgress, compact: boolean): WidgetExtras {
  return { compactAuditCard: compact, uiStatusContext: uiStatusContextFromRuntime(state, now, 2,
    { ownerKey: 'goal:action-owner', generation: 2, observedAt: now, session: 'open', turnActive: true },
    { ownerKey: audit.ownerKey!, generation: audit.generation!, attemptId: audit.attemptId!, observedAt: now, lastActivityAt: audit.lastActivityAt,
      ...(audit.currentTool ? { tool: { name: audit.currentTool, startedAt: audit.currentToolStartedAt!, budgetMs: audit.toolTimeoutMs! } } : {}) }) };
}

for (const orphan of [{ toolCalls: undefined as unknown as AuditDisplayProgress['toolCalls'] }, { toolCalls: [] }]) {
  test(`legacy un-stamped progress without tool completions renders no action and a clear inspect path (${JSON.stringify(orphan).slice(0, 40)})`, () => {
    const { state, audit } = fixture();
    audit.toolCalls = orphan.toolCalls;
    delete (audit as { generation?: number }).generation;
    for (const compact of [true, false]) {
      const e = extras(state, audit, compact);
      const text = buildWidgetLines(state, audit, now, undefined, 120, e)!.join('\n');
      assert.doesNotMatch(text, /last action:|Widget.svelte|completion review/);
      assert.match(text, /\/goal status|inspect/);
    }
  });
}

test('production adapter/card/footer retain actual completion action and age, not parent activity', () => {
  const { state, audit } = fixture();
  for (const compact of [true, false]) for (const width of [40, 120]) {
    const e = extras(state, audit, compact);
    const lines = buildWidgetLines(state, audit, now, undefined, width, e)!;
    const text = lines.join('\n');
    assert.match(text, /last(?: action)?: read/);
    assert.match(text, /8s ago/);
    assert.doesNotMatch(text, /\/private\/|\d+%/);
    assert.ok(lines.every(line => visibleWidth(line) <= width));
    assert.match(text, /\/goal status/);
    const footer = buildStatusText(state, audit, now, undefined, e, width)!;
    assert.match(footer, /AUDIT RUNNING/);
    if (width === 120) assert.match(footer, /last action: read.*8s ago/);
  }
});

test('stale completion remains historical action and never becomes live through a parent poll', () => {
  const { state, audit } = fixture(); audit.lastActivityAt = now - 45_000; audit.toolCalls![0]!.finishedAt = now - 60_000;
  for (const compact of [true, false]) {
    const e = extras(state, audit, compact);
    const text = buildWidgetLines(state, audit, now, undefined, 120, e)!.join('\n');
    assert.match(text, /UNCONFIRMED/);
    assert.match(text, /last action: read.*1m/);
    assert.doesNotMatch(text, /DETACHED.*LIVE|No action needed/);
  }
});

for (const patch of [{ attemptId: 'replaced' }, { ownerKey: 'goal:other' }, { generation: 1 }]) {
  test(`replaced progress is rejected at production renderer boundaries (${JSON.stringify(patch)})`, () => {
    const { state, audit } = fixture(); const e = extras(state, audit, true);
    const replaced = { ...audit, ...patch };
    for (const compactAuditCard of [true, false]) {
      const actual = { ...e, compactAuditCard };
      const text = buildWidgetLines(state, replaced, now, undefined, 120, actual)!.join('\n');
      assert.match(text, /UNCONFIRMED/);
      assert.doesNotMatch(text, /last action:|Widget.svelte|AUDIT RUNNING/);
      assert.doesNotMatch(buildStatusText(state, replaced, now, undefined, actual, 120)!, /AUDIT RUNNING|Widget.svelte/);
    }
  });
}

test('missing/future completion timestamps and arbitrary commands cannot invent action evidence', () => {
  const { state, audit } = fixture();
  audit.toolCalls = [{ name: 'bash', argsPrefix: '{"command":"cat /secret/token"}', finishedAt: now + 1 }];
  assert.equal(auditorLatestAction(state.goal!, audit, now), 'latest action: not observed');
  audit.toolCalls[0]!.finishedAt = now - 1000;
  const action = auditorLatestAction(state.goal!, audit, now)!;
  assert.match(action, /bash.*1s ago/); assert.doesNotMatch(action, /secret|cat/);
  audit.toolCalls = [];
  assert.equal(auditorLatestAction(state.goal!, audit, now), 'latest action: not observed');
});

test('current bounded tool retains elapsed/budget alongside last completed action; holds win', () => {
  const { state, audit } = fixture(); Object.assign(audit, { phase: 'tool_executing', currentTool: 'bash', currentToolStartedAt: now - 30_000, toolTimeoutMs: 300_000 });
  for (const compact of [true, false]) {
    const e = extras(state, audit, compact);
    const text = buildWidgetLines(state, audit, now, undefined, 120, e)!.join('\n');
    assert.match(text, /30s.*5m/); assert.match(text, /last action: read.*8s ago/);
    const held = { ...state, supervisorPausedAt: now };
    assert.match(buildWidgetLines(held, audit, now, undefined, 120, e)!.join('\n'), /BLOCKED/);
    assert.doesNotMatch(buildStatusText(held, audit, now, undefined, e, 120)!, /AUDIT RUNNING|AUDIT TOOL WAIT/);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleWidth } from '@earendil-works/pi-tui';
import type { State } from '../extensions/goal-loop-core.js';
import { readState } from '../extensions/goal-loop-core.js';
import { buildWidgetLines, buildStatusText, responsiveWidget, widgetHeightBudget } from '../extensions/goal-loop-display.js';
import { projectUiStatus } from '../extensions/ui-status.js';
import { withPressureSession, providerError } from './harness/context-pressure.js';

const now = Date.parse('2026-10-11T13:49:41Z');
function fixture(): State {
  return { goal: { id: 'author', objective: 'Ship navigation', status: 'paused', policy: 'goal', autoContinue: true,
    createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), pauseKind: 'blocked',
    pauseSource: 'agent', usage: { tokensUsed: 0, tokensLimit: 1000000 }, pauseReason: 'Missing current cover admissions; not proven artwork mismatches. '.repeat(40),
    pauseSuggestedAction: 'Supply admissions or authorize remediation. '.repeat(40) }, list: [] };
}

test('pause attribution is explicit and unknown legacy sources are never blamed on the user', () => {
  for (const [source, label] of [['agent', 'paused by agent'], ['user', 'paused by you'], ['system', 'paused by GLLA'], [undefined, 'source unknown']] as const) {
    const state = fixture(); state.goal!.pauseSource = source;
    const context = { now };
    const status = projectUiStatus(state, context);
    assert.equal(status.pauseSource, source ?? 'unknown');
    assert.match(status.resumeAction!, /retries work.*does not fix the blocker/);
    const card = buildWidgetLines(state, undefined, now, undefined, 120, { uiStatusContext: context })!.join('\n');
    const footer = buildStatusText(state, undefined, now, undefined, { uiStatusContext: context }, 200)!;
    assert.ok(card.includes(label), card);
    assert.ok(footer.includes(label), footer);
    if (!source) assert.doesNotMatch(card + footer, /paused by you|paused by user/);
    state.goal!.status = 'active';
    assert.equal(projectUiStatus(state, context).pauseSource, undefined);
  }
});

test('actual pause entrypoints persist episode authors and resume clears the prior author', async () => {
  await withPressureSession(async (pi, ctx, cwd) => {
    await pi.runTool('pause_goal', { kind: 'blocked', reason: 'Missing cover admissions', suggestedAction: 'Supply admissions' }, ctx);
    assert.equal(readState(cwd).goal?.pauseSource, 'agent');
    await pi.command('goal', 'resume', ctx);
    assert.equal(readState(cwd).goal?.pauseSource, undefined);
    await pi.command('goal', 'pause', ctx);
    assert.equal(readState(cwd).goal?.pauseSource, 'user');
    await pi.command('goal', 'resume', ctx);
    await pi.fire('agent_start', {}, ctx);
    await pi.fire('agent_end', providerError('429 Token Plan rate limit reached (2062)'), ctx);
    assert.equal(readState(cwd).goal?.pauseSource, 'system', 'runtime provider wait cannot inherit a user or agent attribution');
  });
});

test('responsive production card obeys both dimensions on each resize and preserves inspection path', () => {
  const state = fixture(); let height = 24;
  const component = responsiveWidget((width, maxWidgetLines) => buildWidgetLines(state, undefined, now, {
    fg: (_color, text) => `\x1b[33m${text}\x1b[0m`,
  }, width, { uiStatusContext: { now }, maxWidgetLines }), () => height);
  const before = JSON.stringify(state);
  for (const [width, rows] of [[200, 60], [40, 24], [20, 12], [8, 6], [80, 30], [120, 18]]) {
    height = rows!;
    component.invalidate();
    const lines = component.render(width!);
    assert.ok(lines.length <= widgetHeightBudget(rows!));
    assert.ok(lines.every(line => visibleWidth(line) <= width!));
    if (width! >= 20 && rows! >= 12) assert.match(lines.join('\n'), /\/glla status/);
    if (rows! >= 18) {
      assert.match(lines.join('\n'), /next:/);
      assert.match(lines.join('\n'), /why:/);
      assert.match(lines.join('\n'), /resume:/);
    }
  }
  assert.equal(JSON.stringify(state), before, 'rendering and resize never resume or modify work');
});

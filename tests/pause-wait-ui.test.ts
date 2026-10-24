import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
type ToolRenderContext = Parameters<NonNullable<ToolDefinition['renderResult']>>[3];
import { visibleWidth, stripTerminalSequences } from '@earendil-works/pi-tui';
import { loadThemeFromPath } from '../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js';
import activate, { __testOnlyResetProcessState } from '../extensions/loops/goal.js';
import { readState } from '../extensions/goal-loop-core.js';
import { replaceState } from '../extensions/goal-state.js';
import { buildActionReminder, clearPauseAbort, markActionReminderTurnStart, markPauseAbort, registerActionReminderRenderer } from '../extensions/action-reminder.js';
import { humanCheckTime } from '../extensions/human-handoff.js';
import { MockPi, seedGoal, seedState, makeMockCtx, tmpCwd } from './harness/mock-pi.js';

const theme = loadThemeFromPath(new URL('../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/dark.json', import.meta.url).pathname, 'truecolor');
afterEach(() => { clearPauseAbort(); __testOnlyResetProcessState(); });

async function fixture() {
  __testOnlyResetProcessState();
  const pi = new MockPi(); activate(pi.api);
  const cwd = tmpCwd();
  seedState(cwd, { goal: seedGoal({ status: 'paused', pauseKind: 'wait', pauseReason: 'Waiting for the normal backup rotation.', pauseResumeAt: new Date(Date.now() + 600_000).toISOString() }) });
  const goal = readState(cwd).goal; assert.ok(goal);
  const ctx = makeMockCtx(cwd);
  await pi.fire('session_start', { reason: 'startup' }, ctx);
  replaceState({ goal, list: [] });
  const handler = pi.handlers.get('message_end'); assert.ok(handler);
  const mark = () => {
    markActionReminderTurnStart();
    markPauseAbort({ ownerSession: ctx.sessionManager, goalId: goal.id, kind: 'wait', reason: goal.pauseReason!, resumeAt: goal.pauseResumeAt, resumeCommand: '/goal resume' });
  };
  return { pi, ctx, goal, handler, mark };
}

for (const stopReason of ['aborted', 'error']) {
  test(`expected pause cancellation renders as a normal wait, including host ${stopReason} stops`, async () => {
    const { handler, ctx, goal, mark } = await fixture(); mark();
    const message = { role: 'assistant', stopReason, errorMessage: 'This operation was aborted', content: [], timestamp: 42 };
    const result = await handler({ message } as never, ctx as never) as unknown as { message: { stopReason: string; errorMessage?: string; timestamp: number; content: { text: string }[] } };
    assert.equal(result.message.stopReason, 'stop');
    assert.equal(result.message.errorMessage, undefined);
    assert.equal(result.message.timestamp, 42);
    assert.match(result.message.content[0]!.text, /Waiting saved; this turn ended intentionally/);
    assert.ok(result.message.content[0]!.text.includes(humanCheckTime(goal.pauseResumeAt!)));
    assert.equal(message.stopReason, stopReason, 'the original transport object is not mutated');
    assert.equal(await handler({ message } as never, ctx as never), undefined, 'one-shot marker');
  });
}

test('real errors, unmarked cancellations and changed pauses are never relabeled as waiting', async () => {
  const { pi, handler, ctx, goal, mark } = await fixture();
  const cancelled = { role: 'assistant', stopReason: 'error', errorMessage: 'This operation was aborted', content: [] };
  assert.equal(await handler({ message: cancelled } as never, ctx as never), undefined, 'no owned marker');
  mark();
  for (const errorMessage of ['HTTP 500', 'This operation was aborted because billing failed', 'Connection aborted by provider', 'AbortError: credential rejected']) {
    assert.equal(await handler({ message: { ...cancelled, errorMessage } } as never, ctx as never), undefined, errorMessage);
  }
  replaceState({ goal: { ...goal, pauseReason: 'A different pause now owns this goal.' }, list: [] });
  assert.equal(await handler({ message: cancelled } as never, ctx as never), undefined, 'changed pause identity');
  replaceState({ goal, list: [] }); mark();
  await pi.fire('agent_start', {}, ctx); // a new start invalidates the prior turn marker
  assert.equal(await handler({ message: cancelled } as never, ctx as never), undefined, 'stale turn');
});

test('waiting card leads with status and next check, not investigation or failure styling', () => {
  const pi = new MockPi(); registerActionReminderRenderer(pi.api);
  const at = '2026-10-18T16:00:00Z';
  const reason = 'The normal backup rotation has not happened yet. ' + 'Supporting investigation. '.repeat(30) + 'END-OF-DETAIL';
  const reminder = buildActionReminder({ kind: 'wait', reason, resumeAt: at, resumeCommand: '/goal resume' });
  for (const expanded of [false, true]) for (const width of [40, 100]) {
    const component = pi.messageRenderers.get('glla-action-reminder')!({ content: reminder.content, details: reminder.details }, { expanded, outputPad: 1 }, theme) as { render(width: number): string[] };
    const lines = component.render(width);
    assert.ok(lines.every(line => visibleWidth(line) <= width));
    const text = stripTerminalSequences(lines.join('\n')).replace(/\s+/g, ' ');
    assert.match(text, /Waiting — work saved/);
    assert.ok(text.indexOf('Next check:') < text.indexOf('Why:'));
    assert.match(text, /18 Oct 2026, 16:00 UTC/);
    assert.match(text, /stopped intentionally to wait/);
    assert.match(text, /not because the task failed/);
    assert.match(text, /session is active and automatic checks are enabled/);
    assert.equal(text.includes('END-OF-DETAIL'), expanded);
    assert.doesNotMatch(text, /2026-10-18T|Error:|Operation aborted/);
  }
});

test('pause tool renders one short wait receipt; expanded, partial and error results retain their content', async () => {
  const { pi, ctx, goal } = await fixture();
  const args = { kind: 'wait', reason: goal.pauseReason!, resumeAt: goal.pauseResumeAt! };
  replaceState({ goal: { ...goal, status: 'active', pauseKind: undefined, pauseReason: undefined, pauseResumeAt: undefined }, list: [] });
  const raw = await pi.runTool('pause_goal', args, ctx);
  assert.ok(raw.content.every(c => c.type === 'text'));
  const result = { details: raw.details, content: raw.content.map(c => ({ type: 'text' as const, text: c.text })) };
  const tool = pi.tools.get('pause_goal')!;
  assert.ok(tool.renderCall); assert.ok(tool.renderResult);
  // v0.39.48: build the render context from the host's own type instead of
  // hand-listing every field. Pi 1.x added required `durationMs` and `outputPad`
  // members to ToolRenderContext, and a hand-rolled literal silently tied this
  // fixture to one Pi release line — a new optional-or-required host field broke
  // the test without anything in GLLA changing. The spread keeps every field the
  // renderer actually reads while letting the host decide the rest.
  const context = {
    args, toolCallId: 'fixture', invalidate() {}, lastComponent: undefined, state: {}, cwd: ctx.cwd,
    executionStarted: true, argsComplete: true, isPartial: false, expanded: false, showImages: false, isError: false,
    durationMs: 0, outputPad: 0,
  } as unknown as ToolRenderContext;
  const text = (component: { render(width: number): string[] }) => stripTerminalSequences(component.render(100).join('\n'));
  const call = text(tool.renderCall(args, theme, context));
  assert.match(call, /scheduling a progress check/); assert.doesNotMatch(call, /backup rotation/);
  const short = text(tool.renderResult(result, { expanded: false, isPartial: false }, theme, context));
  assert.match(short, /Wait saved/); assert.match(short, /See the Waiting card/);
  assert.doesNotMatch(short, /Do NOT continue|backup rotation/);
  const expanded = text(tool.renderResult(result, { expanded: true, isPartial: false }, theme, { ...context, expanded: true }));
  assert.match(expanded, /Do NOT continue/);
  assert.match(text(tool.renderResult(result, { expanded: false, isPartial: true }, theme, { ...context, isPartial: true })), /Do NOT continue/);
  assert.match(text(tool.renderCall(args, theme, { ...context, expanded: true })), /backup rotation/);
  assert.match(text(Reflect.apply(tool.renderResult, undefined, [result, { expanded: false, isPartial: false }, theme])), /Do NOT continue/, 'older hosts without error context keep the full result');
  const blockedResult = { details: { pauseState: 'paused' }, content: [{ type: 'text' as const, text: 'Goal paused. The turn ends here — do NOT continue working. /goal resume to continue.' }] };
  const blocked = text(tool.renderResult(blockedResult, { expanded: false, isPartial: false }, theme, context));
  assert.match(blocked, /Paused\. See the action card\./);
  assert.doesNotMatch(blocked, /turn ends here|Do NOT continue/);
  assert.match(text(tool.renderResult(blockedResult, { expanded: true, isPartial: false }, theme, { ...context, expanded: true })), /turn ends here/);
  const failure = { content: [{ type: 'text' as const, text: 'Wait admission failed: writes unavailable.' }], details: { pauseState: 'waiting' } };
  for (const isPartial of [false, true]) {
    assert.match(text(tool.renderResult(failure, { expanded: false, isPartial }, theme, { ...context, isError: true, isPartial })), /Wait admission failed/);
  }
});

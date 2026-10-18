// Run from the repository root: bun audit/human-handoff-2026-10-18/capture.ts
// Exercises the production renderers without a live session, provider or timer.
import fs from 'node:fs';
import { stripTerminalSequences, type Component } from '@earendil-works/pi-tui';
import { loadThemeFromPath } from '../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js';
import { MockPi, seedGoal } from '../../tests/harness/mock-pi.ts';
import { buildActionReminder, registerActionReminderRenderer } from '../../extensions/action-reminder.ts';
import { buildTerminalApprovalRender } from '../../extensions/completion-summary.ts';
import { registerSummaryRenderer } from '../../extensions/summary-renderer.ts';
import type { Goal } from '../../extensions/goal-loop-core.ts';
const theme = loadThemeFromPath(new URL('../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/dark.json', import.meta.url).pathname, 'truecolor');
const pi = new MockPi(); registerActionReminderRenderer(pi.api); registerSummaryRenderer(pi.api);
const clean = (component: Component) => stripTerminalSequences(component.render(100).join('\n')).split('\n').map(line => line.trimEnd()).join('\n').trim();
const reason = 'A human reviewer needs to run the four desktop playtest tasks and record the results. ' + 'Supporting investigation: verifier details, historical paths, passing gates and durable judgments. '.repeat(24) + 'End of supporting investigation.';
const blocked = buildActionReminder({ kind: 'blocked', reason, action: 'Follow docs/premium/HUMAN-PLAYTEST-QUICKSTART.md, record your observations, then reply here.', resumeCommand: '/list resume' });
const waiting = buildActionReminder({ kind: 'wait', reason: 'The backup succeeded. The retention check still needs the normal rotation at 22:17 UTC.', resumeAt: '2026-10-18T10:44:36.455Z', resumeCommand: '/goal resume' });
const goal = seedGoal({ objective: 'Make field names readable', completionSummary: 'Outcome: Both panels now show readable field names. Changed: Stored question text replaces internal identifiers. Evidence: shared label resolver and synthetic probe. Tests: focused checks passed. Unresolved: The signed-in LinkedIn flow was not rechecked. Next: Try the signed-in flow.', auditHistory: [{ approved: true, disapproved: false, model: 'fixture', at: '2026-10-18T12:00:00Z' }] }) as unknown as Goal;
const receipt = buildTerminalApprovalRender({ goal, status: 'complete', approval: '— completion audit approved.', record: '— record: saved.md', findingGroups: [{ title: 'Labels', findings: ['Both panels show readable questions — shared resolver in labels.ts:42', ...Array.from({ length: 8 }, (_, n) => `Supporting change ${n + 1} — implementation detail in implementation.ts:${n + 1}`)] }] });
let output = '# Production renderer captures\n\nRepresentative fixtures, not a live project run. Width: 100 terminal columns.\n';
for (const [name, reminder] of [['Blocked', blocked], ['Waiting', waiting]] as const) {
  for (const expanded of [false, true]) {
    const component = pi.messageRenderers.get('glla-action-reminder')!({ content: reminder.content, details: reminder.details }, { expanded, outputPad: 1 }, theme) as Component;
    output += `\n## ${name} (${expanded ? 'expanded' : 'default'})\n\n${clean(component)}\n`;
  }
}
for (const expanded of [false, true]) {
  const component = pi.messageRenderers.get('goal-event')!({ content: receipt.chatLines.join('\n'), details: { terminalApprovalGoalId: goal.id } }, { expanded, outputPad: 1 }, theme) as Component;
  output += `\n## Completion (${expanded ? 'expanded' : 'default'})\n\n${clean(component)}\n`;
}
fs.writeFileSync(new URL('./rendered-examples.txt', import.meta.url), output);
console.log('Captured production reminder/summary renderers at 100 columns.');

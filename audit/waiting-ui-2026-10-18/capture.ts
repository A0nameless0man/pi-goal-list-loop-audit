// From the repo root: bun audit/waiting-ui-2026-10-18/capture.ts
// Renderer fixture only: no live goal, timers or provider requests.
import fs from 'node:fs';
import { stripTerminalSequences } from '@earendil-works/pi-tui';
import { loadThemeFromPath } from '../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js';
import { buildActionReminder, registerActionReminderRenderer } from '../../extensions/action-reminder.ts';
import { MockPi } from '../../tests/harness/mock-pi.ts';
const theme = loadThemeFromPath(new URL('../../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/dark.json', import.meta.url).pathname, 'truecolor');
const pi = new MockPi(); registerActionReminderRenderer(pi.api);
const reminder = buildActionReminder({ kind: 'wait', reason: 'Waiting for the normal backup rotation.', resumeAt: '2026-10-18T16:00:00Z', resumeCommand: '/goal resume' });
let output = 'Production waiting-card renderer fixture; not a live-session capture.\n';
for (const width of [40, 100]) {
  const component = pi.messageRenderers.get('glla-action-reminder')!({ content: reminder.content, details: reminder.details }, { expanded: false, outputPad: 1 }, theme) as { render(width: number): string[] };
  output += `\n## ${width} columns\n\n` + stripTerminalSequences(component.render(width).join('\n')).split('\n').map(line => line.trimEnd()).join('\n').trim() + '\n';
}
fs.writeFileSync(new URL('./preview.txt', import.meta.url), output);

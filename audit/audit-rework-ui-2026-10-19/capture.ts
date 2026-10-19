// Renderer fixture, not a capture of a reloaded/live Polis session.
// Reproduce: bun audit/audit-rework-ui-2026-10-19/capture.ts
import fs from 'node:fs';
import { stripTerminalSequences } from '@earendil-works/pi-tui';
import { auditReworkNotice } from '../../extensions/audit-rework-handoff.ts';
import { buildStatusText, buildWidgetLines } from '../../extensions/goal-loop-display.ts';
import type { State } from '../../extensions/goal-loop-core.ts';
const now = Date.parse('2026-10-19T10:52:00Z');
const report = `Earlier review approved the finding append.\n<approved/>\n--- challenge ---\n## Required fixes\n1. [HIGH] Prove the parallel scout run with inspectable artifacts; rerun the survey if no record exists.\n2. [HIGH] Correct FIX versus DECIDE classifications before resubmitting.\n3. [HIGH] Explain which staged edits belong to this pass, separately from pre-existing work.\n<evidence>\nOutput:\nFile: .git/modules/fixture/index\nAccess: 2026-10-19\n15994 findings.md\n</evidence>\n<disapproved/>`;
const state: State = { goal: { id: 'rework-preview', objective: 'Collect audit findings without changing code', policy: 'list', status: 'active', autoContinue: true,
  usage: { tokensUsed: 146000, tokensLimit: 1000000 }, createdAt: new Date(now - 7 * 3600000).toISOString(), updatedAt: new Date(now).toISOString(), pauseReason: 'auditor disapproved',
  auditHistory: [{ at: new Date(now).toISOString(), model: 'fixture', approved: false, disapproved: true, report }] }, list: [] };
let output = 'Representative production-renderer fixture; not a live-session or loaded-package receipt. ANSI stripped.\n\n## Notification\n' + auditReworkNotice(report, '/list show') + '\n';
for (const width of [40, 120, 240]) {
  const extras = { uiStatusContext: { now }, compactAuditCard: true };
  output += `\n## Unconfirmed card ${width}\n${stripTerminalSequences(buildWidgetLines(state, undefined, now, undefined, width, extras)!.join('\n'))}\n`;
  output += `Footer: ${stripTerminalSequences(buildStatusText(state, undefined, now, undefined, extras, width)!)}\n`;
}
const live = { now, generation: 1, evidence: { ownerKey: 'goal:rework-preview', generation: 1, observedAt: now, session: 'open' as const, turnActive: true } };
output += `\n## Fresh observed work 120\n${stripTerminalSequences(buildWidgetLines(state, undefined, now, undefined, 120, { uiStatusContext: live })!.join('\n'))}\n`;
fs.writeFileSync(new URL('./preview.txt', import.meta.url), output);
console.log('Captured rework notification and card fixtures.');

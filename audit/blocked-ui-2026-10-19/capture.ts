// Run from the repo root: bun audit/blocked-ui-2026-10-19/capture.ts
// Production-renderer fixture only; it does not load or mutate the bucket project.
import fs from 'node:fs';
import { stripTerminalSequences } from '@earendil-works/pi-tui';
import { buildStatusText, buildWidgetLines } from '../../extensions/goal-loop-display.ts';
import { projectCompactionStatus } from '../../extensions/compaction-status.ts';
import type { State } from '../../extensions/goal-loop-core.ts';
const NOW = Date.parse('2026-10-19T00:09:00Z');
const state = { goal: { id: 'bucket', objective: 'Qualify live OVH upload and fresh restoration on the watched bridge-fixture repository using existing scoped uploader/consumer files', status: 'paused', policy: 'list', autoContinue: true,
  createdAt: new Date(NOW - 86_400_000).toISOString(), updatedAt: new Date(NOW).toISOString(), pauseKind: 'blocked', pauseSource: 'agent',
  pauseReason: 'Automatic committing stays RUNNING: user daemon active, no sync freeze markers, recent commits and pushes verified. Only this bucket-qualification task is parked because installing v8 still requires interactive administrator execution. Pausing this task does NOT pause the daemon.',
  pauseSuggestedAction: 'Keep ordinary sync running. When ready to continue bucket qualification, run the v8 command in dracon-sync/evidence/bucket-live-qual-2026-10-18/administrator-handoff.md and return the complete output.',
  usage: { tokensUsed: 517_000, tokensLimit: 0 }, taskList: { version: 1, tasks: [
    { id: '1', title: 'fixture', status: 'complete', subtasks: [] }, { id: '2', title: 'upload', status: 'in_progress', subtasks: [] }, { id: '3', title: 'restore', status: 'pending', subtasks: [] },
  ] } }, list: [] } as unknown as State;
const uiStatusContext = { now: NOW, generation: 1, evidence: { ownerKey: 'goal:bucket', generation: 1, observedAt: NOW, session: 'open' as const,
  compaction: projectCompactionStatus({ tokens: 212_109, threshold: 200_000, observedAt: NOW, supervising: true, audit: false, paused: true, recovery: false, idle: true, pending: false, available: true, pressureBudget: false, marker: 'absent' }) } };
const extras = { uiStatusContext, durableDeferRecommendation: { durableFix: 'install operator service', deferRecommendations: ['keep user service'], durableBlocked: true } };
let out = 'Blocked-card production renderer fixture; not a live project capture. ANSI stripped.\n';
for (const width of [40, 120, 240]) {
  out += `\n## Card ${width}\n\n${stripTerminalSequences(buildWidgetLines(state, undefined, NOW, undefined, width, extras)!.join('\n'))}\n`;
  out += `\nFooter: ${stripTerminalSequences(buildStatusText(state, undefined, NOW, undefined, extras, width)!)}\n`;
}
out += `\n## Detailed 120\n\n${stripTerminalSequences(buildWidgetLines(state, undefined, NOW, undefined, 120, { ...extras, compactAuditCard: false })!.join('\n'))}\n`;
fs.writeFileSync(new URL('./preview.txt', import.meta.url), out);
console.log('Captured blocked card/footer fixtures.');

// Deterministic production card/footer fixtures; no session or external-work IO.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildUiStatusCard, buildUiStatusFooter, type DisplayTheme } from '../extensions/goal-loop-display.js';
import { projectUiStatus, type UiStatusContext } from '../extensions/ui-status.js';
import type { State } from '../extensions/goal-loop-core.js';
const now = Date.parse('2026-10-12T03:00:00Z');
const codes = { accent: 147, success: 72, warning: 179, error: 168, dim: 244, muted: 245 };
const theme: DisplayTheme = { fg: (color, text) => `\x1b[38;5;${codes[color] ?? 252}m${text}\x1b[0m` };
function fixture(): State {
  return { goal: { id: 'wait-capture', status: 'active', objective: 'Assess external render evidence without assuming completion',
    policy: 'goal', autoContinue: true, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    usage: { tokensUsed: 0, tokensLimit: 0 } }, list: [] };
}
function context(): UiStatusContext {
  return { now, generation: 1, evidence: { ownerKey: 'goal:wait-capture', generation: 1, session: 'open', observedAt: now } };
}
const scheduled = fixture(); Object.assign(scheduled.goal!, { status: 'paused', pauseSource: 'agent', pauseKind: 'wait', pauseResumeAt: new Date(now + 300_000).toISOString() });
const scheduleContext = context(); scheduleContext.evidence!.scheduledCheck = { resumeAt: scheduled.goal!.pauseResumeAt!, heartbeatArmed: true };
const progress = fixture(); progress.goal!.backgroundWait = { version: 1, id: 'owned-wait', targetId: progress.goal!.id, sessionId: 'capture-session', createdAt: new Date(now).toISOString(), reason: 'Owned render worker', dependencies: [{ runId: 'worker', outcome: 'pending' }] };
const progressContext = context(); progressContext.evidence!.backgroundWait = { waitId: 'owned-wait', registered: true, lastActivityAt: now - 5000 };
const blocked = fixture(); Object.assign(blocked.goal!, { status: 'paused', pauseKind: 'blocked', pauseSource: 'agent', pauseReason: 'Read access denied; no progress evidence', pauseSuggestedAction: 'Grant read access to the render logs before resuming.' });
const staleContext = context(); staleContext.evidence!.backgroundWait = { waitId: 'owned-wait', registered: true, lastActivityAt: now - 120_000 };
const fixtures: [string, State, UiStatusContext][] = [
  ['Scheduled check · registered', scheduled, scheduleContext],
  ['Background progress · observed', progress, progressContext],
  ['Blocked · intervention required', blocked, context()],
  ['Background activity · stale', progress, staleContext],
  ['Saved check · wake unconfirmed', scheduled, { now }],
];
const out = path.resolve('audit/wait-status-captures'); fs.mkdirSync(out, { recursive: true });
for (const width of [40, 120]) for (const compact of [true, false]) {
  const rows: string[] = [];
  for (const [label, state, ctx] of fixtures) {
    rows.push(theme.fg('dim', label));
    const status = projectUiStatus(state, ctx);
    rows.push(...buildUiStatusCard(state, status, now, theme, width, compact));
    rows.push(buildUiStatusFooter(status, now, theme, width), '');
  }
  const stem = `${width}${compact ? '' : '-detailed'}`;
  fs.writeFileSync(path.join(out, `${stem}.ansi`), rows.join('\r\n') + '\r\n');
  fs.writeFileSync(path.join(out, `${stem}.json`), JSON.stringify({ width, rows: rows.length, fixtures: fixtures.map(([name]) => name), source: 'production buildUiStatusCard/buildUiStatusFooter', fixedNow: new Date(now).toISOString() }, null, 2) + '\n');
}

// Deterministic production card/footer fixtures; no session, journal or external project IO.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildWidgetLines, buildStatusText, type DisplayTheme } from '../extensions/goal-loop-display.js';
import type { State } from '../extensions/goal-loop-core.js';
import type { AuditDisplayProgress } from '../extensions/goal-loop-display.js';
import { uiStatusContextFromRuntime } from '../extensions/ui-status-runtime.js';
const now = Date.parse('2026-10-12T10:00:00Z');
const codes = { accent: 147, success: 72, warning: 179, error: 168, dim: 244, muted: 245 };
const theme: DisplayTheme = { fg: (color, text) => `\x1b[38;5;${codes[color] ?? 252}m${text}\x1b[0m` };
function goal(phase: 'running' | 'stalled' | 'settling'): State {
  return { goal: { id: 'audit-action', objective: 'Inspect actual worker evidence, not a percentage of work',
    status: 'auditing', policy: 'goal', autoContinue: true, createdAt: new Date(now - 600_000).toISOString(), updatedAt: new Date(now).toISOString(),
    usage: { tokensUsed: 0, tokensLimit: 0 },
    pendingCompletion: { at: new Date(now - 120_000).toISOString(),
      phase: phase === 'stalled' ? 'running' : (phase === 'settling' ? 'settling' : 'running'),
      attemptId: 'attempt-1' } }, list: [] };
}
function context(state: State) {
  return uiStatusContextFromRuntime(state, now, 2,
    { ownerKey: 'goal:audit-action', generation: 2, observedAt: now, session: 'open', turnActive: true });
}
function audit(args: Partial<AuditDisplayProgress> = {}): AuditDisplayProgress {
  return { ownerKey: 'goal:audit-action', generation: 2, attemptId: 'attempt-1', phase: 'thinking',
    lastActivityAt: now - 5000, elapsedMs: 120_000,
    toolCalls: [{ name: 'read', argsPrefix: JSON.stringify({ path: '/private/source/Widget.svelte' }), finishedAt: now - 8000 }],
    ...args };
}
const fixtures: [string, State, AuditDisplayProgress][] = [
  ['Fresh progress · last action visible', goal('running'), audit()],
  ['Stale progress · historical action, no live claim', goal('running'),
    audit({ lastActivityAt: now - 45_000, toolCalls: [{ name: 'read', argsPrefix: JSON.stringify({ path: '/private/source/Widget.svelte' }), finishedAt: now - 60_000 }] })],
  ['Bounded tool · elapsed/budget alongside last action', goal('running'),
    audit({ phase: 'tool_executing', currentTool: 'bash', currentToolStartedAt: now - 30_000, toolTimeoutMs: 300_000 })],
  ['Settling claim · settlement owed, no live worker', goal('settling'), audit({ phase: 'complete', lastActivityAt: now - 30_000 })],
  ['Replaced attempt · no live evidence', goal('running'), audit({ attemptId: 'replaced' })],
];
const out = path.resolve('audit/audit-action-captures'); fs.mkdirSync(out, { recursive: true });
for (const width of [40, 120]) for (const compact of [true, false]) {
  const rows: string[] = [];
  for (const [label, state, snap] of fixtures) {
    const ctx = context(state);
    const extras = { compactAuditCard: compact, uiStatusContext: ctx };
    rows.push(theme.fg('dim', label));
    rows.push(...(buildWidgetLines(state, snap, now, theme, width, extras) ?? []));
    rows.push(buildStatusText(state, snap, now, theme, extras, width) ?? '', '');
  }
  const stem = `${width}${compact ? '' : '-detailed'}`;
  fs.writeFileSync(path.join(out, `${stem}.ansi`), rows.join('\r\n') + '\r\n');
  fs.writeFileSync(path.join(out, `${stem}.json`), JSON.stringify({ width, rows: rows.length, fixtures: fixtures.map(([name]) => name), source: 'production buildWidgetLines/buildStatusText', fixedNow: new Date(now).toISOString() }, null, 2) + '\n');
}

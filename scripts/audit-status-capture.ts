// Production card/footer fixtures, not a live Pi session or dispatch test.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildWidgetLines, buildStatusText, type DisplayTheme, type AuditDisplayProgress } from '../extensions/goal-loop-display.js';
import type { State } from '../extensions/goal-loop-core.js';
import { uiStatusOwnerKey, type UiStatusContext } from '../extensions/ui-status.js';
import { createRespecBuilder, adoptRespecRequirements, planRespecIncrement, claimRespecTask, beginRespecAudit } from '../extensions/respec-builder.js';
import { setRespecAuditLive } from '../extensions/respec-builder-ui.js';
const now = Date.parse('2026-10-11T21:00:00Z');
const at = new Date(now - 3 * 3600000).toISOString();
const palette = { accent: 147, success: 72, warning: 179, error: 168, dim: 244, muted: 245 };
const theme: DisplayTheme = { fg: (color, text) => `\x1b[38;5;${palette[color] ?? 252}m${text}\x1b[0m` };
function goal(): State {
  return { goal: { id: 'capture-audit', objective: 'Verify objective labels and audit evidence', status: 'auditing', policy: 'goal', autoContinue: true,
    createdAt: at, updatedAt: at, usage: { tokensUsed: 0, tokensLimit: 1000000 },
    pendingCompletion: { phase: 'running', at, attemptId: 'capture-attempt', completionSummary: 'Fixture claim' } }, list: [] };
}
function context(state: State): UiStatusContext {
  return { now, generation: 1, evidence: { ownerKey: uiStatusOwnerKey(state)!, generation: 1, observedAt: now,
    session: 'open', turnActive: true, lastActivityAt: now } };
}
const fresh: AuditDisplayProgress = { phase: 'thinking', label: 'running', startedAt: now - 19000, elapsedMs: 19000,
  lastActivityAt: now - 1000, toolCalls: [{ name: 'read', argsPrefix: '', finishedAt: now - 1000 }] };
const tool: AuditDisplayProgress = { phase: 'tool_executing', currentTool: 'bash', currentToolStartedAt: now - 677000,
  lastActivityAt: now - 677000, toolTimeoutMs: 900000, startedAt: now - 800000, elapsedMs: 800000 };
const storage = goal(); const storageContext = context(storage); storageContext.persistenceHold = 'Auditor cursor could not be saved';
const list = goal(); list.goal!.policy = 'list';
const adopted = adoptRespecRequirements(createRespecBuilder('Export the project'), [{ id: 'export', text: 'Export', acceptance: 'Round trip' }]);
const builder = beginRespecAudit(claimRespecTask(planRespecIncrement(adopted, [{ id: 'task', text: 'Implement export', requirementIds: ['export'] }]), 'task'), 'capture-project', 'Round trip checked');
const project: State = { goal: null, list: [], loop: { active: true, builder, target: builder.vision, startedAt: at,
  iteration: 1, maxIterations: 0, plateauWindow: 5, stallCount: 0, bestValue: null, lastValue: null, history: [] } };
const loop = structuredClone(project); delete loop.loop!.builder;
const stopped = structuredClone(project); stopped.loop!.active = false; stopped.loop!.stopReason = 'stopped by user (/loop stop)';
const fixtures: Array<{ name: string; state: State; audit?: AuditDisplayProgress; context?: UiStatusContext }> = [
  { name: 'Goal / live audit', state: goal(), audit: fresh },
  { name: 'List item / live audit', state: list, audit: fresh },
  { name: 'Goal / bounded tool wait', state: goal(), audit: tool },
  { name: 'Goal / quiet audit', state: goal(), audit: { ...fresh, startedAt: now - 240000, elapsedMs: 240000, lastActivityAt: now - 240000 } },
  { name: 'Goal / stalled audit', state: goal(), audit: { ...fresh, startedAt: now - 7200000, elapsedMs: 7200000, lastActivityAt: now - 7200000 } },
  { name: 'Goal / worker unconfirmed', state: goal() },
  { name: 'Goal / persistence stop', state: storage, audit: fresh, context: storageContext },
  { name: 'Loop / project audit tool wait', state: project },
  { name: 'Loop / explicitly stopped project', state: stopped },
  { name: 'Loop / plain objective', state: loop },
];
const stale: AuditDisplayProgress = { ...fresh, startedAt: now - 60000, elapsedMs: 60000, lastActivityAt: now - 40000 };
const detailedFixtures = [fixtures[0], fixtures[1],
  { name: 'Goal / stale worker', state: goal(), audit: stale },
  { name: 'List item / stale worker', state: list, audit: stale },
  fixtures[2], { name: 'List item / bounded tool wait', state: list, audit: tool }, fixtures[3], fixtures[4], fixtures[6]];
const directory = path.resolve('audit/audit-status-captures'); fs.mkdirSync(directory, { recursive: true });
setRespecAuditLive(builder, { phase: 'running', workerPhase: 'tool_executing', startedAt: now - 800000,
  currentTool: 'bash', currentToolStartedAt: now - 677000, toolTimeoutMs: 900000, lastActivityAt: now - 677000 });
try {
  for (const compact of [true, false]) for (const width of [40, 120]) {
    const selected = compact ? fixtures : detailedFixtures;
    const stem = `${width}${compact ? '' : '-detailed'}`;
    const rows: string[] = [];
    for (const fixture of selected) {
      rows.push(theme.fg('dim', `── ${fixture.name}`));
      const extras = { compactAuditCard: compact, maxWidgetLines: compact ? 8 : 12, uiStatusContext: fixture.context ?? context(fixture.state) };
      rows.push(...(buildWidgetLines(fixture.state, fixture.audit, now, theme, width, extras) ?? []));
      rows.push(buildStatusText(fixture.state, fixture.audit, now, theme, extras, width) ?? '', '');
    }
    fs.writeFileSync(path.join(directory, `${stem}.ansi`), rows.join('\r\n') + '\r\n');
    fs.writeFileSync(path.join(directory, `${stem}.json`), JSON.stringify({ width, rows: rows.length, fixedNow: new Date(now).toISOString(),
      compact, fixtures: selected.map(fixture => fixture.name), source: 'production card/footer fixtures; not a full live Pi viewport' }, null, 2) + '\n');
  }
} finally { setRespecAuditLive(builder); }

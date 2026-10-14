// Deterministic current production UI, from real adapter/journal reload fixtures.
// No live provider, external project, or user terminal is touched.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { registerRespecBuilderTools, runRespecBuilderAudit } from '../extensions/respec-builder-runtime.js';
import { createRespecBuilder, adoptRespecRequirements, planRespecIncrement, claimRespecTask, beginRespecAudit } from '../extensions/respec-builder.js';
import { state, replaceState, persistStateLine } from '../extensions/goal-state.js';
import { readState } from '../extensions/goal-loop-core.js';
import { buildWidgetLines, buildStatusText, type DisplayTheme } from '../extensions/goal-loop-display.js';
const now = Date.parse('2026-10-14T12:00:00Z');
const directory = path.resolve('audit/infrastructure-diagnostics-captures');
fs.mkdirSync(directory, { recursive: true });
const original = state;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glla-diagnostics-capture-'));
const palette: Record<string, number> = { accent: 147, success: 72, warning: 179, error: 168, dim: 244, muted: 245 };
const theme: DisplayTheme = { fg: (color, text) => `\x1b[38;5;${palette[color] ?? 252}m${text}\x1b[0m` };
const captures: { name: string; saved: ReturnType<typeof readState> }[] = [];
try {
  for (const [name, error] of [
    ['Auth repair / model scope denied', 'HTTP 401 model alpha scope denied; Authorization: Bearer FIXTURE_SECRET'],
    ['Config repair / model missing', 'No auditor model beta configured; API-key=FIXTURE_SECRET'],
  ]) {
    const cwd = path.join(root, name!.startsWith('Auth') ? 'auth' : 'config');
    fs.mkdirSync(cwd);
    const builder = beginRespecAudit(claimRespecTask(planRespecIncrement(adoptRespecRequirements(createRespecBuilder('Export project artifact'),
      [{ id: 'export', text: 'Export artifact', acceptance: 'Export round trip verified' }]),
      [{ id: 'task', text: 'Export implemented', requirementIds: ['export'] }]), 'task'), 'capture-claim', 'Export implemented');
    replaceState({ goal: null, list: [], loop: { active: true, builder, target: builder.vision, startedAt: new Date(now).toISOString(),
      iteration: 1, maxIterations: 0, plateauWindow: 5, stallCount: 0, bestValue: null, lastValue: null, history: [] } });
    persistStateLine(cwd, state);
    const ctx = { cwd, ui: { notify: () => {} } } as unknown as ExtensionContext;
    registerRespecBuilderTools({ registerTool: () => {} } as any, { context: () => ctx, persist: () => persistStateLine(cwd, state),
      wake: () => {}, finished: () => {}, wrapTool: tool => tool, auditNow: () => now, resolveModel: () => ({ model: undefined, error: error! }) });
    await runRespecBuilderAudit(ctx);
    const saved = readState(cwd);
    if (JSON.stringify(saved).includes('FIXTURE_SECRET')) throw new Error('Fixture secret leaked');
    captures.push({ name: name!, saved });
  }
  for (const width of [40, 120]) {
    const rows = [theme.fg('dim', 'Production project recovery UI / journal fixture'), theme.fg('dim', 'Not a live provider outage'), ''];
    for (const { name, saved } of captures) {
      rows.push(theme.fg('accent', `── ${name}`));
      rows.push(...buildWidgetLines(saved, null, now, theme, width, { maxWidgetLines: 20 })!);
      rows.push(buildStatusText(saved, null, now, theme, undefined, width)!, '');
    }
    if (rows.join('').includes('FIXTURE_SECRET')) throw new Error('Rendered secret leaked');
    fs.writeFileSync(path.join(directory, `${width}.ansi`), rows.join('\r\n') + '\r\n');
    fs.writeFileSync(path.join(directory, `${width}.json`), JSON.stringify({ width, rows: rows.length, fixedNow: new Date(now).toISOString(),
      source: 'Real project retry adapter -> isolated temporary durable journal -> readState -> production widget/status renderers; fixture, not live outage',
      fixtures: captures.map(c => c.name) }, null, 2) + '\n');
  }
} finally { replaceState(original); fs.rmSync(root, { recursive: true, force: true }); }

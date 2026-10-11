import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { inspectFleetHealth, formatFleetHealth } from '../extensions/fleet-health.js';

test('malformed builder phases never reach fleet output as private text or terminal controls', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glla-fleet-phase-'));
  try {
    fs.mkdirSync(path.join(dir, '.pi-glla'));
    const value = { list: [], loop: { active: true, startedAt: '2026-01-01', target: 'private', builder: { phase: '\x1b[2JPRIVATE-WORKFLOW', vision: 'secret' } } };
    fs.writeFileSync(path.join(dir, '.pi-glla', 'active.jsonl'), JSON.stringify({ type: 'state', at: new Date().toISOString(), value }) + '\n');
    const report = await inspectFleetHealth([dir]);
    assert.equal(report.complete, false);
    assert.ok(report.issues.some(issue => issue.kind === 'malformed'));
    assert.doesNotMatch(formatFleetHealth(report).join('\n'), /PRIVATE-WORKFLOW|secret|\x1b/);
    // Defense in depth: formatting an injected status still cannot print
    // arbitrary workflow strings even when the disk reader is bypassed.
    report.projects[0]!.status = { mode: 'project', workflow: value.loop.builder.phase, execution: 'unconfirmed' } as any;
    assert.doesNotMatch(formatFleetHealth(report).join('\n'), /PRIVATE-WORKFLOW|\x1b/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

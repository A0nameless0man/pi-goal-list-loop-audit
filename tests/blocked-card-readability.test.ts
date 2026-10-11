import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleWidth } from '@earendil-works/pi-tui';
import type { State } from '../extensions/goal-loop-core.js';
import { buildWidgetLines, buildStatusText } from '../extensions/goal-loop-display.js';
import { projectUiStatus } from '../extensions/ui-status.js';

const now = Date.parse('2026-10-11T13:49:41Z');
const reason = 'Books has 105 missing current-byte cover admissions, not 105 proven identity mismatches. Nine apps passed; Books also lacks a Studio navigation link. Artwork remediation needs explicit permission.';
const action = 'Supply current hash-bound cover admissions and the Books Studio link, or authorize artwork remediation. Do not bypass the release gate.';
const state: State = { goal: { id: 'readability', objective: 'Ship Studio navigation', status: 'paused', policy: 'goal', autoContinue: true,
  createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
  pauseKind: 'blocked', pauseReason: reason, pauseSuggestedAction: action,
  usage: { tokensUsed: 0, tokensLimit: 1000000 } }, list: [] };

test('paused workflow does not claim working, even with stale running evidence', () => {
  const context = { now, generation: 1, evidence: { ownerKey: 'goal:readability', generation: 1, session: 'open' as const, observedAt: now, turnActive: true } };
  const status = projectUiStatus(state, context);
  assert.equal(status.workflow, 'paused');
  assert.equal(status.execution, 'blocked');
  assert.equal(status.actionability, 'user');
  const text = buildStatusText(state, undefined, now, undefined, { uiStatusContext: context }, 200)!;
  assert.match(text, /goal paused/);
  assert.doesNotMatch(text, /goal working|RUNNING|retrying automatically/);
});

test('blocked production card wraps the cause and action instead of cutting them horizontally', () => {
  for (const width of [40, 80, 120]) for (const compactAuditCard of [false, true]) {
    const rows = buildWidgetLines(state, undefined, now, undefined, width, { uiStatusContext: { now }, compactAuditCard })!;
    assert.ok(rows.every(row => visibleWidth(row) <= width), `${width}: bounded terminal rows`);
    assert.match(rows.join('\n'), /paused/);
    assert.match(rows.join('\n'), /why:/);
    assert.match(rows.join('\n'), /next:/);
    assert.match(rows.at(-1)!, /details: \/glla status/);
    if (!compactAuditCard || width >= 80) {
      const plain = rows.slice(2, -1).map(row => row.slice(3)).join(' ');
      assert.ok(plain.includes('Do not bypass the release gate.'), plain);
      assert.ok(plain.includes('not 105 proven identity mismatches.'), plain);
      assert.ok(plain.includes('Artwork remediation needs explicit permission.'), plain);
    }
  }
});

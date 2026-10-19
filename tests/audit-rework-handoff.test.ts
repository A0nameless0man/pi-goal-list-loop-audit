import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleWidth } from '@earendil-works/pi-tui';
import { auditReworkOverview, auditReworkNotice } from '../extensions/audit-rework-handoff.js';
import { buildStatusText, buildWidgetLines } from '../extensions/goal-loop-display.js';
import type { State } from '../extensions/goal-loop-core.js';
import { suppressAuditorSurfaceAfterColdRestore, releaseAuditorSurface } from '../extensions/loops/goal-auditor-surface.js';

const NOW = Date.parse('2026-10-19T10:52:00Z');
const report = `Prior review approved the findings.\n<approved/>\n--- challenge ---\n## Required fixes\n1. [HIGH] Prove the parallel scout run with inspectable artifacts.\n2. [HIGH] Correct FIX versus DECIDE classifications before resubmitting.\n3. [HIGH] Explain which staged edits belong to this pass.\n\n<evidence>\nOutput:\n\`\`\`\nFile: /some/project/.git/modules/fixture/index\nAccess: 2026-10-19\n15994 findings.md\n\`\`\`\n</evidence>\n<disapproved/>`;
function fixture(): State {
  return { goal: { id: 'rework-owner', objective: 'Collect audit findings without changing code', status: 'active', policy: 'list',
    autoContinue: true, usage: { tokensUsed: 0, tokensLimit: 1000000 }, createdAt: new Date(NOW - 7 * 3600000).toISOString(), updatedAt: new Date(NOW).toISOString(),
    pauseReason: 'auditor disapproved', auditHistory: [{ at: new Date(NOW).toISOString(), model: 'fixture', approved: false, disapproved: true, report }] }, list: [] };
}

test('notice selects actionable objections, assigns them to the agent, and leaves evidence in the full report', () => {
  const overview = auditReworkOverview(report);
  assert.equal(overview.count, 3);
  const notice = auditReworkNotice(report, '/list status');
  for (const action of ['Prove the parallel scout run', 'Correct FIX versus DECIDE', 'Explain which staged edits']) assert.ok(notice.includes(action));
  assert.match(notice, /Agent/);
  assert.match(notice, /You:.*no approval/i);
  assert.match(notice, /idle.*continue/i);
  assert.match(notice, /\/list status/);
  assert.doesNotMatch(notice, /15994|Access:|Output:|<evidence>|<approved|<disapproved|head truncated|\.git\/modules/);
  assert.ok(notice.length < 850);
});

test('only final required corrections count, never quoted evidence bullets or an earlier verdict', () => {
  const mixed = '## Required fixes\n- Superseded first-round objection\n## Earlier verdict\n<approved/>\n## Required fixes\n- Correct the final objection\n<evidence>\n- Ignore this quoted old finding\n</evidence>';
  const overview = auditReworkOverview(mixed);
  assert.equal(overview.count, 1);
  assert.match(overview.items[0]!, /final objection/);
  assert.doesNotMatch(auditReworkNotice(mixed, '/list status'), /Superseded|quoted old finding/);
});

test('required-fixes headings inside evidence or fenced quotes cannot replace the actual objections', () => {
  for (const quote of ['<evidence>\n## Required fixes\n- Quoted stale objection\n</evidence>', '```markdown\n## Required fixes\n- Quoted stale objection\n```', '~~~~markdown\n## Required fixes\n- Quoted stale objection\n~~~~']) {
    const overview = auditReworkOverview(`## Required fixes\n- Correct the real objection\n${quote}`);
    assert.equal(overview.count, 1);
    assert.match(overview.items[0]!, /real objection/);
    assert.doesNotMatch(overview.items.join(' '), /stale objection/);
  }
});

// v0.39.40 (audit 2026-10-19): the evidence-block filter matched the
// substring "<evidence" ANYWHERE on a line, so one prose sentence that
// mentioned the tag ("the run log is in the <evidence> block below") put the
// reader into evidence mode for the rest of the report and silently
// discarded the Required-fixes section. The projection then reported zero
// objections for a report that had them, and told the user to go read the
// saved report instead.
//
// An evidence block is a TAG: only a line that IS the tag opens one.
test('a prose mention of the evidence tag cannot erase the required-fixes section', () => {
  const mentioned = auditReworkOverview([
    'The scout run log is in the <evidence> block below.',
    '## Required fixes',
    '1. [HIGH] Prove the parallel scout run with inspectable artifacts.',
    '2. [HIGH] Correct FIX versus DECIDE classifications.',
  ].join('\n'));
  assert.equal(mentioned.count, 2, 'a prose mention must not hide the objections');
  assert.match(mentioned.items[0]!, /Prove the parallel scout run/);
  assert.match(mentioned.items[1]!, /FIX versus DECIDE/);
});

test('a required fix that asks for an evidence block is still projected', () => {
  const asks = auditReworkOverview([
    '## Required fixes',
    '1. [HIGH] Attach an <evidence> block with the scout run log.',
    '2. [HIGH] Correct FIX versus DECIDE classifications.',
  ].join('\n'));
  assert.equal(asks.count, 2, 'the objection that mentions the tag is still an objection');
  assert.match(asks.items[0]!, /Attach an/);
  assert.match(asks.items[1]!, /FIX versus DECIDE/);
});

test('a real evidence block is still removed from the projection', () => {
  const blocked = auditReworkOverview([
    '## Required fixes',
    '1. [HIGH] Prove the parallel scout run with inspectable artifacts.',
    '<evidence>',
    '## Required fixes',
    '- Quoted stale objection',
    '</evidence>',
  ].join('\n'));
  assert.equal(blocked.count, 1);
  assert.match(blocked.items[0]!, /Prove the parallel scout run/);
  assert.doesNotMatch(blocked.items.join(' '), /stale objection/);
});

test('cold-restore consent still hides audit objections on the new compact path', () => {
  const state = fixture();
  suppressAuditorSurfaceAfterColdRestore(state.goal!.id);
  try {
    const text = buildWidgetLines(state, undefined, NOW, undefined, 120, { uiStatusContext: { now: NOW } })!.join('\n');
    assert.doesNotMatch(text, /Prove the parallel scout run|Correct FIX versus DECIDE|Explain which staged edits|you:.*continue/i);
  } finally {
    releaseAuditorSurface(state.goal!.id);
  }
});

test('legacy escaped-line reports preserve objections without rewriting the stored input', () => {
  const legacy = '## Required fixes\\n- fix the pinned gap\\n- rerun the regression check\\n<disapproved/>';
  const notice = auditReworkNotice(legacy, '/goal status');
  assert.match(notice, /fix the pinned gap/);
  assert.match(notice, /rerun the regression check/);
  assert.doesNotMatch(notice, /<disapproved|\\\\n/);
  assert.ok(legacy.includes('\\n'), 'projection never changes the stored input');
});

test('unknown reports are not summarized from arbitrary evidence or invented objections', () => {
  const notice = auditReworkNotice('<evidence>\nOutput:\n0 fail\n</evidence>\n<disapproved/>', '/goal status');
  assert.match(notice, /read.*report/i);
  assert.match(notice, /\/goal status/);
  assert.doesNotMatch(notice, /0 fail|Output:|<evidence>/);
  assert.equal(auditReworkOverview('## Required fixes\n\n<disapproved/>').count, 0);
});

test('handoffs stay bounded and redact provider payloads even inside required fixes', () => {
  const notice = auditReworkNotice('## Required fixes\n- provider returned 429 Token Plan request_id=secret-request\n403\n{ "account": "secret-account", "message": "Token Plan rate limit reached" }\n' + Array.from({ length: 12 }, (_, i) => `- [HIGH] Correct case ${i}: ` + 'long '.repeat(200)).join('\n'), '/list status');
  assert.doesNotMatch(notice, /429|403|Token Plan|secret-request|secret-account|rate limit/);
  assert.ok(notice.length < 850);
  assert.match(notice, /more|of /);
});

test('compact rejection card offers recovery when start is unconfirmed, not a raw report or a false work claim', () => {
  const state = fixture();
  for (const width of [40, 120, 240]) {
    const extras = { uiStatusContext: { now: NOW }, compactAuditCard: true };
    const rows = buildWidgetLines(state, undefined, NOW, undefined, width, extras)!;
    const text = rows.join('\n');
    assert.ok(rows.length <= 8, text);
    assert.ok(rows.every(line => visibleWidth(line) <= width));
    assert.match(text, /changes requested/i);
    assert.match(text, /agent:/i);
    assert.match(text, /you:.*continue/i);
    assert.match(text, /\/glla status/);
    assert.doesNotMatch(text, /latest audit feedback|## Required fixes|Access:|15994|selected:|compaction:|No action needed|agent is working|· working ·/i);
    assert.match(buildStatusText(state, undefined, NOW, undefined, extras, width)!, /continue/i);
  }
});

test('short terminal budgets retain the person\'s recovery action before report/task detail', () => {
  for (const maxWidgetLines of [4, 6]) {
    const text = buildWidgetLines(fixture(), undefined, NOW, undefined, 120, { uiStatusContext: { now: NOW }, maxWidgetLines })!.join('\n');
    assert.ok(text.split('\n').length <= maxWidgetLines);
    assert.match(text, /you:.*continue/i);
    assert.match(text, /agent:/i);
    assert.match(text, /\/glla status/);
  }
});

// v0.39.40 (audit 2026-10-19): the truncation marker covered next/why/resume/
// candidate but not the compact card's "agent:" field, which carries the
// required corrections. When the wrapped field lost its continuation the
// user saw a mid-sentence fragment — "…classifications before" — with no
// marker, and read it as the complete list of objections while the header
// still said "3 corrections".
test('a truncated objections field says it is truncated instead of reading as complete', () => {
  // The "agent:" field is a start line plus its "│  " continuations.
  const objectionsField = (rows: string[]): string => {
    const start = rows.findIndex(row => row.includes('agent:'));
    assert.ok(start >= 0, 'the reserved objections field must survive the budget');
    let end = start + 1;
    while (end < rows.length && rows[end]!.trimStart().startsWith('│')) end++;
    return rows.slice(start, end).join('\n');
  };
  for (const maxWidgetLines of [4, 5, 6]) {
    const rows = buildWidgetLines(fixture(), undefined, NOW, undefined, 120, { uiStatusContext: { now: NOW }, maxWidgetLines })!;
    const field = objectionsField(rows);
    assert.doesNotMatch(field, /Explain which staged edits/, 'this budget drops the last objection');
    assert.match(field, /…/, 'a dropped continuation must be marked, not presented as the whole field');
  }
  // A budget that fits the whole field must NOT claim a truncation.
  const complete = buildWidgetLines(fixture(), undefined, NOW, undefined, 120, { uiStatusContext: { now: NOW }, maxWidgetLines: 7 })!;
  const completeField = objectionsField(complete);
  assert.match(completeField, /Explain which staged edits/);
  assert.doesNotMatch(completeField, /…/, 'a field that fits completely must not be marked as truncated');
});

test('observed work and manual holds retain honest ownership rather than always requesting a restart', () => {
  const state = fixture();
  const live = { now: NOW, generation: 1, evidence: { ownerKey: 'goal:rework-owner', generation: 1, observedAt: NOW, session: 'open' as const, turnActive: true } };
  const text = buildWidgetLines(state, undefined, NOW, undefined, 120, { uiStatusContext: live })!.join('\n');
  assert.match(text, /you:.*no action needed/i);
  assert.doesNotMatch(text, /you:.*continue/i);
  const held = buildWidgetLines(state, undefined, NOW, undefined, 120, { uiStatusContext: { ...live, persistenceHold: 'Journal write failed' } })!.join('\n');
  assert.match(held, /persistence failure|Journal write failed/i);
  assert.doesNotMatch(held, /you:.*no action needed|you:.*continue/i);
});

import { extractRequiredFixSeverities, sanitizeProviderAuditReport } from './goal-loop-core.js';
import { humanTextPreview } from './human-handoff.js';

/** Human-facing projection only: raw evidence and the complete executor brief
 * stay in the saved audit report. Never infer objections from evidence logs. */
export function auditReworkOverview(report: string): { count: number; items: string[]; redacted: boolean } {
  const safe = sanitizeProviderAuditReport(report);
  // Some older stored reports contain literal escaped line breaks. Decode
  // only that single-line report shape for presentation, never its archive.
  const readable = !safe.includes('\n') && /##\s+Required fixes\\n/i.test(safe)
    ? safe.replaceAll('\\n', '\n') : safe;
  // Remove supporting blocks *before* choosing a heading: an evidence
  // quote can itself contain "## Required fixes" from an older report.
  const visible: string[] = [];
  let fence: string | undefined;
  let evidence = false;
  for (const line of readable.split('\n')) {
    if (evidence) {
      if (/<\/evidence\s*>/i.test(line)) evidence = false;
      continue;
    }
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && /^\s*(?:`+|~+)\s*$/.test(line)) fence = undefined;
      continue;
    }
    // An evidence block is a TAG, not a mention. Only a line that IS the
    // tag opens one, and a line that carries a complete open/close pair is
    // dropped on its own. A prose mention ("the run log is in the <evidence>
    // block below") must NOT silence the rest of the report: matching the
    // substring anywhere made one sentence erase the Required-fixes section
    // and report zero objections for a report that had them.
    if (/<evidence\b/i.test(line) && /<\/evidence\s*>/i.test(line)) continue;
    if (/^\s*<evidence\b/i.test(line)) { evidence = true; continue; }
    if (marker) { fence = marker; continue; }
    visible.push(line);
  }
  // A falsification round can supersede an earlier verdict's objections.
  const prose = visible.join('\n');
  const lastHeading = [...prose.matchAll(/^##\s+Required fixes\s*$/gim)].at(-1);
  const section = lastHeading ? prose.slice(lastHeading.index) : '';
  const required = extractRequiredFixSeverities(section);
  return {
    count: required.length,
    redacted: /provider diagnostic redacted/i.test(safe),
    items: required.slice(0, 3).map(fix => humanTextPreview(fix.text.replace(/^\[(?:HIGH|MED|LOW)\]\s*/, ''), 160)),
  };
}

/** Scheduling a continuation is not proof of execution. State ownership and
 * an idle-session recovery action without promising the agent has started. */
export function auditReworkNotice(report: string, statusCommand: string): string {
  const { count, items, redacted } = auditReworkOverview(report);
  return [
    'Completion review: changes requested.',
    count ? `Agent: address ${count} required correction${count === 1 ? '' : 's'}, then resubmit.`
      : 'Agent: read the saved report and resolve the objection before resubmitting.',
    ...(redacted ? ['Provider diagnostic redacted; the saved report retains the evidence.'] : []),
    ...items.map(item => `• ${item}`),
    ...(count > items.length ? [`${count - items.length} more in the full report.`] : []),
    'You: no approval requested. If work stays idle, send "continue" in this session.',
    `Full report: ${statusCommand}`,
  ].join('\n');
}

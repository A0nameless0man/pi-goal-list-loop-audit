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
  // A falsification round may follow an earlier verdict. Use its final
  // Required-fixes section, and stop before evidence/fenced command output:
  // bullets quoted inside those blocks are not new objections.
  const lastHeading = [...readable.matchAll(/^##\s+Required fixes\s*$/gim)].at(-1);
  const section = lastHeading ? readable.slice(lastHeading.index).split(/^\s*(?:<evidence\b|```|~~~)/im)[0]! : '';
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

import { extractRequiredFixSeverities, sanitizeProviderAuditReport } from './goal-loop-core.js';
import { humanTextPreview } from './human-handoff.js';

/** Human-facing projection only: raw evidence and the complete executor brief
 * stay in the saved audit report. Never infer objections from evidence logs. */
export function auditReworkOverview(report: string): { count: number; items: string[] } {
  const required = extractRequiredFixSeverities(sanitizeProviderAuditReport(report));
  return {
    count: required.length,
    items: required.slice(0, 3).map(fix => humanTextPreview(fix.text.replace(/^\[(?:HIGH|MED|LOW)\]\s*/, ''), 160)),
  };
}

/** Scheduling a continuation is not proof of execution. State ownership and
 * an idle-session recovery action without promising the agent has started. */
export function auditReworkNotice(report: string, statusCommand: string): string {
  const { count, items } = auditReworkOverview(report);
  return [
    'Completion review: changes requested.',
    count ? `Agent: address ${count} required correction${count === 1 ? '' : 's'}, then resubmit.`
      : 'Agent: read the saved report and resolve the objection before resubmitting.',
    ...items.map(item => `• ${item}`),
    ...(count > items.length ? [`${count - items.length} more in the full report.`] : []),
    'You: no approval requested. If work stays idle, send "continue" in this session.',
    `Full report: ${statusCommand}`,
  ].join('\n');
}

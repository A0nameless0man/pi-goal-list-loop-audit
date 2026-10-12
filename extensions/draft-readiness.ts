/** Bounded pre-confirmation diagnostics, not a general semantic verifier.
 * A finding requests a revised draft; it never edits or waives a contract.
 */
export interface DraftReadinessIssue {
  code: "procedural-intent" | "external-action-without-criteria" | "bookkeeping-only";
  clarification: string;
}
const MAX_TEXT = 64 * 1024;
export function assessDraftReadiness(objective: string, contract = ""): DraftReadinessIssue[] {
  // Oversized prose is outside these narrowly supported pattern diagnostics.
  if (objective.length > MAX_TEXT || contract.length > MAX_TEXT) return [];
  const text = objective.trim();
  const criteria = contract.trim();
  const issues: DraftReadinessIssue[] = [];
  if (/^review the latest auditor disapproval in \/goal status[.!]?$/i.test(text)
    && /\b(?:bun|npm|pnpm|npx)\b.*\b(?:test|check|lint)|\b(?:full unit suite|implementation|browser gates)\b/i.test(criteria)) {
    issues.push({code:"procedural-intent",clarification:"The objective names only an inspection step, but the criteria require implementation gates. Recover the authorized deliverable from provenance, or explicitly scope a review-only report and its matching criteria before confirmation."});
  }
  if (/^(?:(?:ok|okay)[, ]+)?(?:let['’]?s|lets)?\s*(?:upload|publish|release|deploy)\b/i.test(text) && !criteria) {
    issues.push({code:"external-action-without-criteria",clarification:"Specify the authorized artifact inventory, destination and visibility/publication boundaries, plus observable completion evidence. Reuse established user answers where available; ask only for material facts still missing."});
  }
  // Exact generated finding template: do not reject legitimate commit-only
  // administrative tasks or assume every contract mentioning git is weak.
  if (/^fix audit finding:/i.test(text)
    && /^the fix is committed on the current branch with the repo['’]s configured identity, and this finding['’]s box in \.pi-glla\/audit-loop\/findings\.md is checked\b/i.test(criteria)
    && !/\b(?:tests?|typecheck|regression|runtime|behavior|behaviour|build)\b/i.test(criteria)) {
    issues.push({code:"bookkeeping-only",clarification:"A commit and checked finding box prove bookkeeping, not the fix. Add a finding-specific behavioral or source-integrity gate and appropriate affected tests/types before confirmation; preserve the original finding."});
  }
  return issues;
}
export function draftReadinessMessage(issues: readonly DraftReadinessIssue[]): string {
  return `Draft needs clarification before confirmation; no work was activated or replaced.\n${issues.map(issue => `- ${issue.code}: ${issue.clarification}`).join("\n")}\nRevise the draft using established intent and evidence; do not invent consent or weaken acceptance criteria.`;
}

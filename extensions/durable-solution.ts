import { clipSummaryValue } from "./finding-lead.js";

export interface SolutionTarget {
  mode: "goal" | "list" | "loop" | "project";
  id: string;
  revision: number;
}
export interface SolutionBlocker {
  kind: "unsafe" | "impossible" | "external-blocked";
  evidence: string;
}
export interface SolutionWorkaround {
  action: string;
  safety: string;
  rollback: string;
  verification: string;
}
export interface SolutionJudgmentInput {
  choice: "inline" | "deferred";
  reason: string;
  durableFix?: string;
  evidence?: string;
  followUp?: string;
  durableBlocked?: boolean;
  blocker?: SolutionBlocker;
  workaround?: SolutionWorkaround;
}
/** Executor assertions, never an implementation verdict or scope authority. */
export interface SolutionJudgment extends SolutionJudgmentInput {
  version: 1;
  target: SolutionTarget;
  at: string;
  durableFix: string;
  evidence: string;
  authority: "executor-assertion";
}
export type JudgmentAdmission = { ok: true; judgment: SolutionJudgment } | { ok: false; error: string };
const compact = (value: unknown): string => typeof value === "string" ? clipSummaryValue(value, 1000) : "";

/** Structural evidence obligations, not a prose-based architectural judge. */
export function admitSolutionJudgment(input: SolutionJudgmentInput, target: SolutionTarget, at: string): JudgmentAdmission {
  const reason = compact(input.reason), durableFix = compact(input.durableFix), evidence = compact(input.evidence);
  if (!reason) return { ok: false, error: "A non-empty reason is required." };
  if (!durableFix || !evidence) return { ok: false, error: "Name the durableFix and concrete evidence (reproduction, inspected artifact or observed result). A choice alone is not evidence." };
  const followUp = compact(input.followUp);
  if (input.choice === "deferred" && !followUp) return { ok: false, error: "A deferred judgment also requires a durable follow-up." };
  if (input.choice === "deferred" && (input.durableBlocked !== true || !input.blocker ||
      !["unsafe", "impossible", "external-blocked"].includes(input.blocker.kind) || !compact(input.blocker.evidence))) {
    return { ok: false, error: "Deferral requires durableBlocked=true and a typed unsafe/impossible/external-blocked blocker with concrete evidence. Routine implementation difficulty is work, not a waiver." };
  }
  if (input.choice === "inline" && (input.durableBlocked === true || input.workaround)) {
    return { ok: false, error: "An inline durable fix cannot simultaneously claim a blocked fix or a workaround." };
  }
  let workaround: SolutionWorkaround | undefined;
  if (input.workaround) {
    const { action, safety, rollback, verification } = input.workaround;
    if (![action, safety, rollback, verification].every(value => compact(value))) {
      return { ok: false, error: "A workaround needs its action, safety boundary, rollback and reproducible verification; it is not final completion." };
    }
    workaround = { action: compact(action), safety: compact(safety), rollback: compact(rollback), verification: compact(verification) };
  }
  return { ok: true, judgment: { version: 1, target: { ...target }, at, authority: "executor-assertion", choice: input.choice,
    reason, durableFix, evidence, ...(followUp ? { followUp } : {}),
    ...(input.choice === "deferred" ? { durableBlocked: true, blocker: { kind: input.blocker!.kind, evidence: compact(input.blocker!.evidence) } } : {}),
    ...(workaround ? { workaround } : {}) } };
}

export function judgmentMatchesTarget(judgment: SolutionJudgment, target: SolutionTarget): boolean {
  return judgment.target.mode === target.mode && judgment.target.id === target.id && judgment.target.revision === target.revision;
}

/** Facts are not upgraded merely because a caller calls them a receipt. */
export type OutcomeEvidenceKind = "installation" | "runtime-observation" | "behavioral-check" | "journal-marker";
export interface OutcomeClaim { kind: OutcomeEvidenceKind; evidence: string }
export function outcomeClaimLimit(claim: OutcomeClaim, required: "loaded" | "executed"): string {
  if (claim.kind === "installation") return `Installation metadata does not establish ${required} behavior.`;
  if (claim.kind === "journal-marker") return `A journal marker is bookkeeping, not proof of ${required} behavior.`;
  if (required === "executed" && claim.kind !== "behavioral-check") return "Loading is not proof of successful execution.";
  return "Executor-asserted observation: independent inspection/reproduction is required, including the target and current revision.";
}

export const DURABLE_SOLUTION_POLICY = `DURABLE SOLUTION AND EVIDENCE:
- Prefer the in-scope root-cause fix, not a cosmetic symptom patch. Record concrete observed evidence and the maintainable correction with record_goal_judgment.
- A deferred correction needs a genuine unsafe/impossible/external blocker and durable follow-up. Any workaround needs a safety boundary, rollback and reproducible verification. Recording this permits bounded work, not completion or removal of committed obligations.
- Intent, a selected recommendation, test counts, ledger markers and summaries are assertions, not implementation proof. Installation/source metadata is not a loaded-runtime receipt; loading is not successful behavioral execution. Inspect the real target, current revision and observed behavior.
- Never weaken the objective or acceptance checks to pass review. Scope amendments need specific user consent; prior proof is not current after a revision change.
- Preserve each mode: goal/list need independent completion audit; ordinary loop bounds, plateau and explicit user finish are stopping conditions, not an independent implementation verdict. Project requirements need their own current independent verification.`;

export function solutionJudgmentBrief(judgment: SolutionJudgment | undefined): string {
  return judgment ? `Recorded executor assertion (not approval; recheck target/revision and inspect cited evidence):\n${JSON.stringify(judgment)}` : "No typed durable-solution judgment recorded. Do not infer proof from missing or legacy metadata.";
}

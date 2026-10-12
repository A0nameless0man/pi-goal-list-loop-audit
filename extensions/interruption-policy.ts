/** Typed reference policy for the hands-off execution boundary.
 * Callers must supply supported facts, not infer consent from prose.
 * This module does not dispatch commands, amend contracts, or resume holds.
 * pause_goal integrates this policy for supported typed interruption facts.
 */
export type InterruptionReason =
  | "missing-permission" | "missing-input" | "unauthorized-irreversible-action"
  | "contract-conflict" | "mechanical-verification" | "reversible-work"
  | "runtime-dependency" | "unclassified";

export interface InterruptionFacts {
  phase: "drafting" | "execution";
  reason: InterruptionReason;
  /** Explicit user/supervisor holds remain authoritative in either phase. */
  explicitHold: boolean;
  /** True only when the next step and its authorization are established. */
  authorizedNextStep: boolean;
}
export type InterruptionDisposition = "preserve-hold" | "clarify-before-confirmation"
  | "material-exception" | "continue-authorized-work" | "supervised-wait"
  | "investigate-without-consent";

export function classifyInterruption(facts: InterruptionFacts): InterruptionDisposition {
  if (facts.explicitHold) return "preserve-hold";
  const material = facts.reason === "missing-permission" || facts.reason === "missing-input"
    || facts.reason === "unauthorized-irreversible-action" || facts.reason === "contract-conflict";
  if (material) return facts.phase === "drafting" ? "clarify-before-confirmation" : "material-exception";
  if (facts.reason === "runtime-dependency") return "supervised-wait";
  if ((facts.reason === "mechanical-verification" || facts.reason === "reversible-work")
    && facts.authorizedNextStep) return "continue-authorized-work";
  // Unknowns are not evidence of consent or a human-only blocker. Diagnose
  // locally; if material missing facts are established, reclassify explicitly.
  return "investigate-without-consent";
}

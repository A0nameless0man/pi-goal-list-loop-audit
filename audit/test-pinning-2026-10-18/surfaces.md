# Instruction reach and authority

Baseline: `7ab03c4dcab9fa78daa679be74b7bef14fd167e8`. Case inputs and rubric frozen before introducing `extensions/verification-value.ts`.

| Consumer | Actual renderer/seam | Policy delivery |
| --- | --- | --- |
| Goal/list continuation | `extensions/goal-continuation.ts:continuationPrompt` assembles `goal-loop-continuation.md` and substitutes `LONG_RUNNING_JUDGMENT_POLICY` from `goal-loop-core.ts` | Canonical executor policy included by that shared constant; no new detail trigger is necessary. |
| Metric and metricless loops | `extensions/goal-loop.ts:loopPrompt` prefixes the selected template with `solutionPolicy` | Prefix contains the same executor policy. The metricless example no longer treats any test addition as sufficient progress. |
| Project builder and respec draft | Earlier branches of `loopPrompt` render `goal-loop-respec-builder.md` or `goal-loop-respec-draft.md` | The same prefix reaches both branches, including continuation after restored state; no additional persisted state. |
| Goal/list independent completion review | `goal-loop-auditor-process.ts:buildPrompt` delegates to `goal-loop-auditor.ts:buildGoalAuditorPrompt` | Canonical review policy includes executor distinctions and evidence-based correction obligations under existing change scope. |
| Project increment independent review | `respec-builder-audit.ts:respecIncrementAuditGoal` constructs a Goal with selected and regression requirements; normal auditor process renders it | Same reviewer policy; unselected requirements are not declared complete. |
| Draft/plan contracts | `LONG_RUNNING_JUDGMENT_POLICY` is reused by goal and loop drafting entry points | The same value rule is available during drafting. This is not permission to silently change a confirmed contract. |

No runtime classifier, scoring tool, schema, settings toggle, persisted gate or completion-state transition was added. Ordinary loop bounds remain stopping conditions, not implementation verdicts. Goal/list and project verification keep their existing independent authority. Review only blocks demonstrated unjustified pins in the existing reviewed scope; unrelated historical findings remain advisory.

Tests verify actual rendered prompts contain the canonical policy object, not a duplicate locked copy of its prose. That is a delivery guarantee, not evidence of production agent compliance. The separately reviewed frozen cases supply bounded semantic evidence; baseline correct outcomes must be reported as ties, not improvement.

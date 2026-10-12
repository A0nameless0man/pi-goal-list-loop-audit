# Hands-off execution: interruption policy and source map

## Confirmed policy

The user selected **material exceptions only**: resolve scope/acceptance/permissions before confirmation; execute mechanical and reversible work autonomously within that contract. Legitimate exceptions are missing permission/input, an irreversible action not already authorized, or genuinely conflicting confirmed requirements. Explicit user/supervisor holds remain authoritative. No contract waiver, invented human evidence, or arbitrary suggested-command execution is implied by a hands-off preference.

The user selected **GLLA fixes plus repair proposals**, not mutation/resumption of external goals. This item establishes the policy/source map; subsequent confirmed list items implement draft-readiness, admission enforcement, truthful contract resolution and external repair proposals. It does not claim those integrations already exist.

## Reference policy and limits

`extensions/interruption-policy.ts` defines typed fact inputs and dispositions; `tests/interruption-policy.test.ts` pins each legitimate exception, ordinary authorized work, unknown evidence, explicit holds, and owned runtime waits. This is a reusable reference classifier, **not yet wired into pause admission**. Inputs must be supported facts; keyword matching alone does not establish permission, conflicts or irreversible actions. Unknown classification calls for local investigation, not presumed consent or an automatic question. Runtime dependency ownership/admission remains the responsibility of existing wait/recovery gates, not this classifier.

| Situation | Drafting | Execution |
| --- | --- | --- |
| Missing material permission/input | Clarify before confirmation | Actionable material exception if unavailable through authorized local investigation |
| Unauthorized irreversible external action | Obtain consent upfront | Do not perform it; request needed authorization |
| Genuinely conflicting confirmed requirements | Resolve invariant upfront | Preserve contract; raise exact conflict, never silently waive |
| Known authorized mechanical verification | Include/check gate | Run verification and process failure evidence; do not ask user to execute it |
| Reversible local implementation | Pick maintainable default | Continue within scope |
| Explicit user/supervisor hold | Preserve | Preserve, never auto-default around it |
| Owned runtime dependency | Identify dependency | Supervised wait/recovery, not a human preference question |
| Unclassified uncertainty | Investigate locally | Investigate without new consent; material findings may justify an exception |

## Eight audited cases: ownership and disposition

The bounded read-only objective audit on 2026-10-12 discovered 52 project journals and 12 readable nonterminal goals. It did not prove current process liveness or complete fleet coverage. Original observations were saved in `/tmp/glla-objectives-audit.json` and `/tmp/glla-objectives-findings.md`; the supported excerpts below retain reviewable substance without relying exclusively on temporary files. External test results quoted here are saved agent claims, not tests executed by this policy item.

| Case | Supported observation / explicit uncertainty | Classification | GLLA ownership and bounded next step |
| --- | --- | --- | --- |
| Darklord | Saved paused objective still embeds `Verification contract (auditor checks each line):` and reports verification-fragment. Current parser separates criteria and the resulting assessment is nonsuspicious; [approved investigation](SUSPICIOUS-DRAFT-2026-10-12.md). | Existing hold, not a new reason to question original intent | Parser/response boundary already fixed. Existing external goal recovery requires a truthful confirmed public repair path; no external migration/resume authorized. |
| Polis | Pause says all eight criteria satisfied but itself reports 9757 pass / 20 fail; contract item 7 says zero failures. It separately cites rejected `2>&1 | tail -3` syntax. | Genuine contract/evidence conflict, not just a mechanical syntax obstacle | GLLA must distinguish syntax repair from semantic waiver and avoid advising resume as approval. Whether the 20 failures remain or were pre-existing is unconfirmed here. PNG count alone does not prove requested generated resolution/live usage; readiness/proposal work must preserve those requirements. |
| Endless-TD | Objective is `Review the latest auditor disapproval in /goal status.` while criteria cover substantial game implementation. Pause asks user to run `/goal verify` after revision mismatch. | Procedural-intent drift plus mechanical verification handoff | Draft/adoption provenance and verify/claim gates are GLLA-owned. Recover authorized intent only from evidence; /goal verify may start audit rather than act as a harmless command, so admission needs authority/lifecycle checks, not blind execution. |
| Freeport | Objective accepts mechanical evidence/unknown comprehension risk; criteria still require three actual player transcripts. Pause recommends `/goal tweak verification contract ...`; handler has no dedicated contract-edit subcommand. | Missing human evidence and substantive contract conflict | Tweak guidance and consent/persistence are GLLA-owned. Keep original criteria until explicitly amended; do not fabricate transcripts. Outcome of actual human sessions remains unconfirmed. |
| AI-auto-video | Active snapshot objective: `ok lets upload the videos but not release`; empty verification contract. | Missing external-action boundaries should be resolved upfront | Draft readiness is GLLA-owned. Destination, inventory, visibility/scheduling and duplicate policy may exist in conversation, which was not inspected; do not assert permission absent or fill it in by guess. |
| Hegemon / Hellhunter | Concrete route/dead-code findings; criteria only require commit plus checked ledger box. | Verification weakness, not a reason to interrupt reversible fixes | GLLA-generated finding contracts can carry behavioral gates upfront. Whether executors independently run stronger checks is unconfirmed. Do not add requirements silently to already-confirmed goals. |
| Deathrun | Pause reports vertical scroll clamp while contract demands runner centered on both axes every tick. | Genuine invariant conflict if reproduced; not a cosmetic choice | Drafting should establish bounded versus exact follow. GLLA must expose the actual conflict without choosing a waiver. Game implementation/viewport behavior was not verified and is not GLLA's repair target. |
| Doomtap | Saved auditing fleet objective spans nine packages/seven locks and multiple suites/builds. | Cross-project scope/ownership readiness issue, not proven implementation failure | GLLA planning/admission can establish project ownership and verification upfront. Snapshot does not prove duplicate writers or a bad implementation. Decompose/re-scope only with consent, never abandon the active claim. |

## Concrete source map: actual enforcement vs prompt guidance

- `extensions/loops/goal-tools.ts`, `pause_goal`: admits agent-authored blocked/error/decision requests; options can imply decision intent. Quota and background waits have special routing. The current schema lacks material-exception fact classification. A plain reason/options request can therefore turn a mechanical step into a user pause.
- Same handler, `decisionPauseBudget` / `runToDone`: auto-defaults decisions after a budget or under run-to-done; promoted suggestions use decline defaults, but generic recommended options do not carry a typed consent boundary. This is **not** a safe substitute for identifying legitimate exceptions. The later admission item must prevent convenience auto-defaults from authorizing forbidden actions or weakening criteria.
- Same handler, `pause_suggestion_promoted_to_decision`: promotes slash suggestions/contract amendments, creating another decision surface. Truthful durable acceptance and safe defaults belong to the separately confirmed resolution item.
- `extensions/goal-commands.ts`, verify route near lines 296–350: `/goal verify` manages an actual completion audit, including parked-claim handling. It is not simply a read-only diagnostic. Mechanical handoff elimination must retain owner/generation, terminal and duplicate-dispatch guards.
- Same file, objective tweak path near lines 1130–1180: applies replacement objective and explicit contract marker semantics through confirmation. It preserves old criteria if absent and can clear them through a bare marker. Misleading `/goal tweak verification contract` prose does not become a contract-only command.
- `extensions/loops/goal-tools.ts`, `propose_goal_draft`; `extensions/goal-loop-core.ts`, `extractVerificationContract`: confirmation/activation and intent/criteria parsing. Draft readiness must collect material omissions before activation without rejecting every short task or using report vocabulary as a blanket detector.
- `extensions/goal-continuation.ts`, `guardGoalBeforeContinuation`: suspicious-objective safety pauses can supersede apparent activation. Existing holds and confirmed intent must stay durable.
- `extensions/background-wait-runtime.ts`: owned background waits and settlement; waiting must not be recast as a decision requiring the user to continue.
- `prompts/goal-loop-continuation.md` and prompt layers: guide agents toward autonomous reversible choices, but prompt text alone is not runtime admission enforcement.

## Implementation boundaries

## Verification evidence

- `timeout 120 npm test -- tests/interruption-policy.test.ts`: 16 pass, zero failures (`/tmp/glla-interruption-policy-tests.log`).
- `timeout 120 npm run check`: exit 0 (`/tmp/glla-interruption-policy-types.log`).
- `git diff --check`: exit 0.

No external objective/journal was amended, resumed or executed by this item. No failed test was waived. No runtime pause semantics changed yet. Subsequent list items must integrate typed supported facts (or a similarly sound admission contract) and add executable tool/runtime tests before claiming fewer mid-run questions in production. Unsupported natural-language contradictions remain explicitly uncertain, not mechanically proven.

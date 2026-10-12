# Mid-execution interruption enforcement — 2026-10-12

## Confirmed boundary and scope

This item implements the [approved policy](INTERRUPTION-POLICY-2026-10-12.md): authorized mechanical/reversible work should continue locally; supported missing permission/input, unauthorized irreversible actions and confirmed-requirement conflicts remain legitimate exceptions. User/supervisor/load holds remain authoritative. No external project or goal is edited, resumed, waived or executed.

The displayed active objective is truncated after `Mechanical` by the previously fixed inline-parser defect in an already-confirmed queued item. This work follows the original confirmed item and its intact runtime verification contract; it does not replace the durable objective or claim arbitrary scope expansion.

## Actual runtime changes

- `pause_goal` admits optional typed `interruption` facts: supported category, concrete evidence and a known routine next step. It invokes `classifyInterruption` before pause persistence. Authorized routine requests return **not paused**, retaining the current turn, objective and criteria; unknown routine authorization requests local investigation rather than inferred consent. No suggested command or decision option is executed/adopted.
- Proposed human decisions lacking material classification are returned for local classification, not made into a picker or automatically adopted. Concrete suggestion promotions retain their separately established consent/decline path.
- Supported material exceptions normalize to blocked/decision, bypass provider/quota reroutes and decision-budget/run-to-done adoption. A mislabeled wait cannot automatically resume missing permission when a timer expires.
- Already-paused/auditing/terminal goals reject late pause replacement. Supervisor/load holds preserve their exact state, even when a late call carries a routine category or command suggestion.
- Supported material exceptions are excluded from the list impossible-item auto-drop path, even without a suggested action. Missing input/permission is not proof of impossibility or consent to skip/advance. Eight list-policy regressions cover all four material categories under blocked and mislabeled wait, preserving criteria, item identity, queue, no archive/dispatch, and restart holds. Legacy truly impossible-list behavior remains tested.
- Generic recommended options are no longer treated as permission under a decision budget/run-to-done preference. The only remaining unattended suggestion default is the existing decline-without-execution path; original criteria remain in force.
- `complete_goal` no longer refuses fresh claims merely because historical audit revision differs. It records `complete_goal_current_revision_audit_required` and starts the existing independent current-revision audit. The current claim cannot reuse historical approval. Existing captured-revision settlement fences still reject an approval if the contract changes during the audit; repeated in-flight claims remain single-dispatch. `/goal verify` remains an optional public audit operation, not a prerequisite handoff to the user.
- Tool descriptions, run-to-done confirmation notice, continuation prompt and `docs/SETTINGS.md` now describe these boundaries instead of promising unconditional recommendation adoption.

## Limits and compatibility

Typed evidence is a caller assertion, not a natural-language proof of consent. The host never dispatches its nextStep command, chooses arbitrary options, or weakens criteria; the executor remains bound to authorized scope and independent verification. Unclassified operational blocked/error pauses retain compatibility, while explicit human **decision** admission requires material classification. This is not interception of upstream question tools or a guarantee that arbitrary prose cannot confuse an agent. Runtime waits/background ownership retain their existing gates. Contract-resolution acceptance/persistence improvements belong to the next confirmed item.

## Verification and preservation

`tests/interruption-admission.test.ts` exercises actual tools: routine mechanical/reversible requests retain active state/criteria, duplicate calls dispatch nothing, all four material categories survive zero budget/run-to-done and restart, wait labels cannot resume missing permission, intentional user pause stays intact, and unclassified decisions/routine authorization request local classification/investigation without consent.

`tests/revision-bound-audit.test.ts` now proves fresh revision audit without a user verify detour, disapproval overriding old approval, repeated claims single-dispatch, and rejection of a concurrent-revision stale approval. Optional manual verify still works. Legacy tests were strengthened/updated to preserve admission failure atomicity and explicit hold semantics, not bypassed.

Focused gates cover interruption admission/policy, budget, run-to-done, revision audits, suggestion consent, failed pause persistence, background waits and late owner-fenced callbacks. Final commands/results:

- `timeout 150 npm test -- tests/interruption-admission.test.ts tests/interruption-policy.test.ts tests/decision-budget.test.ts tests/run-to-done.test.ts tests/revision-bound-audit.test.ts tests/suggestion-acceptance.test.ts tests/pause-admission-failure.test.ts tests/background-wait-runtime.test.ts tests/recovery-owner-fences.test.ts tests/impossible-list-drop.test.ts`: 142 pass, zero failures (`/tmp/glla-interruption-runtime.log`).
- `timeout 120 npm run check`: `EXIT_CODE=0` (`/tmp/glla-interruption-enforcement-types.log`).
- Runtime inventory regenerated; `timeout 30 npm run check:inventory`: `EXIT_CODE=0` (`/tmp/glla-interruption-enforcement-inventory.log`).
- `git diff --check`: exit 0. Independent review `8f5d6510-d830-4ba7-b0e6-3f54d3a79684` found a P1 material-exception/list-auto-drop gap; the production guard and eight list regressions above correct that root cause. Follow-up review is requested before the implementation claim. Full aggregate suite is not claimed passing; the earlier known unrelated widget failures remain in the [follow-up register](FOLLOW-UP-REGISTER-2026-10-12.md).

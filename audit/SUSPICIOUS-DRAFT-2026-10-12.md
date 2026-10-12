# Suspicious confirmed draft — 2026-10-12

## Evidence and ownership

`note.md` names Screenshot_20261012_130230.png. The screenshot shows a confirmed draft reported active, followed by a suspicious-objective warning and a paused footer. Read-only inspection of darklord's `.pi-glla/goals/20261012103358-2zx2bx.md` confirms the actionable objective contains a separate embedded heading, `Verification contract (auditor checks each line):`, with acceptance criteria mentioning archived verdicts. The separately stored verification contract repeats those criteria. No external project or journal was edited.

GLLA's `extractVerificationContract` did not recognize that heading: the criteria remained inside the objective. `assessSuspiciousObjective` consequently evaluated verification/report vocabulary as intent. This is a false positive at the parsing boundary; genuine review fragments must still be rejected. The draft tool also unconditionally reported activation after `scheduleContinuation` synchronously ran the suspicious-objective guard and paused the goal.

## Durable fix

- Extend the explicit line-start marker grammar to recognize `Verification contract:` and the observed parenthesized heading. Do not strip arbitrary prose or relax reviewer-fragment detection.
- After scheduling continuation, inspect the current matching goal and report a confirmed-but-paused result with its reason/resolution instead of instructing the agent to begin work.
- Preserve the confirmed objective and safety pause; do not auto-resume or alter external goals.

## Verification

`npm test -- tests/suspicious-draft-contract.test.ts tests/confirm-draft.test.ts tests/faulty-objective-recovery.test.ts`: 58 pass, zero failures. Parser tests cover the reduced field reproduction, ordinary imperative prose, and genuine review fragments. Runtime drafting tests confirm both paths: the field-style actionable draft stays active with preserved intent/criteria, while a genuine review fragment preserves its objective in a durable pause and receives a non-runnable tool response.

`npm run check`: exit 0. Logs: `/tmp/glla-suspicious-tests.log`, `/tmp/glla-suspicious-types.log`.

Expanded verification: regression-shield, behavioral-orchestrator and paused-suspicious-close produced 197 passes and two failures. Both are pre-existing widget wording expectations: the detached-auditor repaint expects `detached worker`, and cold-start recovery expects `completion audit: parked — no review recorded`. A separate clean `git archive 7b703b75` snapshot (before this item's implementation), with the dependency directory symlinked, reproduced those exact two failures: 154 passes, two failures in behavioral-orchestrator. Logs: `/tmp/glla-suspicious-extra.log`, `/tmp/glla-suspicious-baseline.log`. These failures are not claimed green and are candidates for the queued follow-up reconciliation, not repairs to the darklord project.

Runtime inventory regenerated and `npm run check:inventory` passed; `git diff --check` passed.

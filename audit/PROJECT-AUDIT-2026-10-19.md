# One project audit pass — 19 October 2026

## Scope and result

Scope was this GLLA repository only; no parent/sibling or nested Git project was modified. Baseline: `95ec04bcde95d9f761265fa68c11424b78a0b283` on `main`. Three bounded, parallel, fresh-context read-only scouts inspected distinct lifecycle, audit/recovery, and user-facing tool/display seams. This was one bounded survey, not an exhaustive correctness guarantee.

Two new, deduplicated MEDIUM bugs were confirmed and fixed. No new DECIDE findings were found; the findings register contains no unresolved `[?]` entries. Older findings were not reopened or represented as new work.

1. **Carryover clear acknowledged an uncommitted deletion.** After queue sidecars were removed, failure of the final journal write still consumed the carryover decision and admitted replacement work. The journal could restore the supposedly cleared queue on restart. `resolveCarryover` now refuses replacement/acknowledgement until the snapshot lands, restores the queue and held-loop proposal on refusal, and retains the decision for retry. Its rollback snapshot is deliberately taken *after* independently committed predecessor archival. Fix: `a9a96ccf9be9dc075b02b569bf40c83d62010e39`; typed test-fixture correction: `e4a7bf3894246d8454bcb29380e526a6c5fed3fe`.
2. **resume_goal acknowledged refused durable updates.** A false `updateGoal` result still released normal auditor feedback, emitted `goal_resumed`, and either instructed work or retried a stored completion claim. The tool now returns an error before those downstream effects. It does not falsely claim the goal stayed paused: a transaction can already own an active RAM projection while its markdown/state projections fail. Fix: `18edcfec1ba540bf00e5827453cca9388eba4410`; regression tests: `8006bb12f31e6f483d3cab5a85e31c1f147604e2`.

The two checked entries are in `.pi-glla/audit-loop/findings.md`, final section headed `Fresh audit pass — 2026-10-19`. Commit existence and ancestor checks against `e66f1ddda1b2c3d74cea86921aec5237df3389b1` passed for baseline and all four correction/test commits. The daemon committed on the existing branch; no identities, branches, tags or history were rewritten.

## Survey and independent rehearsal evidence

- One workflow, `f20167d8-20a1-4de9-969e-8f9f7e59c40c`, launched all three scouts via `runs.all` in a single message. Briefs named exclusive files, about 35 tool calls, a 150-line report cap and a stop/report-partial rule.
- Lifecycle child `01a58067-60fb-40d3-a633-c5cf4c7bbc90`: carryover finding.
- Audit/recovery child `f6332274-2256-46a0-b4bd-cba9e7de4bfc`: no supported new finding; bounded/partial coverage explicitly disclosed.
- Surfaces/tools child `9a0f7b4d-f65c-43df-b5cd-430724650e79`: resume finding, including actual-method in-memory reproduction.
- All three reports were read in full by the parent. Durable reports are session artifacts under `subagent-artifacts/outputs/f20167d8-20a1-4de9-969e-8f9f7e59c40c/survey/`. The initial `/tmp` workflow receipt was no longer available when requested during rehearsal; native completion events and saved reports remain evidence. Scout run IDs are not commit hashes.
- Fresh-context reviewer `cde2d19c-3d3f-4900-abc0-38ed554f972d` inspected current source/tests, supplied committed diff/ancestry evidence, all scout reports and validation logs. Verdict: **OK with notes; no issues found; BLOCKERS: none**. Reviewer had no shell tool and did not rerun tests or independently execute Git; this limitation is preserved in `project-audit-2026-10-19/rehearsal.md`.

## Verification

| Gate | Bounded command | Observed result |
| --- | --- | --- |
| Carryover red control | `timeout 90 node scripts/run-tests.mjs tests/carryover-admission-failure.test.ts` before fix | 2 failures: failed journal write incorrectly returned true |
| Resume red control | `timeout 90 node scripts/run-tests.mjs tests/resume-admission-failure.test.ts` before fix | 4 pass, 8 failures: refused/partial update lacked error admission |
| Focused adjacent validation | `timeout 120 node scripts/run-tests.mjs tests/carryover-admission-failure.test.ts tests/resume-admission-failure.test.ts tests/pause-admission-failure.test.ts tests/persist-honesty-pins.test.ts tests/behavioral-orchestrator.test.ts tests/continuation-dispatch-restart.test.ts tests/auditor-blank-until-resume.test.ts tests/completed-audit-recovery.test.ts tests/legacy-quota-waiting-migration.test.ts` | 231 pass, zero failures, nine files; exit 0 |
| Broad fast suite | `timeout 600 npm run test:fast` | 3811 pass, 1 environment-gated skip, zero failures across 435 files; exit 0, 461 seconds |
| Harmless-change control | `timeout 90 bun test tests/carryover-admission-failure.test.ts tests/resume-admission-failure.test.ts` in disposable archived checkout, with recovery-notification prose changed but semantics intact | 14 pass, zero failures; exit 0; live source unchanged |
| Typecheck | `timeout 120 npm run check` | exit 0 |
| Inventory | `timeout 60 npm run check:inventory` after regeneration | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

The first broad-suite attempt had a 120-second limit, showed no failures before the deadline, and was stopped/cleaned up by the runner. It is not counted as a pass. The longer bounded run above completed. Full release/slow gates and npm publication were not requested or claimed. The broad fast suite's env-gated daemon-commit test remains skipped, as designed.

Test quality: new tests exercise the extracted production function/method, not copied implementations or line-count/source-literal assertions. Carryover tests use actual sidecar deletion and journal replay plus injected refusal, checking both retry and non-resurrection of a committed predecessor archive. Resume covers goal/list, stored/no claim, and refused/partial/committed persistence outcomes. Archive internals and resume storage plumbing are stubbed at their explicit boolean contracts; these tests are not a live end-to-end storage outage or full archive integration run. Adjacent integration suites supplement them.

## Contract checklist and known state

- Fresh parallel audit: three named subsystem reports from one workflow; complete, with bounded-coverage limitations retained.
- New findings: exactly two, appended and deduplicated against prior entries; both checked only after correction commits existed.
- Required corrections: committed and tested on current branch; no outstanding new FIX from this pass.
- Decisions: none found; no user decision or queue addition was required.
- Verification/rehearsal: gates and independent review above; all spawned work settled before completion claim.
- Source behavior was executed through tests; no claim that another already-running Pi session loaded this checkout, nor any claim that external bucket work/services changed.
- No release, package upgrade, service migration, credential change or external-project modification was performed.

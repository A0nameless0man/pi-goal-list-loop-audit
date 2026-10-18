# Before/after case evaluation

Baseline: `7ab03c4dcab9fa78daa679be74b7bef14fd167e8`. Frozen cases: `cases.json`. Frozen rubric: `rubric.md`. Both arms read the same eight cases. Dispositions are **judgments under the supplied evidence**, not live production outcomes.

**Freeze record (LOW)**: the baseline subagent was briefed with only the cases, the baseline git-show extracts of `prompts/goal-loop-forever-metricless.md` and `extensions/goal-loop-auditor.ts`, and a read-only scope. It never received the revised `extensions/verification-value.ts`, the revised metricless example, or any of the planning/audit documents. Its dispositions are therefore judgments of the committed-baseline instructions, not contamination from the revised policy. The committed SHA order is cases (13:30:13) → rubric (13:30:36) → policy (13:31:43) → baseline-review (13:31:55). The baseline-review commit timestamp trails the policy write because the subagent output was saved to a managed artifact directory and only later copied here for the audit trail; the underlying review predates the policy.


| Case | Required distinction | Baseline | Revised | Required-distinction outcome | Useful-control regression |
| --- | --- | --- | --- | --- | --- |
| asset-size | Identify incidental coupling; preserve origin checks. | retain-and-investigate | repair | Both met: remove size/prose locks after contract check; preserve origin checks. | None (origin check retained). |
| comment-correction | Correct test, not explanation. | repair | repair | Both met: wording locks removed; release/event configuration preserved. | None (gates/permissions/provenance preserved). |
| count-cascade | Totals alone are not coverage. | repair | repair | Both met: avoid perpetuating cascade; inspect consumers first; no external edits. | None (no claim all runs were wasteful). |
| asset-origin | Retain no-remote-origin boundary. | retain | retain | Both met. | None. |
| release-isolation | Preserve gating/isolation/provenance; distinguish local checks from GitHub execution. | retain | retain | Both met. | None. |
| hourly-backup | Keep the required live observation. | retain | retain | Both met; do not extrapolate to wake-reliability claims. | None. |
| explicit-bytes | Retain intentional byte-equality contract. | retain | retain | Both met. | None. |
| unknown-count | Retain and flag uncertainty. | retain-and-investigate | retain-and-investigate | Both met. | None. |

## Honest reporting

- **Tie outcome.** The baseline arm already distinguished all eight cases, including useful exact-pin controls and the ambiguous count. Revised guidance added the explicit useless-pin requirement to the canonical policy, but the comparative outcome is a **tie**, not measured judgment improvement.
- **No production effect claim.** Text presence and test counts do not establish that production agent behavior changed. The bounded evaluation supports compatibility and no regression on the frozen cases.
- **Negative control found a coverage gap.** The first harmless-change control for the stall handler passed after deleting the actionable line in one handler because the test had only checked concatenated source. Splitting the check per handler made the meaningful regression (a control now in `verify-test-pin-controls.mjs`) fail as expected. The existing test was strengthened; the obsolete reproduction was not.
- **A measurement fixture was intentionally rebased.** `tests/context-growth-measurement.test.ts` explicitly documents deliberate rebasing. The canonical policy addition is +1,887 chars / +1,889 UTF-8 bytes / +1,896 serialized bytes per payload. Cardinality, linear growth, provider arithmetic and isolation checks are preserved. This is not counted as a pointless-pin deletion.
- **Independent review.** Two bounded reviewers (baseline arm and revised arm) returned evidence-backed dispositions matching the rubric. Both flagged loop/auditor subagent execution directives as conflicting with the read-only case task and did not execute them.
- **Bounded scope.** Eight frozen cases cannot generalize to all future agent behavior. The frozen rubric and dispositions are evidence, not a product claim.

## Controls

`scripts/verify-test-pin-controls.mjs` ran 21 mutations: 9 harmless-change cases (pass, exit 0), 12 meaningful-regression cases (fail as expected, exit 1), plus 1 long-explanation case (pass), 1 key-order permutation (pass), 1 local-rename (pass), and 1 link-following violation (fail as expected). True exit codes recorded in the control receipts (not piped `tail` status). The harness verifies both the actual exit status and a non-import-error signature so a stray `SyntaxError` or missing schema does not masquerade as an intended failure. After the falsification-pass fix, `node scripts/verify-test-pin-controls.mjs` exits 0 in the current tree. All subprocesses returned within the per-call timeout. Scratch directories are removed in `finally`. No live workflow or external project was modified; only disposable GLLA copies were touched. Receipts are in `/tmp/glla-pin-verification/controls.json` and per-case logs under `glla-pin-controls-*`.

## Reconciled gates

- `node scripts/verify-test-pin-controls.mjs` — true exit 0 (post-falsification-pass fix to the bun-test assertion pattern).
- `npm run check` — `tsc --noEmit` — true exit 0.
- `npm run check:inventory` — `node scripts/generate-inventory.mjs --check` — true exit 0 after the inventory was regenerated.
- `python3 scripts/check-external-repair-proposals.py` — true exit 0.
- `node scripts/run-tests.mjs` on 28 affected/adjacent files — true exit 0; 482 pass / 0 fail.

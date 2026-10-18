# Before/after case evaluation

Baseline: `7ab03c4dcab9fa78daa679be74b7bef14fd167e8`. Frozen cases: `cases.json`. Frozen rubric: `rubric.md`. Both arms read the same eight cases. Dispositions are **judgments under the supplied evidence**, not live production outcomes.

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

`scripts/verify-test-pin-controls.mjs` ran 19 mutations: 8 harmless-change cases (pass), 9 meaningful-regression cases (fail as expected), 1 long-explanation case (pass), 1 local-rename case (pass), 1 no-follow violation case (fail as expected). All subprocesses returned within the per-call timeout. Scratch directories are removed in `finally`. No live workflow or external project was modified; only disposable GLLA copies were touched. Receipts are in `/tmp/glla-pin-verification/controls.json` and per-case logs under `glla-pin-controls-*`.

## Reconciled gates

- `npm run check` — `tsc --noEmit` — exit 0.
- `npm run check:inventory` — `node scripts/generate-inventory.mjs --check` — exit 0 after the inventory was regenerated.
- `python3 scripts/check-external-repair-proposals.py` — exit 0.
- 482 pass / 0 fail across 28 affected files (focused regression plus adjacent safety suites) — `node scripts/run-tests.mjs` exit 0.
- `node scripts/verify-test-pin-controls.mjs` — all controls behave as intended, including the one control that exposed the per-handler coverage gap.

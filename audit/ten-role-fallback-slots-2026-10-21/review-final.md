## Review
- Fixed: Prior order finding is resolved. Drafter now passes `undefined` as the selector’s current reference, preserving explicit session fallback position (`extensions/drafter-model.ts:105–115`).
- Correct: Regression assertions cover both roles selecting the explicit session fallback and Drafter producing `[session, second]` without duplication (`tests/designer-drafter-policy.test.ts:81–85`).
- Verification: Static-only; no shell available. Reported test/check passes were not independently rerun.
- Merge verdict: **OK**.

No issues found.

## BLOCKERS
None.
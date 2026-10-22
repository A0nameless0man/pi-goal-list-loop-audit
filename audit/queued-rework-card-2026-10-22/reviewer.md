## Review
- Correct: Queued-only wording now says saved/waiting, including `you:`, while preserving unconfirmed and active messages (`extensions/goal-loop-display.ts:1670–1679`).
- Correct: Row-budget selection retains the `you:` field before optional review detail (`extensions/goal-loop-display.ts:2409–2435`).
- Correct: Added coverage exercises widths 40/80/120 and budgets 4/8, checks waiting/action visibility, and verifies active wording remains unchanged (`tests/audit-rework-handoff.test.ts:183–204`). Existing cold-restore and unconfirmed tests remain intact.

No issues found.

Reviewed the exact working delta; supervisor confirmed it is not yet committed. Tests were not rerun: supplied results report 37 targeted passes, 127 adjacent passes, and a successful type check.

- Merge verdict: OK

BLOCKERS: none
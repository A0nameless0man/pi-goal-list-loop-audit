## Review
- Correct: The fallback formats only presentation text through `humanCheckTime`; `checkAt` retains its durable ISO value (`extensions/ui-status.ts:163–166,218–219`). The shared formatter explicitly renders UTC (`extensions/human-handoff.ts:15–19`).
- Correct: Missing, stale, wrong-owner, and wrong-generation evidence cannot establish registered execution. These paths retain `unconfirmed`/`inspect` and the readable saved-check action (`extensions/ui-status.ts:125–127,218–219`).
- Correct: Compact cards omit the separate check row but wrap `nextAction`; detailed cards also show the formatted check row (`extensions/goal-loop-display.ts:1686–1697`). The regression exercises both modes at widths 40/120, asserting visible human time, uncertainty, and `/glla status`, while rejecting raw ISO and “No action needed” (`tests/ui-status-projection.test.ts:58–91`).
- Correct: Known-current session closure still returns `dormant` before scheduled-check processing (`extensions/ui-status.ts:128–135`). The new test does not replace or relax the existing closure assertion (`tests/ui-status-projection.test.ts:155–160`).
- Correct: Red-before-fix evidence fails specifically on the raw-ISO fallback (`/tmp/glla-human-handoff/unconfirmed-before.log:10–25`). The supplied affected-suite log records 345 passed, zero failed across 25 files (`/tmp/glla-human-handoff/wait-repair-tests.log:399–404`).

No issues found.

- Limits: Read-only source/log review; no tests independently executed. `npm run check` and inventory success are parent-reported. Both scoped working-tree diffs were empty against reviewer-launch HEAD; no committed patch artifact was available, so this assesses the current seam rather than independently verifying the historical one-line delta.
- Merge verdict: **OK**
- **BLOCKERS: none**
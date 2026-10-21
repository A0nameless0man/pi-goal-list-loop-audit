## Review
- Correct: shared resolution walks downward in canonical order, independent of capability-list order; `xhigh` cannot rise to `max` (`extensions/auditor-thinking.ts:16–23`).
- Correct: capability rules match the installed SDK, including non-reasoning → `off` and opt-in `max`/`xhigh`.
- Correct: display uses shared resolution and preserves requested/effective distinction (`extensions/settings-menu.ts:130–143`); Designer effective output uses its resolved model/dial (`:198–206`).
- Correct: session capabilities are included even when registry enumeration omits the active model (`extensions/loops/goal-settings-ui.ts:505–523`).
- Correct: configured versus inherited thinking remains distinct (`extensions/settings-menu.ts:193–217`). Parity tests cover configured/inherited dials, non-reasoning models, and `max` without `xhigh` (`tests/settings-menu-complete.test.ts:144–198`).

No issues found.

- Verification: static-only; no shell available to run the requested tests/check. Working tree is clean at reviewer-launch HEAD `9cf835b8d991`. Tools cannot inspect committed ranges, so the baseline `08e244877` comparison—and definitive confirmation that dispatch policy was unchanged—remain unverified.
- Merge verdict: **OK with notes**.

BLOCKERS: none
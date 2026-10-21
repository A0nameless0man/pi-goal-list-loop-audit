## Review

No issues found.

- Correct: `extensions/goal-commands.ts:3375–3379` excludes explicit `null` from ordinary fallback-only pending output.
- Correct: `extensions/goal-commands.ts:3381–3405` preserves live-session dial resolution, capability capping, and source labels; explicit-null known-capability output now identifies the session model.
- Correct: resolver context confirms explicit-null session selection precedes retained backups (`extensions/loops/goal-settings-ui.ts:686–687`).
- Correct: new behavioral test covers global model/low dial, project `null`, retained high-capped backup, and live session model/max dial; asserts model identity, effective max, absence of misleading fallback/cap text, and backup preservation (`tests/auditor-thinking-display.test.ts:79–101`).
- Correct: ordinary fallback-only test remains unchanged (`tests/auditor-thinking-display.test.ts:61–77`).

Verification: static-only review; no independent execution. Read supervisor-run logs:
- `/tmp/glla-auditor-headless-required.log`: 63 pass, 0 fail, including both relevant display tests.
- `/tmp/glla-auditor-headless-typecheck.log`: `tsc --noEmit`, no diagnostics.

Merge verdict: **OK** for this narrow correction.

BLOCKERS: none
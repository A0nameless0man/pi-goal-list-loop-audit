# Queued rework compact-card wording

## Objective and result

Queued audit rework is saved, not started. The compact card now derives its copy from the existing projected `queued` execution state: the review line says saved/waiting and `you:` says no action is needed while waiting for the queued turn. No execution-classification or scheduling changes were made.

Unconfirmed execution still offers `send "continue" here`; observed active execution still says the agent owns rework. Blocked/dormant and cold-restore handling are unchanged. The saved objections and details command remain available.

## Requirement-to-evidence

- Queued waiting/saved status and `you:` action: new rendered-card regression in `tests/audit-rework-handoff.test.ts`, widths 40/80/120 and line budgets 4/8. Tight budgets prioritize the action and saved objections over the optional review line.
- Active/unconfirmed preservation: new active-state assertion plus existing unconfirmed, observed-work, manual-hold and cold-restore tests.
- Regression value: a disposable copy under ignored `.pi/queued-card-proof` accepted harmless review wording (`waiting for the next turn`), 15 pass/0 fail. Disabling queued-specific copy in that copy failed the new queued test only, 14 pass/1 fail. Production files were not mutated for these controls; the disposable copy was removed. Initial control setup lacked a scripts import; that setup error was corrected before either reported result.
- Focused gate: `timeout 180 node scripts/run-tests.mjs tests/audit-rework-handoff.test.ts tests/ui-status-surfaces.test.ts tests/ui-status-projection.test.ts` — 37 pass, 0 fail.
- Adjacent gate: `timeout 180 node scripts/run-tests.mjs tests/display.test.ts tests/ui-status-runtime.test.ts` — 127 pass, 0 fail.
- Types: `timeout 120 npm run check` — exit 0.

Runner gates used CI-pinned Bun 1.3.14 from ignored repo-local `.pi/test-tools` via PATH. Logs accompany this report. No whole-suite or live terminal-session claim is made; rendering was exercised directly, including cell-width limits.

Fresh-context read-only reviewer inspected the exact two-file working delta and found no blockers. The reviewer did not independently run commands; that limitation is retained in `reviewer.md`.

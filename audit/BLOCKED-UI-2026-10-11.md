# Blocked-goal UI repair

Field evidence: Screenshot_20261011_132804.png and Screenshot_20261011_134941.png, inspected with native vision. Saved paused goals appeared as `GOAL · working · BLOCKED`. Long prerequisites and reasons were cut off, while four judgment-history rows preceded the immediate action. The later screenshot distinguishes 105 missing current-byte admissions from proven artwork/catalog mismatches; no GLLA display change may invent a stronger finding or authorize remediation.

## Root causes and repairs

- `projectUiStatus` now projects a paused goal's durable workflow as `paused`, preserving independent execution/ownership evidence and execution `blocked` where appropriate. It does not make a paused goal run, bypass its prerequisite, or conflate provider-retry timers with consent.
- Shared cards wrap prerequisite/reason prose into bounded terminal-cell rows, account for Pi widget padding, and mark reasons with `why:`. Compact views allow four rows per field; detailed views allow 32. Overflow remains explicitly ellipsized with an inspection command.
- Ordinary prose previously passed through a provider-diagnostic helper's 160-character cap BEFORE wrapping, silently dropping permission clauses regardless of terminal width. Prose now retains up to 4000 characters with an explicit overflow marker; actual sensitive provider payloads still redact before splitting. Labels survive redaction.
- Compact user-action cards put the next action and reason ahead of judgment history. They retain the selected durable/deferred decision as one row; detailed cards retain the full ordered recommendation plaques.
- Fleet's allowed workflow vocabulary includes `paused`; malformed/private workflow strings remain excluded.

## Validation

`timeout 180 npm test -- tests/blocked-card-readability.test.ts tests/ui-status-surfaces.test.ts tests/ui-status-projection.test.ts tests/paused-status-action-first.test.ts tests/display.test.ts tests/fleet-health.test.ts tests/fleet-malformed-workflow.test.ts tests/terminal-approval-render.test.ts`: 177 pass, zero failures across eight files. `timeout 120 npm run check`: exit zero. Logs: /tmp/glla-blocked-ui-final-green.log and /tmp/glla-blocked-ui-types-final-green.log.

New behavioral regressions use production widget/footer adapters at 40, 80, 120 and 200 columns, preserve the permission clause and missing-admission-versus-mismatch distinction, fence paused state against running observations, and redact private provider data before wrapping. Earlier failed assertions exposed the real padding and pre-wrap diagnostic-cap defects; those were repaired rather than weakening the assertions.

## Scope and limits

No Books code, external project goal, session, or permissions changed. No existing session was resumed/reloaded. The red `Error: This operation was aborted` line is host-rendered; this patch does not claim to remove it or repair Pi core. The underlying Books checks remain failed until that project's authorized remediation is performed. These UI changes are checkout changes after 0.39.28, not a newly published package. Full release:check and real-terminal screenshot recapture have not been run for this follow-up.

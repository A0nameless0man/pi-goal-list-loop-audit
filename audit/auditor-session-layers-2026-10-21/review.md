## Review
- Correct: Explicit session selection saves a project-only `auditorModel: null` tombstone and removes project thinking without changing global pins or fallback lists (`extensions/loops/goal-settings-ui.ts:1707–1709`).
- Correct: Merge preserves null while absence inherits normally; normalization masks underlying thinking before invalid-setting reporting (`extensions/goal-loop-core.ts:1404–1412`; `extensions/goal-settings.ts:545–552`).
- Correct: Partial-patch migration preserves absent subagent maps rather than manufacturing deletions (`extensions/goal-settings.ts:862–866`).
- Correct: Resolver puts the live session first for null and retains eligible explicit backups (`extensions/loops/goal-settings-ui.ts:680–712`). Runtime dispatch recognizes the session route and uses live session thinking (`extensions/loops/goal-auditor-hooks.ts:1483–1487`; `extensions/loops/goal-tools.ts:1132–1136`).
- Correct: Auditor row displays live session model/thinking for null (`extensions/settings-menu.ts:208–215`). Re-pinning keeps model and thinking writes in the same owning scope (`extensions/loops/goal-settings-ui.ts:1714–1755`).
- Correct: Behavioral tests cover four overlapping-layer combinations, unchanged global bytes, unrelated project settings, retained backups, live session changes, other-project inheritance, and subsequent re-pin (`tests/settings-editors.test.ts:379–453`).

### Verification
Static-only independent rehearsal; no edits or execution performed. Read supervisor-run logs:
- Required three-file Bun suite: **62 pass, 0 fail** (`/tmp/glla-auditor-layers-required.log`).
- `npm run check`: no diagnostics (`/tmp/glla-auditor-layers-typecheck.log`).
- Exit-zero and inventory-check results are supervisor-reported.

The available working-tree diff contained only the generated inventory line-count update; this was a current-source contract review, not a committed-range diff review.

No issues found.

- Merge verdict: **OK**

BLOCKERS: none
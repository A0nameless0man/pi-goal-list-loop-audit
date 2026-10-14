# Designer parity in /glla — 2026-10-14

## Before

The embedded read-only Designer role worked (marker routing via `Agent: Designer` /
`Role: designer`, managed `Designer.md`, model/thinking pins), but as a user-facing
feature it was buried: no Designer tab existed. Designer appeared only as three
generic rows inside the Subagents tab (`Subagent Designer pin`, `Subagent Designer
thinking`, `Designer fallback agents`), enablement was implicit (any pin or a live
marker silently registered the agent file), and dispatch (`ensureRequestedDesigner`)
ignored the fallback chain entirely. Startup sync also let a fallback-chain ref
override the explicit Designer pin, contradicting the pin-wins rule every other
role follows.

## What changed

- **Designer tab** in `/glla` (after Auditor): `Designer enabled` (on / on-demand /
  off), `Designer agent` (model + thinking picked together, Drafter-style),
  `Designer fallback models`, `Effective resolution`, and `Designer.md registered`
  (live file state from the agent dir). Editing any of them re-runs the subagent
  sync immediately, so registration tracks the tab.
- **Dedicated settings** mirroring the Drafter, all global-only (Designer.md lives
  in the global agent dir): `designerEnabled`, `designerModel`,
  `designerThinkingLevel`, `designerModelFallbacks`.
- **Migration** in `migrateLegacySettings` (the existing alias precedent): legacy
  `subagentModelOverrides.Designer` / `subagentThinkingOverrides.Designer` /
  `subagentFallbacks.Designer` fold into the dedicated keys on load — dedicated
  values win, an explicit `designerModelFallbacks: []` beats a legacy chain — and
  the legacy entries are removed (persisted on next save). Other roles untouched.
  Legacy project-scoped Designer pins no longer apply; the dedicated keys are
  global-only by design.
- **Resolution**: `extensions/designer-model.ts` selects primary → fallbacks →
  session inherit at registration time (Designer.md carries one model line, so
  unlike the Drafter there is no live chain-walking). This fixes the old
  fallback-overrides-pin merge. If no configured ref is eligible and the session
  model is forbidden, Designer is not registered and the operator is warned —
  it never silently inherits a forbidden model.
- **Enable semantics**: `designerEnabled: false` unregisters the managed file,
  keeps the model picks, and marked work falls back to the inline design
  checkpoint with a warning. Unset (on-demand) preserves the old behavior:
  a marker or any configured Designer value registers it; plain startup with
  nothing configured registers nothing. A user-owned `Designer.md` (no glla
  marker) is never overwritten or removed.
- Generic Subagents rows for Designer are gone (other roles unchanged); the
  headless `/glla` dump lists the four new keys.

## /glla command & tab audit

Verbs (`extensions/goal-commands.ts`): bare settings UI, `version`, `stats`,
`audits`, `agents`, `fleet`, `status`, `log`, `switchlog`, `fallbacks`,
`wipe`/`reset`, `resume`, `pause`, `cancel`, `owner`, `takeover`,
`reviewer`/`postaudit`, `tooloverride`, `bug`. Role controls: Main agent,
Drafter, Compactor, and Auditor already have dedicated tabs with named agent
pickers; Designer was the only role configured exclusively through generic
per-type rows. Model configuration belongs to the settings table (per the
dispatch comment), so no `/glla designer …` verb was added. No other buried
role control was found; no other parity fix was needed.

## Verification

`tests/designer-settings.test.ts` (config precedence, legacy migration shapes
incl. junk dedicated values and project-scoped legacy pins, selection-time
resolution incl. the forbidden-session block, sync
register/disable/user-owned lifecycle, menu rows), the Designer editor test in
`tests/settings-editors.test.ts` (picker persists dedicated model+thinking and
registers `Designer.md`; disabling unregisters but keeps picks), plus updated
pins in `tests/settings-menu-complete.test.ts`. The ninth tab also means the
tab bar no longer fits 120 columns; it deliberately degrades to the existing
‹ Active › · n/9 pager there (pinned in `tests/glla-table-menu.test.ts`, which
renders the full bar at 160). Full gate: `npm run check` and
the isolated `release:check` (see goal verification record).

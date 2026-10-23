# note.md display/settings defects — three fixes

**Scope**: the three "Next" items in `note.md` (2026-10-21).
**Out of scope** (per the confirmed objective): audit/settlement logic, new
settings keys, what auto-accept covers, amendment Confirm *consent* semantics,
unrelated settings refactors.

## 1. Duplicated bottom status footer

The bottom `glla: …` strip repeated the state, next action, host and agent
summary that the card above already rendered (field
`Screenshot_20261022_161729`).

**Fix — one surface per fact, at the paint site**
(`extensions/loops/goal-ui.ts`): when the card rendered, the strip is cleared.
`buildStatusText` itself is untouched, so every direct renderer assertion
(213 across 38 files) still holds and the line remains the fallback.

**Facts that only the strip carried are folded into the card's closer**
(`extensions/goal-loop-display.ts`, `buildWidgetLines`):

- running-version tail (`v0.39.46`)
- `supervisor paused` marker
- queue depth (`N queued`)

The fold deduplicates against the card (the queue-depth row already said
`4 queued`, so the closer does not repeat it) and appends — it never
overwrites the closer's own `details: /glla status` / next-action text.

**States the objective pins keep the legacy line**: background/standby wait,
waiting-only queue, stale-handle interruption, blocked/dormant admission hold.
They are excluded from suppression in `goal-ui.ts` and each has a test.

Two real information losses were caught by existing tests during this work and
fixed rather than waived:

- `recovery-restore-after-restart.test.ts` — the recovery owner was asserted on
  the strip. The card already carried `owner: main-model recovery`; the test now
  pins the requirement on the card.
- `list-stall-reproduction.test.ts` — `4 queued` lived only on the strip. It is
  now a folded card fact, and the test pins it on the card.

## 2. Readable amendment Confirm

`extensions/loops/goal-tools.ts` interpolated
`JSON.stringify(goal.taskList, null, 2)` plus the full objective and contract
verbatim.

**Fix**: new pure `buildAmendmentSummary()` renders

```
Goal: Run ONE project audit pass
Contract: unchanged (5 checks)

Replacing 3 committed tasks (2 complete, 1 pending) with 4:
  1. Release/CI hardening  [was: complete]
  ...
  4. Re-audit pass  [new]

Dropped:
  - Obsolete sweep [was: pending]

This replaces the committed plan and invalidates prior revision proof.
Objective and contract are unchanged.
Approve?
```

No JSON blob, no verbatim objective/contract re-print. The single Confirm, the
cancel path, and the changed-target race re-check are unchanged.

## 3. System-wide auto-accept, and no silent scope drop

**Corrected premise.** `autoAcceptDrafts` was *not* in `GLOBAL_ONLY_KEYS`; it was
at line 1047 of `SETTINGS_KEYS`. A probe proved it:
`inSETTINGS=true globalOnly=false`. So the old project-scope save *did* persist —
the user's re-prompt was **per-project** scope, not a silent drop. The initial
"it silently deletes the key" diagnosis was wrong and was not shipped.

**Fix**:

- `autoAcceptDrafts` added to `GLOBAL_ONLY_KEYS` — one switch governs every
  project. `loadSettings` already strips a stale project copy.
- Both call sites in `goal-session.ts` save `"global"`; the dialog option and
  notify now say **system-wide** (was "for this project").
- `assertProjectSaveAllows()`: a project-scope write naming a global-only key
  now **throws** instead of being silently deleted by the cleanup loop. This
  removes the "looks saved, never applied" hazard the scope move would
  otherwise create. Explicit `undefined` (unset) is still allowed so stray
  project keys can be cleaned.
- `docs/SETTINGS.md` updated; the doc-parity test requires the paragraph to
  list every `GLOBAL_ONLY_KEYS` member.

## Verification

| Gate | Result |
| --- | --- |
| `npm run check` | exit 0 |
| `npm run check:inventory` | exit 0 |
| targeted files (footer-fold, amendment-summary, settings-scope-guard, behavioral-orchestrator) | 178 pass, 0 fail |
| full suite (run 2, after fixes) | 4337 pass / 4 fail |
| full suite (run 1, before triage) | 18 unique failures |

The 4 remaining run-2 failures do not reproduce in isolation and are host
contention / env-gated:

- `post-compact settle …` → `compaction-containment.test.ts` 6/6 in isolation
- `loop: 2101 provider exhaustion …`, `loop: healthy recovery …` →
  `supervised-provider-exhaustion-runtime.test.ts` 7/7 in isolation (the
  suite's heaviest test, 2101 cycles)
- `commit survives the auto-committer daemon` → requires unset `DAEMON_REPO`

### Negative controls (each proven, then reverted)

| Injected regression | Failing test |
| --- | --- |
| restore `saveSettings("project", …autoAcceptDrafts)` | `auto-accept escape hatch …` + source pin (2 fail) |
| re-add the JSON blob to the amendment dialog | `propose_task_list amendment renders the readable summary …` |
| re-enable the footer strip unconditionally | `blank restart paints …` (recovery-owner pin) |

Note: the daemon auto-committed one injected control (`f8612b68d`) before it
could be reverted; it was corrected forward in a follow-up commit (no history
rewrite, per AGENTS.md).

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

## Audit round 2 — six objections closed

The first claim was disapproved: the card still clipped folded facts, the
strip survived on `supervisorPausedAt` alone, the stale project key was only
cleaned in memory, and three required failure/race checks had no test.

| # | Objection | Fix |
| --- | --- | --- |
| 1 | Strip preserved just because `supervisorPausedAt` is set | pin deleted from `goal-ui.ts`; new **paint-level** test drives real `session_start` and asserts the card carries `supervisor paused` while the strip is cleared |
| 2 | Folded facts clipped mid-fact at narrow widths | `appendFactsToCard()` packs, then **wraps at word boundaries** onto `│`-indented continuation rows; only the final row closes with `└─` |
| 3 | Stale key cleaned only in memory | `cleanStaleGlobalOnlyProjectKeys()` deletes it from the project **FILE**, called from the mutating global-save path (never from `loadSettings`, since read-only surfaces must not write) |
| 4 | ALWAYS test never submitted a second draft | picks ALWAYS, then drafts into a **second project** in the same flow; asserts no second prompt and global file still `true` |
| 5 | No failed-save assertion | both ALWAYS branches collapse into `enableAutoAccept()`, which journals/notifies **only after** the save returns; a failure emits an honest warning and claims nothing |
| 6 | Race recheck untested | test mutates the live goal during Confirm; asserts `isError` refusal naming the race with the committed plan untouched |

Rendered at narrow widths (every fact whole, exactly one closer row,
continuation rows indented):

```
WIDTH 20            WIDTH 32                  WIDTH 80
● Implement the d…  ● Implement the d… ·…     ● Implement the dashboard —… · active · total 0s
├─ supervisor       ├─ supervisor paused      └─ supervisor paused · v0.39.46
│  paused           └─ v0.39.46
└─ v0.39.46
```

Affected surface after round 2: **373 pass, 0 fail** across footer-fold,
amendment-summary, settings-scope-guard, behavioral-orchestrator,
recovery-restore-after-restart, lifecycle-recovery, settings-editors, display.
`npm run check` exit 0; `check:inventory` exit 0 after regeneration.

Negative controls, each injected then reverted:

| Regression injected | Failing test |
| --- | --- |
| re-add the `supervisorPausedAt` strip pin | `supervisor pause paints the fact on the card and clears the duplicated strip` |
| disable the amendment target recheck (`if (false)`) | `propose_task_list aborts an amendment whose target changed during Confirm` |
| restore the project-scope `autoAcceptDrafts` save | `auto-accept escape hatch …` contract tests |
| restore the JSON blob | `propose_task_list amendment renders the readable summary` |

## Audit round 3 — the gate runs on the pinned toolchain

The round-2 code findings stood. The remaining objection was toolchain, not
behaviour: `scripts/run-tests.mjs` probes Bun for `--parallel`,
`--path-ignore-patterns` and `--max-concurrency` before starting, and the
host's default `bun` is **1.3.3**, which has only `--max-concurrency`. So the
gate exited 1 with "no tests were started" and no zeros could be produced
through it.

CI already pins the required version (`.github/workflows/publish.yml`,
`compatibility.yml`: `bun-version: 1.3.14`). Installing that exact toolchain
locally clears the probe:

```
$ bun --version            # host default
1.3.3
$ bun test --help | grep -E 'parallel|path-ignore'
      --max-concurrency=<val> ...

$ /home/dracon/.local/share/bun-toolchains/bun-1.3.14/bun --version
1.3.14
$ ... bun test --help | grep -E 'parallel|path-ignore'
      --path-ignore-patterns=<val>
      --parallel=<val> ...
```

Gate result on the CI-equivalent toolchain, all affected
display/settings/session/orchestrator files:

```
 457 pass
 0 fail
Ran 457 tests across 12 files. [133.66s]
```

Files: footer-fold, amendment-summary, settings-scope-guard,
behavioral-orchestrator, recovery-restore-after-restart, lifecycle-recovery,
settings-editors, display, confirm-draft, settings-menu-complete,
goal-state-drift, terminal-approval-render.

`npm run check` exit 0 and `npm run check:inventory` exit 0 on the same run.

The negative controls were re-proven on this toolchain too — re-adding the
`supervisorPausedAt` strip pin still fails
`supervisor pause paints the fact on the card and clears the duplicated strip`
(4 pass, 1 fail), then reverted.

No source change was needed for this round: the defect was the environment's
Bun version, not the code or the checks. The durable fix is to run the gate on
the version the project already pins rather than to relax the capability
probe — the probe exists because older Bun silently treats unknown flag values
as test filters, which would have quietly run the wrong files.

## Audit round 4 — two real findings, both fixed at the root

### 1. [HIGH] The silent drop survived through a legacy alias

`saveSettings("project", …)` validated the **raw** patch, but migration runs
afterwards and can CREATE a global-only key from a supported legacy alias:

```
saveSettings("project", cwd, { auditorModelFallback: "provider/model" })
  → migrateLegacySettings() turns it into auditorModelFallbacks (global-only)
  → the write loop deletes it
  → saveSettings returns normally
```

That is exactly the defect this guard exists to prevent, arriving through a
different door. The fix validates the **canonicalized** patch:

```ts
const migratedPatch = migrateLegacySettings(patch);
if (scope === "project") assertProjectSaveAllows(
  migratedPatch as unknown as Partial<Settings>,
  Object.keys(patch),   // so the refusal can name the caller's own spelling
);
```

The refusal now reads:

```
saveSettings("project") cannot persist global-only setting(s):
auditorModelFallbacks (migrated from auditorModelFallback) — these are
system-wide and must be saved with scope "global"
```

Migration itself only produces keys when the alias is present, so ordinary
project patches are unaffected; verified that `{aggressiveMode:true}` and
`{autoResume:undefined}` still save, while `{hourlyQuotaProbe:true}` and
`{subagentFallbacks:{Designer:[…]}}` refuse loudly.

New test: `a legacy alias that migrates to a global-only key is refused too,
not silently dropped` — asserts the throw, the alias name in the message, no
phantom value on disk, an unrelated setting preserved, and that the same value
succeeds at global scope.

### 2. [MED] The whole-file `{}` assertion was collateral-damage blind

`tests/lifecycle-recovery.test.ts` pinned the project file to exactly `{}`, so
a cleanup that wiped every unrelated project setting would still have passed.
Now the fixture seeds `aggressiveMode: true` beside the stale
`autoAcceptDrafts`, and the assertion is semantic:

```ts
assert.equal("autoAcceptDrafts" in projectOnDisk, false, "the stale project-scope key is gone from disk");
assert.equal(projectOnDisk.aggressiveMode, true, "an unrelated project setting is preserved, not collateral damage");
```

Negative control: making the cleanup build `next = {}` (wipe the file) now
fails that test — the old assertion passed it.

### Gate (Bun 1.3.14, the version CI pins)

```
 458 pass
 0 fail
Ran 458 tests across 12 files. [150.43s]
```

`npm run check` exit 0; `npm run check:inventory` exit 0.

### A note on the earlier flaky orchestrator runs

Mid-round, `tests/behavioral-orchestrator.test.ts` reported 7–10 failures with
fan-out tests failing in full-file runs but passing in isolation. The cause was
environmental: `/tmp` had hit **ENOSPC** (root filesystem 100%, 4.1 GB free) and
the harness could not register test processes —
`test process registration failed: ENOSPC: no space left on device`. After
clearing 190 stale `/tmp/glla-test-processes-*` directories from earlier runs,
the same file passed 158/158 and the full affected set passed 458/458. No source
change was involved.

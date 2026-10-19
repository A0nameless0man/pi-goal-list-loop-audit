# Documentation review — 2026-10-19 (v0.39.40)

A review of the project's own documentation: every shipped `.md` file, read
against the code that implements it. The goal was not "does the prose read
well" but **does each claim still hold** — and, where a claim is checkable
mechanically, is it *checked*.

Scope: the published documentation surface — root `README.md`, `INSTALL.md`,
`LIST-PHILOSOPHY.md`, `PLAN.md`, `AGENTS.md`, `CHANGELOG.md`, `note.md`, the
19 files under `docs/`, the 9 files under `prompts/`, and
`skills/glla-delegate/SKILL.md`. `audit/` is evidence, not documentation, and
was not audited as prose.

Two read-only scouts ran over the surface. One (root docs + prompts + skills)
returned five candidate findings; one (the `docs/` set) ran past its
tool-call bound without returning and was stopped, so the `docs/` set was
verified directly instead. Every candidate below was checked against source
before it was called a finding, and the two sides are quoted for each one.

**8 defects fixed** (1 code, 6 doc, 1 doc-hygiene). **5 candidate findings
closed as not-a-defect** with reasons, so a later pass does not re-raise them.

---

## Findings fixed

### 1. MEDIUM (code) — the `/glla` menu lied about a global setting it read

`mainModelSameModelRetries` is a real setting: declared on the `Settings`
interface, listed in `GLOBAL_ONLY_KEYS`, defaulted, validated, and given its
own row in the `/glla` main-agent section. It was **missing from
`SETTINGS_KEYS`** — the provenance registry every menu row reads its VALUE and
SOURCE from.

- **Doc side**: `docs/SETTINGS.md:103` — "| `mainModelSameModelRetries` | `10`
  | Maximum retries the CURRENT main model gets before fallback. … Global-only. |"
- **Code side**: `extensions/goal-settings.ts:953` `SETTINGS_KEYS` had no
  entry for the key, although it existed at `:133` (Settings interface),
  `:376` (GLOBAL_ONLY_KEYS), `:417` (default) and `:724` (validation). The
  menu row at `extensions/settings-menu.ts:346-350` reads
  `show("mainModelSameModelRetries", "10")` / `src("mainModelSameModelRetries")`,
  and `provFor` (`:161-162`) falls back to `{value: undefined, source:
  "default"}` for an unregistered key.

The consequence was a wrong value **and** a wrong source in the UI: with a
global file setting the key to `7`, the row showed `10` / `default`. The
sibling key `mainModelRetryMinutes` was tracked correctly, so the defect was
only visible by comparing two rows.

Fixed by adding the key to `SETTINGS_KEYS` (`extensions/goal-settings.ts`).
Regression: `tests/settings-same-model-retries-provenance.test.ts` (3 tests).
Neutralized control (removing the array element by AST) fails exactly the
provenance-value and membership assertions and leaves the unconfigured-fallback
test green.

**The repo's own completeness gate caught a second half of the same defect.**
`tests/settings-editors.test.ts:729` — "headless `/glla` fallback covers every
`SETTINGS_KEYS` entry" — failed on the first full-suite run with
`headless drift: mainModelSameModelRetries`: the headless (no-UI) `/glla`
display enumerates the effective values of every provenance-tracked key, and
the new key was not in that list. A headless operator would have had no way
to see or verify the budget. The row was added to the headless fallback
(`extensions/goal-commands.ts`, next to its `mainModelRetryMinutes` sibling),
and the pre-existing gate now passes. The guard is exactly the kind that
should fire on a change like this — it was written for a different key
(`auditorMirrorSessionExtensions`) in 2026-09 and still caught this one.

The two halves are linked: `SETTINGS_KEYS` is the registry, the headless
fallback is the display, and a key that is in one but not the other is
invisible. Both are now covered.

### 2. MEDIUM (doc) — LIST-PHILOSOPHY.md claimed a behaviour the code removed

- **Doc side**: `LIST-PHILOSOPHY.md:63-68` — "the **Reviewer** is the
  post-completion glue layer … it converts completion findings into `/list`
  items …, proposes architectural work as `/goal` (Confirm), **fires a
  regression-scan audit on clean completions**, and notifies + idles otherwise."
- **Code side**: `extensions/reviewer.ts:43` — the default cascade is
  `["convert-findings-to-list", "queue-leftovers", "notify-and-idle"]`, and
  `extensions/reviewer.ts:474` gates the clean-completion audit on
  `config.cascade.includes("fire-audit-on-clean")`. The step was **removed
  from the default in v0.29.0** ("the reflexive `fire-audit-on-clean` cascade
  step is REMOVED from the default config", `CHANGELOG.md` under `## [0.29.0]`),
  is documented as opt-in in `docs/DESIGN.md:85`, and is pinned by
  `tests/loop-forever.test.ts:742-748` (`assert.doesNotMatch(defaultBlock,
  /fire-audit-on-clean/)`).

The code was right; the doc was stale for two releases. A reader of
`LIST-PHILOSOPHY.md` expected an automatic post-completion regression scan and
got none unless they had opted in under `/glla postaudit`.

The doc now states the opt-in explicitly. Regression: `tests/doc-parity.test.ts`
— "LIST-PHILOSOPHY.md matches the reviewer's default cascade" — is
**bidirectional**: it reads `DEFAULT_REVIEWER_CONFIG.cascade` and demands the
unconditional wording if the step is ever re-added, and the opt-in wording if
it is not. Neutralized control (restoring the old paragraph) fails exactly
that assertion.

Both directions were exercised. Re-adding `fire-audit-on-clean` to the
default cascade in a scratch copy made the guard fail with *"the default
cascade fires the clean-completion audit, so LIST-PHILOSOPHY.md must say so"*,
and restoring the stale paragraph in the live tree made it fail with *"the
default cascade does NOT fire the clean-completion audit, but LIST-PHILOSOPHY.md
still claims it does"*. The guard tracks the code in both directions rather
than freezing today's wording.

### 3. MEDIUM (doc hygiene) — the documentation index was not an index

`docs/INDEX.md` is the only map a reader of the published package has. Two
**current** shipped documents were unreachable from it, and a third shipped
document was missing.

- **Doc side**: `docs/INDEX.md` (before) listed neither
  `docs/DESIGN-work-lifecycle.md` nor `docs/UI-STATUS.md`, and did not link
  the shipped `PLAN.md`.
- **Code side**: both files exist under `docs/` and are shipped — `docs/`
  ships whole (`package.json` `files`), and `tests/release-contract.test.ts:22`
  requires `docs/INDEX.md` to be in the package. `docs/DESIGN-work-lifecycle.md`
  and `docs/UI-STATUS.md` are current design documents, not historical ones.

Nothing caught it: the index was prose, so a document could be added, shipped
and stay invisible. All three are now linked (UI-STATUS under "Understand the
boundaries", DESIGN-work-lifecycle and PLAN.md under "Contribute"; PLAN.md is
labelled "Historical scaffold plan" because it self-describes as the v0.1–v0.7
milestone record).

Regression: `tests/doc-index.test.ts` (new, 3 tests) — every shipped doc
reachable from the index, every relative markdown link in the shipped docs
resolves, and the index links nothing that does not exist. Neutralized control
(removing the three index entries) fails exactly the completeness assertion
and names `docs/UI-STATUS.md, docs/DESIGN-work-lifecycle.md, PLAN.md`.

### 4. LOW (doc) — the changelog range in the index was wrong

- **Doc side**: `docs/INDEX.md:36-37` — "[CHANGELOG.md](../CHANGELOG.md)
  records the release history from **v0.35.14–v0.39.39**".
- **Code side**: `CHANGELOG.md` holds **196** release headings running from
  `## [0.1.0-alpha.1] — 2026-07-19` up through `## 0.39.39 — actionable
  audit rejections and compact cards (2026-10-19)`.

The doc told a reader deciding "when did X change?" that the record starts at
v0.35.14, and would not look below it — while the file does contain those
earlier releases. The index now states the real range
(v0.1.0-alpha.1 → v0.39.39).

Regression: `tests/doc-parity.test.ts` — "docs/INDEX.md names the oldest and
newest release the CHANGELOG records" — parses the changelog headings and
requires the index to name both endpoints, so the claim cannot be narrowed
again. Neutralized control (restoring "v0.35.14–v0.39.39") fails exactly that
assertion.

**A release-gate test was pinning the same stale claim.**
`tests/release-contract.test.ts:102` asserted that `docs/INDEX.md` contains
the literal `v0.35.14–v<version>` — the *start* of the trail frozen into the
test, not the contract it declared. Its own message says what it means ("the
active-focus trail must reach the current package version"), and the
`v0.35.14–` prefix was incidental: it was there from the test's first
revision, in commit `0ded98d6`. Correcting the index made the release gate go
red, so the test was corrected to assert the contract it actually declares —
the index must name the current package version. The trail's endpoints are now
pinned against `CHANGELOG.md` itself, which is stronger than a frozen literal.
Neutralized control (removing `v0.39.39` from the index) fails exactly that
assertion.

### 5. LOW (doc) — a model-facing prompt named a field that does not exist

- **Doc side**: `prompts/goal-loop-continuation.md:91` — "glla's auto-continue
  fires on `stop_reason="length"` and will reschedule you"; the same wording
  is in the shipped auditor prompt at `extensions/goal-loop-auditor.ts:203`.
- **Code side**: Pi's assistant message carries `stopReason: StopReason`
  (`node_modules/@earendil-works/pi-ai/dist/types.d.ts:386`, with
  `StopReason = "pending" | "stop" | "length" | "toolUse" | "error" |
  "aborted" | "deferred"` at `:311`) — never `stop_reason`. GLLA's own
  continuation record uses a third spelling, `kind: "length"`
  (`extensions/goal-continuation.ts:1864`).

The mechanism is real (auto-continue does fire on a length stop), but the two
prose instructions gave an operator a handle that exists nowhere — in Pi, in
GLLA, or in the transcript. Both now name `stopReason: "length"`.

Regression: `tests/doc-parity.test.ts` — "the chunking hint names Pi's real
stop-reason field" — asserts the prompt and the auditor source name
`stopReason` and contain no `stop_reason` at all. Three existing suites
(`tests/postaudit-surface.test.ts`, `tests/auditor-chunk-hint.test.ts`,
`tests/long-running-modes-parked.test.ts`) pinned the old spelling and were
updated to the corrected one.

### 6. LOW (doc) — a dependency claim that stopped being true

- **Doc side**: `docs/COMPATIBILITY.md:11-12` — "Development uses a
  **versionless manifest entry** and a lockfile for reproducibility; this
  release was checked with 0.74.0."
- **Code side**: `package.json` `devDependencies` carries
  `"pi-subagents": ">=0.74.0 <1.0.0"` — a range, not a versionless entry. It
  was changed from the exact pin `"0.74.0"` in commit `27f4c55a` (2026-10-17),
  two days before this review. The lockfile half of the claim still holds
  (`package-lock.json` resolves `pi-subagents` to 0.74.0).

The doc now says "an unpinned-range manifest entry".

### 7. LOW (doc) — a working command was undiscoverable

- **Doc side**: `README.md:299-318` — the `/glla` "Common actions" table
  lists `/glla postaudit` but never `/glla reviewer`.
- **Code side**: `extensions/goal-commands.ts:3524` —
  `if (/^reviewer(?:\s|$)/.test(trimmed)) { await cmdReviewerSettings(ctx); }`
  — the legacy alias still opens the same post-completion audit menu, and
  `extensions/goal-commands.ts:2325` documents it as "v0.27.5: /glla reviewer
  | postaudit". It is deliberately absent from the completion list
  (`extensions/loops/goal-activation.ts:1228-1250`), so a user tabbing
  completions could not find it either.

The README now names the alias on the `postaudit` row.

### 8. LOW (doc hygiene) — `note.md` looked like durable documentation

`note.md` is a transient scratchpad: 62 source citations across 22 files, all
of which point at content that has since been consumed into the shipped
code. Read cold it looks like a doc of record, and its citations are not
resolvable paths.

- **Doc side**: `note.md` (before) — a bare heading and a wall of citations
  with nothing saying what the file was.
- **Code side**: `docs/DESIGN.md:632` holds the durable load-hold rationale;
  `docs/RECOVERY.md` holds the durable recovery contract. The comments
  themselves carry their own reasoning, so the citations are provenance
  rather than a broken contract.

`note.md` now opens with a header stating that it is a transient scratchpad,
that its citations point at consumed content, and that the durable rationale
lives in `docs/DESIGN.md` and `docs/RECOVERY.md`.

---

## Candidates closed as NOT a defect

Recorded so a later pass does not re-raise them.

| Candidate | Why it is not a defect |
|---|---|
| `LIST-PHILOSOPHY.md:43` names `docs/per-screen-weak-points.md`, which does not exist | The path sits inside a blockquote quoting a 2026-07-24 incident ("Close every weak point in `docs/per-screen-weak-points.md` (76 items, one commit each)"). It is an illustrative seed, not a claim that the file ships. The behaviour it illustrates is pinned by `tests/list-philosophy.test.ts` "contract 8+11". |
| `docs/DESIGN.md:535` names `extensions/loops/forever.ts`; `:542` names `prompts/goal-loop-auditor.md` | Both are rows of a table whose status column reads "planned". The same cell says where each actually lives ("shipped as `extensions/goal-loop-forever.ts`", "never shipped; the prompt is built in `extensions/goal-loop-auditor.ts`"). The doc disambiguates deliberately. |
| `AGENTS.md` references `dracon-utilities/docs/design/*.md` | Paths into the sibling repository, not this one. All three resolve in `/home/dracon/Dev/dracon-utilities`. |
| `prompts/goal-loop-continuation.md:202` mentions `/goal drop`, which does not exist | It is a negative vocabulary rule: "reference only REAL commands … there is **no `/goal drop`** and **no command takes a goal id**". The doc is telling the model not to use it. |
| `CHANGELOG.md` cites paths that no longer exist (`audit/LONG-RUNNING-MODES.md`, `extensions/loops/goal-runtime.ts`, `.pi-glla/pitfalls.md`, …) | A changelog is a historical record of what was true at the time. It also cites runtime state paths, which are never repo files. |

---

## Claims verified as still true

Mechanical checks over the whole shipped surface.

- **Relative links** — 0 broken links across every shipped `.md` file.
- **Dead paths** — 350 path-like tokens extracted from the shipped docs; 32
  unresolved, all triaged in the table above or as changelog history.
- **Command verbs** — 55 distinct `command + verb` pairs mentioned across the
  shipped docs; every one resolves to a real handler. All 18 `/glla` verbs in
  the README table have handlers; all 20 `/glla` verbs mentioned anywhere in
  the shipped docs have handlers.
- **`docs/SETTINGS.md`** — its Global-only list and Keys table were diffed
  against `GLOBAL_ONLY_KEYS` and `SETTINGS_KEYS`: **0 mismatches** (the two
  apparent extras, `auditCapHard` and `mechanicalLoadScale`, are prose
  examples the same paragraph explicitly calls project-settable). The
  release-gate test the file claims for itself exists
  (`tests/settings-editors.test.ts:651`).
- **`docs/COMPATIBILITY.md`** — peer range `>=0.84.2 <0.100.0` for all four
  Pi packages, TypeBox `>=1.3.14 <1.4.0`, Node `>=22.19.0`, and the 0.99.1
  dev pins all match `package.json` exactly.
- **`docs/UI-STATUS.md`** — all 11 files in its surface map exist; all named
  symbols exist (`stateWorkView`, `mainModelRecoveryRuntimeStatus`,
  `fleetHealthRoots`); the fleet safety ceilings it quotes (16 roots, depth 4,
  2000 directories, 100 projects, 2000 ms, 512 KiB journal tail, 8 MiB total)
  match `extensions/fleet-health.ts:11-12` exactly.
- **`docs/WORKFLOWS.md`** — every command it names exists (`/goal plan`,
  `/goal verify`, `/goal audit`, `/goal start`, `/list import|show|next`,
  `/loop respec|status|blockers|refine|start|stop|audit`). Its metricless
  example `measure=none max=10 cadence=900` is explicitly supported
  (`extensions/goal-loop-forever.ts:500`, and `measure`/`max`/`cadence` are
  all known keys with valid values at `:458`).

---

## Regression coverage added

| File | Tests | Guards |
|---|---|---|
| `tests/doc-index.test.ts` (new) | 3 | Index completeness; relative-link resolution; index links nothing missing |
| `tests/settings-same-model-retries-provenance.test.ts` (new) | 3 | Key is provenance-tracked; the row shows the configured value and source; the default fallback still works |
| `tests/doc-parity.test.ts` (+3) | 8 | Reviewer cascade ↔ `DEFAULT_REVIEWER_CONFIG`; changelog range ↔ CHANGELOG headings; stop-reason field name ↔ Pi's `stopReason` |
| `tests/release-contract.test.ts` (corrected) | 15 | The index names the current package version — the contract the test always declared, minus the frozen trail start |

The repo's repeatable mutation-evidence harness
(`scripts/verify-test-pin-controls.mjs`) was extended with the scratch copy
the doc guards need, and **five new neutralized controls** were registered:

| Control | Mutation | Expected |
|---|---|---|
| same-model-retries provenance membership lost | drop the key from the `SETTINGS_KEYS` array literal (by AST — the bare literal also occurs in `GLOBAL_ONLY_KEYS`) | regression rejected |
| doc index entry removed | remove the `docs/UI-STATUS.md` entry from `docs/INDEX.md` | regression rejected |
| reviewer cascade claim stale | restore the unconditional reviewer wording | regression rejected |
| changelog range stale | restore "v0.35.14–v0.39.39" | regression rejected |
| stop-reason field name stale | restore `stop_reason="length"` | regression rejected |

All **25** registered mutations pass (20 pre-existing + 5 new).

---

## Verification

- `npm run check` — clean (`tsc --noEmit`, exit 0).
- `npm run check:inventory` — clean after regenerating
  `docs/RUNTIME-INVENTORY.md` (the extension/script line count moved
  72930 → 72963 and the top-level test-file count 453 → 455 with the two new
  test files).
- Focused suites — 65 pass / 0 fail across 8 files.
- `node scripts/verify-test-pin-controls.mjs` — 25/25 mutations rejected as
  expected.
- Full fast suite — see §5 of `audit/PROJECT-AUDIT-2026-10-19-V2.md` for the
  standing gate; the docs-review run is recorded in the findings register.

**Neutralized controls were also run in place** on the live tree, not only in
the disposable harness: each guard was reverted in the working tree, the
failing assertion was observed, and the file was restored. One correction is
recorded honestly — the first attempt at the `SETTINGS_KEYS` control matched
the *first* occurrence of the key literal (in `GLOBAL_ONLY_KEYS`) rather than
the one in `SETTINGS_KEYS`, so it neutralized the wrong site and the guard
stayed green. The file was restored from a pre-control copy, the control was
re-applied with an AST-based edit, and only then did the guard go red on
exactly the discriminating assertion.

## Not covered by this review

- `audit/` — evidence, not documentation; not audited as prose.
- `CHANGELOG.md` prose — read for endpoint claims and cited-path triage, not
  audited line by line. It is 674 KB and records 196 releases.
- The `docs/` set was verified by mechanical sweep (links, paths, command
  verbs, settings registries, dependency ranges, named symbols, numeric
  ceilings) rather than by reading every prose claim in `docs/DESIGN.md` (825
  lines), `docs/RECOVERY.md` (530 lines), `docs/OWNERSHIP-AND-SETTLEMENT.md`,
  `docs/RELIABILITY-AND-MEASUREMENT.md`, `docs/PROMOTION-CONTRACT.md`,
  `docs/VISION-ASSIST.md` and the `docs/DESIGN-*.md` files line by line. The
  read-only scout for that seam overran its tool-call bound without returning
  and was stopped, so it remains the natural next seam.
- `scripts/` and `.github/workflows/` — still **not audited** (unchanged from
  the 2026-10-19 project-audit pass; tasklist #8 in
  `audit/PROJECT-AUDIT-2026-10-19-V2.md`).

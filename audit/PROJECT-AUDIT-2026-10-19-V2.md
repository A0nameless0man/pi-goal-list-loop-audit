# Project audit — 2026-10-19 (second pass, v0.39.40)

**Scope.** `pi-goal-list-loop-audit` (GLLA) at the commit range `687aea407`
(the 2026-10-17 audit pass, which filed the project's only unresolved finding)
through the 2026-10-19 UI-rework release `v0.39.39`.

**Method.** One bounded pass, in the project's own established style:

1. Re-verify the single unresolved entry in `.pi-glla/audit-loop/findings.md`
   against the current source, and close it with evidence or fix it.
2. Three bounded **read-only scouts** over surfaces the 2026-10-19 pass had
   not covered — docs-vs-code drift, the new audit-rework UI surfaces, and
   release/packaging/CI plumbing — each with an exclusive file brief, a
   40-tool-call bound and a "quote both sides or drop it" evidence rule.
   Two returned; the packaging/CI scout **overran its bound without
   returning** and was stopped, so that seam is explicitly un-audited
   (tasklist #8).
3. Every candidate finding was re-verified against the source by the parent
   before it was accepted, and every fix carries a red-proven regression plus
   a **neutralized control** (the guard reverted in place) that fails exactly
   the discriminating assertion.

**Result.** 5 defects fixed, 1 previously-open finding closed with evidence,
2 open design questions recorded, and a tasklist of deferred work below.

This is a **bounded survey, not an exhaustive clean bill.** The surfaces the
scouts did not reach are listed at the end.

---

## 1. Findings fixed

### 1.1 HIGH — a refused `resume_goal` spent the cold-load consent gate

**Where.** `extensions/loops/goal-tools.ts` (`resume_goal`), the release site
at the old `:3208-3211` and the stale probe at `:3219-3240`.

**What.** The tool cleared `loadHoldAt` **in RAM only**, journalled
`load_hold_released {via:"agent-resume"}` and notified *"Load hold released —
automation is live again."* — **before** it ran the stale-session probe. So a
stale-session resume (and a durable-resume refusal) released a gate it never
opened, told the user automation was live, and left the live state disagreeing
with the durable projection, which still held the gate.

That is the drift AGENTS.md forbids outright: *"never let live state drift
from its durable projection."*

**Evidence (before the fix).**

```
durable loadHoldAt after refused resume: 1792414900181   ← the gate still held
tool reply:                  Resume refused in this stale session — …
load_hold ledger rows:       …, load_hold_released {via:"agent-resume"}   ← claims a release
user notice:                 "Load hold released — automation is live again." ← false
```

The same RAM-only pattern claimed releases in the five **user-command** release
sites (`extensions/goal-commands.ts:608`, `:2898`; `extensions/goal-loop.ts:1287`,
`:1454`, `:1465`, `:1586`), where a failed `persistState` left a journal row the
durable state contradicts.

**Fix.** A new shared helper, `releaseLoadHoldDurably`
(`extensions/goal-loop-core.ts:3216`), makes the release **durable before it is
claimed**: it persists first, journals and announces only a release that
landed, and restores the gate when the snapshot cannot be written so live and
durable still agree. All seven release sites use it. The `resume_goal` tool now
runs the stale probe and its refusal **before** the release, so a refusal
cannot consume a consent decision.

**Regressions.** `tests/resume-goal-stale-auditor.test.ts`,
`tests/load-hold-release.test.ts`.
**Control.** Moving the release back ahead of the stale refusal fails exactly
the consent-gate assertion; dropping the restore-on-failure fails exactly the
failed-release assertion.

---

### 1.2 HIGH — the published goal schema rejected valid runtime state

**Where.** `schemas/goal.schema.json:289-293` vs
`extensions/goal-loop-core.ts:815` (`PendingCompletion.leftOut?: string`) and
`extensions/loops/goal-tools.ts:1022` (the writer).

**What.** The shipped schema declared `pendingCompletion.leftOut` as an
**array**; the runtime has always written a **string** (`complete_goal`'s
`leftOut` is `Type.Optional(Type.String(...))`). Any goal the runtime persisted
with a non-empty `leftOut` was therefore **invalid under the schema shipped in
the npm package** — so a consumer validating a real goal file against the
published schema would reject it.

CI could not see it: the parity fixture in
`tests/audit-followup-contract.test.ts:117` used the array shape
(`leftOut: ["skipped the migration"]`), so the fixture agreed with the schema
and disagreed with the runtime.

**Fix.** The schema now declares a string; the fixture uses the runtime shape;
`tests/goal.schema.test.ts` pins the schema to the runtime — the string form
validates and the array form does not.
**Control.** Reverting the schema to the array shape fails exactly that test.

---

### 1.3 HIGH — one prose mention of `<evidence>` erased the whole objection list

**Where.** `extensions/audit-rework-handoff.ts:27`.

**What.** The evidence-block filter matched the substring `<evidence`
**anywhere on a line**, so a single prose sentence —
*"The scout run log is in the `<evidence>` block below."* — put the reader into
evidence mode for the rest of the report. The Required-fixes heading and every
item after it were discarded, the projection reported **zero objections** for a
report that had them, and the card told the user to go read the saved report
instead. A required fix that *asks for* an evidence block
(*"Attach an `<evidence>` block with the scout run log."*) had the same effect.

The intent of the filter is sound — evidence bullets and fenced output must
never be mistaken for objections — but **an evidence block is a TAG, not a
mention**.

**Fix.** Only a line that *is* the tag opens a block; a line carrying a
complete open/close pair is dropped on its own; a prose mention stays visible.
**Regressions.** Three new cases in `tests/audit-rework-handoff.test.ts` (the
prose mention, the fix that asks for a block, and a real block still being
removed).
**Control.** The substring-anywhere trigger fails exactly the two new cases
and leaves the pre-existing evidence-block case green.

---

### 1.4 MEDIUM — a truncated objections field read as the complete list

**Where.** `extensions/goal-loop-display.ts` (the omission marker) and the
compact card's `agent:` field at `:1673`.

**What.** The truncation marker covered `next`/`why`/`resume`/`candidate` but
not the compact card's `agent:` field — the field that carries the required
corrections. When the wrapped field lost its continuation, the user saw a
mid-sentence fragment with no marker, while the header still said
"3 corrections":

```
maxWidgetLines=6
  [2] ├─ review: changes requested · 3 corrections
  [3] ├─ agent: Prove the parallel scout run with inspectable artifacts. · Correct FIX versus DECIDE classifications before
  [4] ├─ you: send "continue" here
```

The third objection never appears, and nothing says the list was cut.

**Fix.** `agent` and `you` join the fields whose dropped continuation is
marked with `…`.
**Control.** Dropping them from the marker fails exactly the new test.

---

### 1.5 MEDIUM — the shipped docs contradicted the code in four places

| Where | Claim | Reality |
|---|---|---|
| `README.md:269` + table | "eight sections" | the menu ships **nine** (Designer missing from the table) |
| `docs/ARCHITECTURE.md:103` | "minus the 12 slowest" | `SLOW_TEST_FILES` holds **13** |
| `docs/ARCHITECTURE.md:85` | "~340 event types" | the runtime emits **~410** distinct types |
| `LIST-PHILOSOPHY.md:67` | See `INSTALL.md` "Reviewer" | INSTALL.md has **no such section** |

**Fix.** All four corrected. `tests/doc-parity.test.ts` now pins every count
that is *derived from the code*, so the class cannot drift silently again.
**Control.** Reverting the four doc fixes fails all five parity tests.

### 1.6 MEDIUM — the documented release gate was failing

`docs/RUNTIME-INVENTORY.md` was stale on every count it published, so
`npm run release:check` — the gate `README.md:355` and `docs/RELEASING.md:32`
both point operators at — failed at the inventory step. Regenerated with
`node scripts/generate-inventory.mjs`; the gate step now passes.

---

## 2. Finding closed with evidence, not code

**`[HIGH] Stale-session resume releases cold-restore auditor suppression
before refusal`** (filed 2026-10-17 at `687aea407`, the register's only
unresolved entry).

The finding was filed against the pre-v0.39.38 process-global
`releaseAuditorSurface()`. In the current tree the `resume_goal` tool releases
the auditor surface only on an admitted resume, and the `!staleResume` guard
made the release and the refusal mutually exclusive — **the behaviour was
already fixed**.

What was missing was **coverage**: the `/goal resume` *command* path carried a
regression (`tests/auditor-blank-until-resume.test.ts`), while the agent-side
`resume_goal` *tool* had none — so the finding could not be closed with
evidence in either direction. `tests/resume-goal-stale-auditor.test.ts` now
supplies it, using the **API-stale shape** (the captured `ExtensionAPI` is
dead while the invocation context still answers) — the shape
`warnIfStaleAtEntry` exists for and `foreignToolGuard` cannot see. The
`invalidateHostSession` helper is deliberately *not* used there: it also
poisons the context, which trips the earlier foreign-tool guard and would hide
the path under test.

**Control.** Removing the `!staleResume` guard from the recovery branch fails
exactly the discriminating case.

---

## 3. Open design questions (recorded, not guessed)

- **[LOW] A queued-but-not-started turn is labelled "working".** The compact
  card says `working` while its `you:` line claims *"no action needed; agent
  owns rework"*; the head already carries a `QUEUED` execution token. The
  rework's rule is that an unconfirmed workflow reads as "work saved", never
  "working" — but a queued turn is not a saved workflow either. The wording for
  a queued turn is a design call, so it is recorded in the register rather than
  guessed. (`extensions/goal-loop-display.ts:1554`, `:1674`;
  `extensions/ui-status.ts:206`.)
- **[LOW] The `leftOut` contract changed.** The published schema now matches
  the runtime. A consumer that validated `leftOut` as an array would now fail —
  but the runtime never wrote that shape, so the array contract was never
  satisfiable. Recorded so a downstream consumer is not surprised.

---

## 4. Tasklist — improvements still open

Ordered by expected value. Every item names the evidence that would close it.

| # | Item | Why it matters | Evidence to close |
|---|---|---|---|
| 1 | **Field-by-field schema/runtime parity for the whole goal schema.** The `leftOut` defect was one field; `backgroundWait`, `objectiveRepair`, `objectiveProvenance`, `solutionJudgment`, `subagentQuotaEvidence` and `pauseContractAmendment` were never diffed against the runtime. | The published schema is the package's external contract, and one wrong field type was enough to make real goal files invalid. | Generate the runtime field set per definition and assert each against the schema, in `tests/goal.schema.test.ts`. |
| 2 | **Derive every doc number from the code, not by hand.** `doc-parity.test.ts` now covers the settings sections, the slow-file count and the ledger event-type count; the same treatment is missing for the `~70%`/percentage/timeout figures quoted across `docs/`. | Four doc claims were already stale; each was a number a human typed once. | Extend `tests/doc-parity.test.ts` per document; prefer a generated table over prose. |
| 3 | **Assert the version and the CHANGELOG against the source in CI, not at release time.** `tests/release-contract.test.ts` catches a version/changelog mismatch, but only if a release is attempted. | `npm run release:check` — the documented gate — was failing on a stale generated doc, and the failure only surfaces at release time. | A cheap CI step that runs `check:inventory` and the doc-parity tests on every push. |
| 4 | **Sweep the remaining `goal-ui.ts` dispatch/timer/refresh logic** (1411 lines, sampled but not read). | The compact card and the consent gates are the newest surfaces; the dispatch layer around them is the least-audited. | A bounded scout pass over `extensions/loops/goal-ui.ts` with the same both-sides evidence rule. |
| 5 | **Audit the detailed and interrupted renderers** in `goal-loop-display.ts` (≈lines 1780–2290, 2440–3495), which the compact-card pass did not read. | The compact card is now pinned by regressions; the older renderers are not, and the truncation logic just changed under them. | Same evidence rule; reuse the card fixture. |
| 6 | **Decide the `you:`-line wording for a queued turn** (open question above). | The card currently asks the user for no action on a turn that has not started. | A maintainer decision, then a pinned case in `tests/audit-rework-handoff.test.ts`. |
| 7 | **Verify `docs/DESIGN.md` (825 lines) and `docs/RECOVERY.md` (530 lines) claim-by-claim.** | The docs scout read headings and two sections; the prose claims behind them were not verified, and DESIGN.md is the file the recovery design lives in. | A two-scout pass with a strict "quote both sides" rule. |
| 8 | **Audit the release/packaging/CI plumbing** (`scripts/`, `.github/workflows/`). A scout was dispatched for this seam but **did not return within its bound** and was stopped, so the seam is **un-audited** in this pass. | The release path is the least-exercised code in the repo, and the one place a defect publishes to npm. | Re-dispatch the same bounded brief; it never produced a report. |
| 9 | **Add a "refused action must not consume a consent gate" invariant test.** This pass found one instance in the tool path; the *shape* of the bug (a refusal that spends a gate) is generic. | A generic invariant would have caught the tool path and would catch the next instance. | A test that asserts no refusal path mutates a gate, across the resume/pause/unblock surfaces. |
| 10 | **Make the test runner distinguish a broken environment from broken code.** A concurrent `npm ci` emptied `node_modules` mid-run and produced 134 `ENOENT` failures with **zero** assertion failures — indistinguishable from a real regression at a glance. | A 17-minute silent run that ends in 134 confusing failures costs a full triage cycle and can be mistaken for a real break. | A preflight that asserts the dependency tree resolves, an early abort when it does not, and incremental per-file progress in the runner output. |
| 11 | **Pin the release doc's contract note.** The `leftOut` schema change alters the package's published contract. | A consumer validating a goal file against the shipped schema should know why the type changed. | Release doc content (tasklist #10's release step). |

---

## 4a. Recommended next step — release

The fix set is complete and the CHANGELOG carries it under `## Unreleased`.
This pass deliberately did **not** bump the version, tag, or publish: tagging
and publishing are externally visible, irreversible actions, and the repo's
release contract is the maintainer's to run.

To cut the release:

1. `package.json` + `package-lock.json` → `0.39.40`.
2. `CHANGELOG.md` — rename the `## Unreleased` heading to
   `## 0.39.40 — <title> (2026-10-19)` and add a fresh empty `## Unreleased`
   above it. The release contract requires **exactly one** `## Unreleased`
   section *and* exactly one `## <version> ` heading
   (`tests/release-contract.test.ts`).
3. `docs/INDEX.md` — the active-focus trail must reach the new version
   (`v0.35.14–v0.39.40`).
4. `docs/RUNTIME-INVENTORY.md` — regenerate with
   `node scripts/generate-inventory.mjs` (the gate fails on drift).
5. Add `audit/RELEASE-0-39-40-2026-10-19.md`, naming the `leftOut` schema
   contract change.
6. `npm run release:check`, then tag and publish via
   `.github/workflows/publish.yml`.

---

## 5. Verification

| Gate | Result |
|---|---|
| `npm run check` (tsc --noEmit) | clean |
| `npm run check:inventory` | clean after regeneration |
| Focused suites (11 files: stale-resume, load-hold, schema, handoff, doc-parity, resume-admission, neighbour resume/loop suites) | 75 + 14 + 16 + 5 + 19 pass, 0 fail |
| Invariant suites (state-ownership, release-contract, runtime-globals) | 30 pass, 0 fail |
| `npm run test:fast` (full fast set) | see the incident note below |
| Neutralized controls | 6 controls applied and reverted; each failed exactly its discriminating assertion |

**Incident note — the first full-suite run was invalid, and why.** The first
`npm run test:fast` reported **134 failures across 439 files**. Every failure
in the captured diagnostics was an `ENOENT` for a path under
`node_modules/@earendil-works/…`; not one was an assertion failure. The cause
was **external**: the repository's `node_modules` tree was emptied at 15:02:18,
two minutes before the run started — a concurrent `npm ci` from another
session on this machine (the box runs several Pi coding-agent sessions in
parallel). Nothing in this repository deletes `node_modules`: the only
candidate, `scripts/verify-test-pin-controls.mjs:75`, symlinks the tree into
a scratch directory and `rmSync`s the **link**, which was verified
empirically to leave the target intact, and that script is not invoked by the
suite. `npm ci` restored the tree (253 packages) and the suite was re-run
clean.

Two things are worth acting on, and they are recorded in the tasklist below:
a mid-run environment change currently produces 134 confusing failures rather
than one clear diagnosis, and the fast set emits no incremental output for
~17 minutes, so there is no way to tell a broken environment from broken code
until the very end.

**Note on the daemon.** The repo is watched by the dracon-sync daemon, which
auto-commits within seconds. This pass therefore produced a sequence of
auto-commits — including intermediate commits that captured the *neutralized
control* states used to prove the regressions. The final tree is correct; the
history is noisy in the middle. Per AGENTS.md the history was **not** rewritten
(`--amend`/`rebase`/`reset --hard`/`force-push` are forbidden here), and the
descriptive messages live in this report and in
`.pi-glla/audit-loop/findings.md`.

## 6. Not covered by this pass

- `docs/DESIGN.md` and `docs/RECOVERY.md` prose claims (headings and two
  sections read; the rest sampled).
- `extensions/loops/goal-ui.ts` beyond the two regions the compact-card pass
  touched.
- The detailed and interrupted renderers in `extensions/goal-loop-display.ts`.
- The remaining `schemas/goal.schema.json` definitions (see tasklist #1).
- `extensions/goal-continuation.ts` outside the auditor-surface reads.
- The `tests/` tree as an audit surface in its own right — it was read only as
  corroboration.
- `scripts/` and `.github/workflows/` — **not audited**. A bounded read-only
  scout was dispatched for this seam, ran past its 40-tool-call bound without
  returning, and was stopped. The seam is still open (tasklist #8).

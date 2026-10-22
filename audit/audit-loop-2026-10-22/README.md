# Audit loop — 2026-10-22 pass (goal 20261022085106-t76vq0)

The tracked mirror of this pass's findings. The live file is
`.pi-glla/audit-loop/findings.md` (machine-local runtime state, per
AGENTS.md); this copy is the reviewable record that rides the branch.

Five parallel read-only scouts surveyed the release/CI + packaging seam, the
detached-auditor worker/process seam, the documentation-vs-code seam, the
settings/model-selection seam, and the durable-state/journal seam. Every
finding was deduped against the earlier passes (see
`prior-findings-index.md` in this directory) before it was recorded; nothing
already listed was re-reported.

# Full-project audit pass — 2026-10-22 (goal 20261022085106-t76vq0, branch main)

Fresh pass, five parallel read-only scouts (release/CI + packaging, the
detached-auditor worker/process seam, the documentation-vs-code seam, the
settings/model-selection seam, the durable-state/journal seam), each with a
tight scope, a ~30-40 tool-use budget and a ~150-line report cap. Every
finding below was deduped against the earlier passes in this file (and
against `audit/audit-loop-2026-10-22/prior-findings-index.md`) before it was
written here; nothing already listed was re-reported. Append-only.

## FIX findings (2026-10-22 pass)

- [x] FIX: MEDIUM: the published tarball shipped `scripts/run-tests.mjs`, which imported `tests/slow-files.mjs` — a path the package does not ship — so the runner could not be imported from an installed package at all (ERR_MODULE_NOT_FOUND), while the release gate asserted BOTH that the runner ships and that no `tests/` file ships (tests/release-contract.test.ts:76,138 — jointly false) — fixed in a0bf2969b (the slow-file list moved to `scripts/slow-files.mjs` beside the runner that consumes it, `tests/slow-files.mjs` re-exports it, and the contract test pins the real tarball file list)
- [x] FIX: MEDIUM: `.github/workflows/real-host-canary.yml` checked out the dispatch-selected ref while the step injected the provider secrets into that ref's code (scripts/real-host-canary.mjs:50 forwards process.env) — fixed in a0bf2969b (the canary is pinned to the default branch)
- [x] FIX: LOW: the runner's stall watchdog could SHRINK its window — the "extend" branch returned an unclamped 1 440 000 ms against the declared 900 000 ms ceiling (scripts/run-tests.mjs:128 vs :89) — fixed in a0bf2969b (the extended window is clamped to the declared ceiling)
- [x] FIX: LOW: `.github/workflows/publish.yml:131-141` checked only the tag STRING, never that the tag points at the reviewed, validated source (docs/RELEASING.md:65) — fixed in a0bf2969b (the release job enforces the tag's ancestry)
- [x] FIX: MEDIUM: the project `subagentModelOverrides` map REPLACED the global map wholesale (extensions/goal-settings.ts:872-878), so pinning one role in a project made every other role's global pin inert there; the editor also persisted the effective map, and a "global" pin edit landed in the project file (extensions/loops/goal-settings-ui.ts:230-244,1119-1123) — fixed in b089f1764 (the pin maps merge per role, a dead project entry falls through to the live global role, and the editors write only the edited role into the layer that owns it)
- [x] FIX: MEDIUM: the auditor's model and dial were written into ONE scope (extensions/loops/goal-settings-ui.ts:1763-1764), so a "session — inherit" choice cleared only the layer that owned the dial: a pin in the other layer survived, the menu announced session inheritance, and the runtime kept applying it (extensions/loops/goal-auditor-hooks.ts:1484-1486) — fixed in 4253538a4 (the inherit choice clears the dial in every layer that holds one; a concrete level still goes to the layer that owns the effective value)
- [x] FIX: MEDIUM: the settings menu resolved the thinking level downward while the main-chain dispatch clamps it upward (extensions/goal-recovery.ts:707-710), so the menu could under-report the level the chain actually ran at — fixed in b089f1764 (the main fallback chain row shows the level dispatch applies)
- [x] FIX: MEDIUM: the auditor fallback editor computed its primary from the GLOBAL layer while the runtime resolves the project-aware one, so a project-owned primary could be saved as its own backup and was then dropped at runtime (extensions/loops/goal-settings-ui.ts:1807-1812 vs extensions/loops/goal-auditor-hooks.ts:1429) — fixed in b089f1764 (the editor excludes the EFFECTIVE auditor model)
- [x] FIX: LOW: the forbidden-models editor protected the fallback chains but not the pinned role primaries, which the runtime then skipped silently (extensions/designer-model.ts:60-64, extensions/drafter-model.ts:70-75) — fixed in b089f1764 (the primaries are protected too)
- [x] FIX: LOW: the model picker's deduplication was case-sensitive unless the cap was exactly ten, so `Sonnet` and `sonnet` could both persist in the forbidden list while every other ref list deduplicates case-insensitively (extensions/loops/goal-settings-ui.ts:936-940) — fixed in b089f1764 (case-insensitive always)
- [x] FIX: LOW: the compactor capped the primary PLUS its fallbacks at ten, so a pinned primary silently ate one of the ten alternatives the settings UI accepts (extensions/compactor-model.ts) — fixed in b089f1764 (the fallback setting is bounded independently; the tenth alternative survives)
- [x] FIX: MEDIUM: `updateGoal` assigned the NEW goal to RAM before the durable write was proven, so a failed `persistState` left the live session holding a goal the ledger never recorded (extensions/loops/goal-orchestrator.ts:1041-1054) — fixed in 9fe3036a0 (a failed update rolls back completely — RAM, the markdown projection and the pending transaction — and the caller keeps getting false)
- [x] FIX: MEDIUM: `setGoal` journalled `goal_created` unconditionally, so the journal claimed a creation the state line might not carry (extensions/loops/goal-orchestrator.ts:1011-1022) — fixed in 9fe3036a0 (the row carries whether the state line landed)
- [x] FIX: MEDIUM: the goal-queue repair path ignored its `persistState` result and journalled a promotion the snapshot may not carry (extensions/loops/goal-list-queue.ts:816-822,833-840) — fixed in 9fe3036a0 (a failed promotion restores the queued order and records an explicitly unpersisted row)
- [x] FIX: LOW: `createGoal` still released the cold-load hold in RAM and journalled the release as if it had landed (extensions/loops/goal-orchestrator.ts:793-796) — the pre-fix pattern the 2026-10-19 repair had already removed everywhere else — fixed in 9fe3036a0 (it goes through the durable `releaseLoadHoldDurably` helper)
- [x] FIX: MEDIUM: the terminal-summary outbox discarded the result of the `deliveredAt` write and journalled `terminal_approval_render_replayed` regardless, so a store that could not be written kept the entry undelivered FOREVER and showed the user the same summary on every later replay (extensions/approval-render-store.ts:186-194) — fixed in 005056f1d (the acknowledgement is the gate for the claim: a delivery whose acknowledgement did not land is journalled as `terminal_approval_render_replay_unacknowledged`, and only a landed acknowledgement produces the `..._replayed` row)
- [x] FIX: LOW: a corrupt or unreadable approval-render store was re-reported on every read — one ledger row per replay attempt, forever, while the queue stayed stuck (extensions/approval-render-store.ts:44-68) — fixed in 005056f1d (the row is reported once per distinct broken store and names the repair; the fail-closed contract — bytes preserved, mutations refused until an operator repairs the file — is unchanged)
- [x] FIX: LOW: `readState` merged legacy `state` lines field by field, so a field the newest COMPLETE snapshot had dropped (JSON omits an undefined value — `lastModelRef` is exactly that case) came back from an older line (extensions/goal-loop-core.ts:3047-3062) — fixed in 005056f1d (a complete snapshot is a replacement; only legacy partial lines still merge)
- [x] FIX: HIGH: the parent accepted any `result.json` whose identity fields matched the `request.json` in the same job dir, and that request hash is UNKEYED, so the auditor child — which runs with bash inside the audited project — could forge its own `<approved/>` (extensions/goal-loop-auditor-process.ts:2502, scripts/goal-auditor-worker.mjs:806,827) — fixed in 51fc9a99f (the verdict is authenticated: the parent generates a per-attempt key, hands it to the worker over the worker's stdin pipe — never argv, never an env var, never a file — and the worker signs the result; a result that does not authenticate is ignored, the attempt keeps waiting for the worker's signed result, and the rejection is journalled once as `auditor_result_unauthenticated`)
- [x] FIX: MEDIUM: the per-tool timeout was a floor, not a ceiling (`max(operator setting, model-declared timeout)` capped at 6 h — scripts/goal-auditor-worker.mjs:599-607, extensions/goal-loop-auditor-process.ts:853-859), so docs/DESIGN.md's "independent five-minute ceiling" never existed — fixed in 51fc9a99f (the doc now states the real rule: the effective deadline is the greater of the configured base and the call's own declared timeout, bounded by the shared ceiling; the base is a floor)
- [x] FIX: MEDIUM: the extension fence kept ANY absolute existing path (scripts/auditor-extension-specs.mjs:51-63 → scripts/goal-auditor-worker.mjs:819), so a tampered job dir could name an extension file anywhere on the host — fixed in 51fc9a99f (the fence keeps only specs inside the operator's own trees — the audited project and the pi agent dir — and with no roots it keeps nothing, fail-closed)
- [x] FIX: MEDIUM: docs/DESIGN.md:276-281 presented `mainModelFallbackOnRateLimit` as a live global switch, but the key was retired with the v0.34.142 addendum and is deleted on load (extensions/goal-settings.ts:698,831), so an operator's value was silently inert — fixed in ab8b62d7a (the doc says the knob was retired, and a retired key is now REPORTED as an ignored setting instead of vanishing)
- [x] FIX: MEDIUM: docs/DESIGN.md:791 quoted "the 12 evidence-timed slow files" while the runner's list holds 13 (and docs/ARCHITECTURE.md said 13) — fixed in ab8b62d7a (the doc now quotes the real count, and a parity guard checks EVERY shipped doc that quotes the count)
- [x] FIX: MEDIUM: docs/SETTINGS.md — the shipped settings contract — omitted `fleetHealthRoots`, a real validated runtime key that docs/UI-STATUS.md tells operators to configure in the settings JSON (extensions/goal-settings.ts:67,553; extensions/goal-commands.ts:3467) — fixed in ab8b62d7a (the key is documented, and a parity guard requires every key another shipped doc tells the operator to configure to be in the settings contract)
- [x] FIX: LOW: docs/ARCHITECTURE.md:18 said "All 17 Pi event registrations" while extensions/loops/goal-activation.ts registers 18 — fixed in ab8b62d7a (the doc now quotes the real count, and a guard derives it from the source)
- [x] FIX: LOW: docs/ARCHITECTURE.md:71-72 said the auditor worker "runs Pi `--no-session`"; it always runs `--mode rpc` and only adds `--session` when the `auditorInspection` setting is on (scripts/goal-auditor-worker.mjs:798-799) — fixed in ab8b62d7a (the doc states the real invocation, and a guard checks the doc against the worker source)

## DECIDE findings (2026-10-22 pass)

- [x] DECIDED: Decline unverifiable saved audit verdicts after a host crash and rerun the audit; chosen by user and queued with list_add (2026-10-22). Cost: another audit attempt after a crash; benefit: recovery cannot apply an unauthenticated verdict. Target: extensions/goal-loop-auditor-process.ts:2109-2119. Live-path authentication remains protected by 51fc9a99f. Recovery behavior is unchanged in this pass.

Two older open decisions were also raised and answered on 2026-10-22:
- [x] DECIDED: Queue compact-card wording that distinguishes queued-but-not-started rework from active work, including the `you:` line.
- [x] DECIDED: Queue a compatibility/release note explaining the corrected `pendingCompletion.leftOut` string schema; retain the runtime-correct schema.

All three selected follow-ups are queued behind this audit. None was silently implemented as a FIX.

### Rehearsal correction (2026-10-22)

The existing canary finding above required a second correction: the first fix used the nonexistent `github.default_branch` context, which can resolve empty and restore dispatch-ref checkout. This is the same finding, not a new duplicate. The repository event context `github.event.repository.default_branch` is now used — fixed in 250a79b973417966cbd0ae55fa51cd1cc34fc6e6. The release-contract test rejects the old undefined property and accepts harmless expression whitespace; 17 tests pass with zero failures.

### Corrective parallel scout assessment (same pass)

- [x] FIX: MEDIUM: selecting session inheritance for a subagent thinking pin removes only its owning scope, so a project pin deletion reveals the same role's global pin instead of inheriting the session (extensions/loops/goal-settings-ui.ts:1225; extensions/goal-settings.ts:943-946) — fixed in b264e24c3 (the inherit choice now clears that role's thinking pin in EVERY scope that holds one, leaving every other role untouched; 4471ab8f5 keeps the layer map's type exact)

Existing queue-promotion finding reopened: snapshot refusal restores RAM but leaves the new or rewritten repair sidecar recoverable; the activation caller also retries despite refusal (extensions/loops/goal-list-queue.ts:826-855,951-961). This is the surviving rollback half of the existing finding, not a duplicate FIX row. Repair and verification pending.

- [x] FIX: MEDIUM: a refused repair promotion rolled back RAM but left the new or rewritten repair sidecar recoverable, and the activation caller retried the promotion anyway (extensions/loops/goal-list-queue.ts:826-855,951-961) — fixed in 28111809f (the helper reports refusal, the new sidecar is removed and the rewritten one restored to its previous bytes, the refusal is journalled with whether the rollback landed, and the activation caller stops instead of retrying)
- [x] FIX: MEDIUM: this pass's own `goal_created` truthfulness change broke the v0.28.28 provenance pin, which matched the ledger row as one exact literal, so the list-queue suite failed against a correct implementation (tests/list-queue.test.ts:154) — fixed in fa1749dcb (the pin now asserts the `via` and `persisted` fields separately: a dropped field still fails, an added field does not)

(The earlier "Repair and verification pending" note above is superseded by the two checked FIX rows that follow it.)

- [x] FIX: HIGH: the test runner passes modern Bun isolation/exclusion flags without checking support; Bun 1.3.3 treats an unsupported exclusion value as an inclusion filter, so --all reports green after running only the Node-only test (scripts/run-tests.mjs:215-235; reproduced with disposable two-file fixture and the local --all run) — fixed in ad3c7111c (bounded capability preflight refuses unsupported Bun before starting tests); regression fixtures and declarations in ded2af54a. Old Bun now exits 1; CI-pinned Bun 1.3.14 passes the hardened seven-file regression run (110 pass, 0 fail).

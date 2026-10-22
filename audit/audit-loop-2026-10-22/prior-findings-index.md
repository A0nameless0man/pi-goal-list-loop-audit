# Prior findings index (deduplication aid for the 2026-10-22 audit pass)

Condensed from `.pi-glla/audit-loop/findings.md` (495 entries, 2026-08-11 → 2026-10-21).
Grep this file for your subsystem keyword BEFORE reporting: a finding already listed here is NOT new.

# Audit findings — pi-goal-list-loop-audit (2026-08-11, v0.34.127)
## FIX findings
- [x] FIX: MEDIUM: runLoopTick captures `const loop = state.loop!` (extensions/goal-loop.ts:425) and mutates it across `await runMeasure` (up to 10 min) / `await runGit` — a concurrent `/loop stop` or 
- [x] FIX: MEDIUM: already_shipped guard's version-less path is pure phrase-trigger with zero corroboration (extensions/loops/goal-tools.ts:507-519)
- [x] FIX: MEDIUM: fan-out dedupe false-drop (extensions/loops/goal-orchestrator.ts:793-796) — dedupes first-60-chars of each finding against the JOINED queue, so a distinct finding whose prefix appear
- [x] FIX: MEDIUM: "read-only" auditor is not read-only — bash is in READ_ONLY_TOOLS and the worker launches pi with --approve (extensions/goal-loop-auditor-process.ts:96, scripts/goal-auditor-worker.m
- [x] FIX: MEDIUM: VISION_ASSIST_GUIDANCE claims "gpt-5.5, sonnet, opus are forbidden by default" (extensions/vision-assist.ts:46) — the default is [] since v0.34.115 (extensions/goal-loop-core.ts:1029
- [x] FIX: MEDIUM: blocked-pause banner mislabels the main-model-recovery manual hold as "blocked — waiting on a non-quota condition" (extensions/goal-loop-display.ts:1216) — holdMainModelRecovery (ext
- [x] FIX: MEDIUM: forbidden-models picker exclusion only exact-matches `provider/id` (extensions/model-picker.ts:62-64) while callers pass unexpanded normalizeModelRefs output (extensions/main-model-r
- [x] FIX: MEDIUM: docs/VISION-ASSIST.md:35,57 claim `/glla forbiddenModels=...` and `/glla visionAssist=off` syntax; the dispatcher rejects any non-action arg as "Unknown /glla action" (extensions/goa
- [x] FIX: MEDIUM: AGENTS.md:59 references `scripts/release.sh` which does not exist (scripts/ contains only goal-auditor-worker.mjs + smoke.sh) — dead path in the durable operating rules
- [x] FIX: MEDIUM: tests/README.md documents the runner as `node --experimental-strip-types --test tests/*.test.ts` with a node-only coverage model, but package.json "test" is `bun test` and behavioral
- [x] FIX: MEDIUM: package.json "test:node" script is dead AND broken — `tests/*.test.ts` glob misses tests/loops/goal.test.ts and ~71 test files import `.js`-extension paths that only exist as `.ts`; 
- [x] FIX: MEDIUM: v0.34.127's headless `/glla` list sync (11 keys: decisionPopup, carryover, auditorModelFallback, auditorSameSessionSwap, auditorSilent, auditorProgressSignals, hourlyQuotaProbe, suba
- [x] FIX: MEDIUM: tests/commit-survival-e2e.test.ts:25-47 is vacuous — even with GLLA_E2E_DAEMON=1 it runs in a fresh mkdtemp repo that no daemon watches; the reflog/HEAD asserts are trivially true an
- [x] FIX: MEDIUM: t.skip() vs assert.ok(true) contradiction (tests/command-registration-collisions.test.ts:218 vs tests/subagent-model-override.test.ts:167) — if bun's node:test lacks t.skip(), the li
- [x] FIX: LOW: cmdTweak reinstalls a pre-dialog goal snapshot (extensions/goal-commands.ts:670) — state.goal captured before `await ctx.ui.confirm`; any state.goal change made while the dialog was ope
- [x] FIX: LOW: parseQuotaError numeric Retry-After regex unanchored and runs before the HTTP-date branch (extensions/quota-retry.ts:97) — a digit-leading date value (`retry-after: 2026-08-10T12:00:00Z
- [x] FIX: LOW: continuationStartRecoveryRearms map (extensions/goal-continuation.ts:262) has no clear site (unlike continuationStartCompactionRearms) — entries accumulate per dispatch inside the 5-min
- [x] FIX: LOW: compaction-cap fall-through drift (extensions/goal-continuation.ts:612) — comment promises "fall through to the unacknowledged warning" after the 3-rearm cap, but code reaches dispatchT
- [x] FIX: LOW: TEMPORARY_QUOTA regex bare `over\s+(?:the\s+)?(?:quota|rate\s*limit)` alternative (extensions/quota-retry.ts:43) matches non-temporary plan-wall prose ("You are over your monthly quota 
- [x] FIX: LOW: syncSubagentModelOverrides repair state (extensions/goal-loop-subagents.ts:221-271) records only files written on the LAST sync — after an idempotent no-op sync, prevWritten is empty an
- [x] FIX: LOW: matchedVersion misattribution (extensions/loops/goal-tools.ts:514) — grabs the FIRST vX.Y.Z anywhere in the summary, not the version the "already shipped" claim refers to; a dependency 
- [x] FIX: LOW: already_shipped branch (extensions/loops/goal-tools.ts:522-537) mutates + archives WITHOUT the guardGoalBeforeContinuation/archive-fence the normal path gets at line 563 — a crash betwe
- [x] FIX: LOW: orphaned pi RPC child after cancel/wall-timeout — worker finish() SIGTERMs pi without waiting (scripts/goal-auditor-worker.mjs); if pi is wedged on a hung provider stream the worker sta
- [x] FIX: LOW: .pi-glla/audit-jobs/<attemptId>/ job dirs are never removed by parent or worker (extensions/goal-loop-auditor-process.ts:206-217, 468) — every infra retry/fallback attempt accumulates a
- [x] FIX: LOW: parseAuditFindingsForFanout only matches exactly-one-space boxes `\[ \]` (extensions/goal-loop-forever.ts:575) — a findings.md edited with two-space/aligned checkboxes is silently invis
- [x] FIX: LOW: formatClockTime is production-dead (extensions/goal-loop-display.ts:58) — v0.34.125 removed its last call site; only a test references it; stale v0.34.95 comment claims the quota-recove
- [x] FIX: LOW: stale default-policy comment: "the policy gate defaults ON — gpt-5.5/sonnet/opus must never be selected unattended" (extensions/goal-settings.ts:178) — actual default is [] since v0.34.
- [x] FIX: LOW: interactive menu's "Effective resolution" row renders without the session model (extensions/loops/goal-settings-ui.ts:513) — inherit-parent shows generic "session model" while the headl
- [x] FIX: LOW: "next: resuming now" can contradict the parked head on the same status line — pausedNextTransition returns "resuming now" once retryAt passes (extensions/goal-loop-display.ts:634) while
- [x] FIX: LOW: dispatcher cases `subagentFallbacks:Plan` / `subagentFallbacks:general-purpose` unreachable — the menu only emits rows for KNOWN_PINNED_DEFAULT_AGENTS = ["Explore"] (extensions/settings
- [x] FIX: LOW: an exception in ANY settings editor silently exits the whole menu — `catch { return; }` (extensions/loops/goal-settings-ui.ts:521-523) swallows the error with no notify, contradicting t
- [x] FIX: LOW: drift guard silently passes via assert.ok(true, "drift check skipped") when pi-subagents isn't installed (tests/subagent-model-override.test.ts:169,186) — the embedded-copy drift pin ne
- [x] FIX: LOW: tests/auditor-process.test.ts:54-61 writes tests/fixtures/auditor-fake-worker.mjs into the source tree at runtime — cleaned up only on successful teardown; interrupted runs leave a stra
- [x] FIX: LOW: jiti 2.7.0 is imported by tests/repro-jiti-state-split.test.mjs and required by "test:jiti" but not declared in package.json devDependencies — works only via hoisting from @earendil-wor
- [x] FIX: LOW: CHANGELOG.md:3-4 "## Unreleased" contains numbered version headers (v0.34.127…v0.34.118) while package.json already reads 0.34.127 — contradicts docs/RELEASING.md's own rule ("do not in
## DECIDE findings (NOT queued as fixes — direction calls for the user)
- [x] DECIDED: corroborate — version-less already-shipped claims route to the normal audit so the auditor verifies the work exists in the tree (true claim completes truthfully; false claim is disapproved a
## Severity breakdown
- [x] DECIDED: permit bash in the detached completion auditor for broader audit power and customization, accepting the prompt-injection/write-capability risk in preference to strict read-only safety (2026-
# Full-project audit pass — 2026-08-16 (v0.35.3, branch main)
## FIX findings (2026-08-16 pass)
- [x] FIX: MEDIUM: scratch-branch leak on refusal paths (extensions/goal-loop.ts:725-750) — branch=1 `loop stop`/`loop start` refusals (dirty tree, already on a scratch branch, active loop) return WITH
- [x] FIX: MEDIUM: branch=1 terminal-iteration destroy (extensions/goal-loop.ts:587-601,662) — the final iteration's finishLoopGit ran after the stop/park handler had already restored the original bran
- [x] FIX: MEDIUM: auditMeasureCmd counts DECIDED lines as open findings (extensions/goal-loop-forever.ts) — `grep -cE '^- \['`-style counting included `- [x] DECIDED:`/`- [x] DEFERRED:` lines, so reso
- [x] FIX: MEDIUM: strict-space checkbox regex misses aligned/tabbed boxes (extensions/goal-loop-forever.ts) — countOpenAuditFindings/topOpenAuditFinding matched only exactly `[ ]`, so findings.md edit
- [x] FIX: MEDIUM: parseLoopStartArgs splits key=value pairs inside quoted targets (extensions/goal-loop-forever.ts) — `/loop start "reduce TODO=chores" ...` split on the `=` inside the quoted objectiv
- [x] FIX: LOW: backoff dead code (extensions/goal-loop-backoff.ts) — backoffMs/shouldPauseAfterBackoff/humanMs/accountTurnForNudges + BACKOFF_HARD_CAP_MS/BACKOFF_ERROR_* had zero production call sites
- [x] FIX: MEDIUM: zombie auto-abort fires while a subagent wait is in flight (extensions/loops/goal-activation.ts:410 via HeartbeatDeps) — a MAIN session busy-silent on a long Agent tool run could be 
- [x] FIX: LOW: starved-notify refires every fresh second while the streak holds (extensions/goal-heartbeat.ts) — the second-precision `lastStarvedRefusedAt !== Date.now().toString().slice(0,-3)` gate 
- [x] FIX: LOW: quota-retry dead ternary — both branches identical (extensions/quota-retry.ts:143) — the display projection collapsed to the same string, so the sensitive/non-sensitive distinction was 
- [x] FIX: MEDIUM: auditor prompt claims an auto-continue the detached worker lacks (extensions/goal-loop-auditor.ts) — buildGoalAuditorPrompt told the auditor "the orchestrator's auto-continue fires o
- [x] FIX: LOW: goal.schema.json missing fields (schemas/goal.schema.json) — goal-level revision (contract-change counter consumed by the revision-bound verdict gate), completionSummary, pendingTasks (
- [x] FIX: MEDIUM: smoke.sh waits on "approved by auditor" prose that precedes the verdict (scripts/smoke.sh) — the phrase appears in tool returns/agent narration before the audit finishes, so the happ
- [x] FIX: MEDIUM: smoke.sh loop scenario uses a rejected `/glla project notify='...'` assignment (scripts/smoke.sh) — /glla is an action namespace (status/log/audits/wipe…) and rejects key=value args 
- [x] FIX: MEDIUM: settings menu shows base defaults while aggressiveMode is ON by default (extensions/settings-menu.ts) — unset auditCap/stuckMaxInterventions rendered "5 [default]" and wedge alerts "
- [x] FIX: LOW: boolean VALUE column vocabulary mismatch (extensions/settings-menu.ts) — set booleans rendered as raw `true`/`false` while every fallback label and select editor says on/off
- [x] FIX: MEDIUM: examples/example-objective.md documents rejected `/glla key=value` syntax (examples/example-objective.md) — `/glla notify='...'`, `/glla tokenlimit=...`, `/glla model=...`, `/glla pr
- [x] FIX: LOW: INSTALL.md stale runner/test-count claims (INSTALL.md) — "tests use --experimental-strip-types" (they run under bun) and the v0.34.22 "728 tests" pin
- [x] FIX: LOW: docs/RELEASING.md milestone example wrong format (docs/RELEASING.md) — cited `### 0.34.51`; the changelog convention is `## <version> — <title> (<date>)` with `###` topic subsections
- [x] FIX: LOW: README keeps the false "stuck backoff caps at 5 minutes then pauses" claim (README.md:534-546) — the exact promise removed from goal-loop-backoff.ts as never-enforced; the real v0.27.3+
- [x] FIX: LOW: pi-subagents is an undeclared test dependency (package.json / .github/workflows/publish.yml) — the release drift guard (tests/subagent-model-override.test.ts:167) FAILS LOUDLY without @
## DECIDE findings (2026-08-16 pass)
- [x] DECIDED: remove the dead knobs (2026-08-16) — user chose REMOVE over implement: leverageMode/confirmOn fields, defaults, the "Leverage mode" menu row, and the /glla toggle branch are gone (fixed in 5
## Severity breakdown (2026-08-16 pass)
# Full-project audit pass — 2026-08-18 (v0.35.4, branch main)
## FIX findings (2026-08-18 pass)
- [x] FIX: HIGH: queue sidecar writes bypass the persistence-degradation boundary and can leave partial temporary files or abort a batch after earlier sidecars landed (extensions/goal-loop-core.ts:967-
- [x] FIX: HIGH: carryover=clear drops state.list without deleting recoverable queue sidecars, so a fresh session can resurrect items the user cleared (extensions/loops/goal-session.ts:1239-1249)
- [x] FIX: HIGH: disk-recovered queue items are used only by /list show and are never hydrated into state.list, so /list next and other mutations cannot act on the displayed recovered work (extensions/
- [x] FIX: MEDIUM: readQueueFromDisk omits repairTarget, so a recovered repair/replan item loses the safety metadata needed by guarded activation (extensions/goal-loop-core.ts:1021-1048)
- [x] FIX: MEDIUM: disk queue recovery sorts by sidecar filename/random id suffix rather than durable enqueue order, so same-batch items can reorder after reload (extensions/goal-loop-core.ts:1025-1027
- [x] FIX: MEDIUM: packaged docs/INDEX.md links to tracked root docs, examples, changelog, and audit files excluded by package.json's files allowlist, producing broken links in the npm artifact (packag
- [x] FIX: LOW: README's hardcoded current package version remains v0.35.3 while package and lock metadata are v0.35.4, with no release-test assertion for the README marker (README.md:13; tests/glla-ve
- [x] FIX: MEDIUM: the persistence schema omits runtime Goal parentId/telemetry and AuditVerdict impossible/impossibleReason/durationMs fields, while the drift test checks only schema-to-interface memb
## Survey limitations
## Follow-up finding — 2026-08-18
- [x] FIX: MEDIUM: heartbeatTick stops probing as soon as a stale completion claim is parked as `status=paused`/`phase=recovery-pending`, so the healthy same-session self-heal path never runs without a
- [x] FIX: MEDIUM: the inline `extractVerificationContract` fallback treats the ordinary imperative `verify ...` as a contract marker, truncating a list objective such as `... and verify the stale reco
# Replacement fresh-project audit pass — 2026-08-18 (v0.35.4, branch main)
# Full-project audit pass — 2026-08-23 (v0.35.33, branch main)
## FIX findings (2026-08-23 pass)
- [x] FIX: HIGH: the v0.35.31 "metric never moved" stop reason promises "/loop resume retries" but that prefix is not in RESUMABLE_STOP (extensions/goal-loop.ts:929-939 matches only HELD_ON_RESTORE/pro
- [x] FIX: MEDIUM: State.lastOutcome is not durable — persistStateLine (extensions/goal-state.ts:72-89) serializes a fixed field list WITHOUT lastOutcome and readState (extensions/goal-loop-core.ts:127
- [x] FIX: MEDIUM: v0.35.31 user-seed trust silently no-ops whenever the seed carries a "Done when:" clause or @agent role — createGoal (extensions/goal-orchestrator.ts:600-615) stores the RAW arg in u
- [x] FIX: MEDIUM: complete_goal newObjective appends the AGENT-authored objective to userSeeds (extensions/loops/goal-tools.ts:494-498), and since setGoal defaults createdVia="user", the v0.35.31 guar
- [x] FIX: MEDIUM: autoResumedAt/autoResumedEvent recovery notice is never marked delivered — the only clearing site is MANUAL resume (extensions/goal-commands.ts:475); heartbeat backstop (extensions/g
- [x] FIX: LOW: two loop-stop routes skip the queued-list announcement contradicting v0.35.22's "ends by ANY route … ANNOUNCE loudly": stuck-ladder stop (extensions/goal-loop.ts:657-666) and provider-e
- [x] FIX: LOW: applyRefinement resets bestValue/lastValue/stallCount on a measure change but keeps history (extensions/goal-loop-forever.ts:187-203), so metricHasMoved reads OLD-era improvements (goal
- [x] FIX: LOW: refine's orchestrator-side spec write updates specText/specHash but not loop.specChecked (extensions/loops/goal-tools.ts:1998-2002), so the next tick ledgers spec_item_progress attribut
- [x] FIX: LOW: draftingDepth runtime global is write-only dead state — set in startDrafting (extensions/loops/goal-list-queue.ts:770), reset in clearDraftingState, zero readers (template selection use
- [x] FIX: LOW: plan-mode seededHint concatenation glitch — planNote ends "…than a regular draft." and is concatenated directly with "${label}: …" (extensions/loops/goal-list-queue.ts:783-793), produci
- [x] FIX: LOW: /glla agents --tail renders child-transcript lines through ctx.ui.notify without ANSI/control-character sanitization (formatTranscriptEntry truncates but never strips escapes, extension
- [x] FIX: LOW: completions/handler parity gaps with no pinning test: /list add|import|rm handled (extensions/goal-commands.ts:1237-1255) but absent from /list completions; /loop resume|refine|polish h
- [x] FIX: LOW: overdueWaitBackstop mutates durable state (parked → active, clears pauseResumeAt) without checking extensionApiStale/sessionHandoffPending/mainModelRecoveryActive gates (extensions/goal
- [x] FIX: MEDIUM: README has no verb-semantics documentation — the user explicitly flagged (2026-08-23): what /goal|/list|/loop audit MEAN vs start vs the new plan verbs lives only in code comments; i
- [x] FIX: MEDIUM: README Files map stale on release day: prompts listing (README.md:693-697) shows 4 files but prompts/ contains 7 — missing prompts/goal-loop-plan.md + goal-loop-plan-loop.md shipped 
- [x] FIX: MEDIUM: commit 28131527's audit-kind exemption in applyMeasurement (both the metricHasMoved carve-out and the never-moved-stop guard) ships with ZERO regression pin — no test constructs a ki
## DECIDE findings (2026-08-23 pass)
- [x] DECIDED: keep /list plan as the LONG DRAFT — no direct import path (user 2026-08-23: "we dont do file if we added a file then it would just read it but we are still doing a long draft") — when a file
## Docs currency (fold into fixes above)
## Severity breakdown (2026-08-23 pass)
# Full-project audit pass — 2026-08-25 (v0.35.63, branch main)
## NEW FINDINGS
- [x] DECIDED: defer the music/browser UI scope for this repository — the user confirmed that goal belonged elsewhere (2026-08-25)
- [x] FIX: MEDIUM: GitHub Actions grants `id-token: write` to the quality job that runs repository-controlled install/tests, expanding publish-token exposure beyond the publish job (.github/workflows/p
- [x] FIX: MEDIUM: auditor-extension allowlist validation is opt-in and fail-open, so CI/release can pass without checking the intended extension boundary (tests/auditor-extensions.test.ts:191; scripts
- [x] DEFERRED: real-host smoke coverage policy remains outside the release gate; no integration job was requested in this pass (2026-08-25)
- [x] FIX: LOW: CHANGELOG.md contains duplicate `## 0.35.35` release headings, making version-based release-note extraction ambiguous (CHANGELOG.md:517,531)
## SURVEY NOTES
# Follow-up to the 2026-08-25 stall audit disapproval — v0.35.65
- [x] FIX: HIGH: the frozen-child escalation was initially wired only to a
# Follow-up to Screenshot_20260825_173552 — repair/replan deadlock
- [x] FIX: HIGH: activating a queued repair card copied `repairTarget` onto an
# Fresh full-project audit pass — 2026-08-27 (v0.35.71, branch main)
## NEW FINDINGS
- [x] FIX: HIGH: goal markdown is written before the state ledger with no crash-recovery transaction; a process death or append failure between `writeGoalMd` and `persistStateLine` leaves the newer sta
- [x] FIX: HIGH: session ownership does not fence competing pi processes sharing a working-directory root; `session-owner.json` and `owner.json` are overwritten by the new PID, but a different PID is n
- [x] FIX: MEDIUM: queue hydration treats a sidecar with an already-known id as authoritative only in memory and never reconciles newer sidecar fields such as objective, repairTarget, parentId, or queu
- [x] FIX: MEDIUM: `writeQueueItemFile` reports an existing id collision as `{wrote:false}` without `failed`, and enqueue callers test only `failed` before committing the new item to state (extensions/
- [x] FIX: MEDIUM: `/goal pause` and the length/stall continuation send paths do not share one pause fence; `scheduleContinuation` checks the supervisor pause but `cmdPause`, `sendStallEscalation`, and
- [x] FIX: MEDIUM: low-level `agent_start`/`turn_start`/`message_update`/`agent_end` activity acknowledges any same-owner dispatch, while only `before_agent_start` validates the exact marker (extension
- [x] FIX: HIGH: a transient failure of mechanical contract command 1 that passes its one retry returns success immediately, so commands 2 and later never run (extensions/goal-loop-shield.ts:206-287) —
- [x] FIX: HIGH: `propose_loop_draft` and `propose_loop_refine` execute measure probes without the normal `MEASURE_TIMEOUT_MS` bound (extensions/loops/goal-tools.ts:1860-1863,1977-1982; extensions/goal
- [x] FIX: MEDIUM: runtime loop measurement parses numeric stdout without checking the measure command's exit status (extensions/goal-loop.ts:228-234) — a failed command that prints a number can be acc
- [x] FIX: HIGH: hierarchical `/list show` and `list_status` labels collapse children to `1.1`/`1.2` while `/list next`, `list_activate`, and `/list remove` index the raw flat queue (extensions/loops/g
- [x] FIX: HIGH: activation ignores a failed queue-sidecar deletion and proceeds after removing the item from memory (extensions/goal-loop-core.ts:1123-1129; extensions/loops/goal-list-queue.ts:739) — 
- [x] FIX: MEDIUM: post-audit `proposeGoal` ignores the boolean returned by `safeSteerUser` and reports success whenever no exception is thrown (extensions/loops/goal-auditor-hooks.ts:1313-1326) — stal
- [x] FIX: MEDIUM: managed subagent ownership is detected by an unanchored body substring rather than an exact frontmatter field (extensions/goal-loop-subagents.ts:211-214) — a user-owned agent file qu
- [x] FIX: HIGH: stale command contexts can mutate durable `/goal` and `/loop` state because pause/cancel/tweak and loop dispatch do not perform the same entry admission fence as creation/resume (exten
- [x] FIX: HIGH: an interactive settings dialog checks staleness only before awaiting the menu; its post-confirm handlers save settings without rechecking session admission (extensions/goal-commands.ts
- [x] FIX: MEDIUM: `autoResume` is documented and surfaced as global-only but is omitted from `GLOBAL_ONLY_KEYS`, while startup reads only global settings and does not apply the aggressive-mode effecti
- [x] FIX: LOW: docs/INDEX.md's recent-work trail stops at v0.35.64 although package.json and CHANGELOG.md are at v0.35.71 (docs/INDEX.md:14-23; package.json:3; CHANGELOG.md:3) — maintainers following 
- [x] DECIDED: retain the project-scoped `notifyCmd` trusted-repository hook with explicit disclosure that GLLA is a long-running objective power tool and the configured command may execute on lifecycle ev
- [x] DEFERRED: selected auditor extensions execute arbitrary extension initialization code in the detached worker despite the isolated-auditor framing (extensions/loops/goal-settings-ui.ts:1186-1249; exten
- [x] FIX: MEDIUM: the release contract hardcodes a `0.35.35` changelog heading instead of deriving the current version from package.json (tests/release-contract.test.ts:64-67; package.json:3; CHANGELO
- [x] FIX: MEDIUM: README claims the npm package contains the full test suite, but the package `files` allowlist omits `tests/` (README.md:440-443; package.json:32-46) — published documentation contrad
- [x] FIX: MEDIUM: project-relative auditor extension specs are resolved against `~/.pi/agent` for every allowlist entry, not the project settings base (extensions/auditor-extensions.ts:157-166) — a va
- [x] FIX: MEDIUM: the offline auditor-extension release check shells out through the POSIX `timeout` utility, which is not the GNU timeout wrapper on a vanilla Windows install (scripts/verify-auditor-
- [x] FIX: LOW: scripts/smoke.sh's `wait_for` searches the entire captured pane with unanchored regex `grep -q`, so broad markers such as `?`, `Yes`, or `✓ done:` can be satisfied by model prose before
# Full-project follow-up tasklist — 2026-08-31 (v0.36.0, branch main)
## OPEN FINDINGS
- [x] FIX: HIGH: terminal archival is still not crash-transactional — `archiveCurrentGoal` publishes the exclusive archive and deletes the active markdown before it persists the terminal/empty live slo
- [x] FIX: HIGH: destructive queue paths still discard RAM/ledger state after queue-sidecar deletion fails — `/list clear`, `/list cancel`, and `/list remove` clear/remove entries despite failed or unc
- [x] FIX: MEDIUM: the active ledger has no bounded rotation/segment policy — this repo's `active.jsonl` is already 29,379,138 bytes / 10,982 events and an isolated `readState` takes about 123 ms becau
- [x] FIX: MEDIUM: several user-facing/runtime readers still synchronously materialize and parse the entire active ledger on the main process — `/list depth`, `/glla log`, `/glla switchlog`, postaudit 
- [x] FIX: LOW: detached-auditor scratch has no project-wide stale-directory collector — normal attempts remove only their own directory and restart reaping scans only names matching the current logica
- [x] FIX: LOW: the extracted runtime bridge defeats TypeScript at the highest-risk lifecycle boundary — `extensions/loops/goal-runtime-globals.ts` declares more than 200 globals as `any`, contributing
- [x] FIX: LOW: `release:check` validates `npm pack --dry-run` but never imports the actual packed artifact; source-tree tests can pass while a required runtime file is absent or an export works only t
# Fresh cwd-scoped project audit pass — 2026-09-01 (post-v0.36.1 working tree)
## NEW FINDINGS
- [x] FIX: MEDIUM: recovery-resume, session-handoff, and pending-list sidecars accept future-dated timestamps because freshness checks only require `Date.now() - at < window` (`extensions/goal-recovery
- [x] FIX: MEDIUM: `/glla agents --tail` only identity-scans the newest 25 session transcripts (`extensions/goal-agents-panel.ts:246-282`) — a tracked child whose matching JSONL is older than that cap 
- [x] FIX: HIGH: list-audit fan-out reads `${cwd}/.pi-glla/audit-loop/findings.md` directly instead of the admitted configured state root (`extensions/loops/goal-orchestrator.ts:983-990`; `extensions/g
- [x] FIX: LOW: `docs/INDEX.md` promises “manual install / symlink setup” while `INSTALL.md` documents npm/source invocation but no symlink procedure (`docs/INDEX.md:32-39`; `INSTALL.md`) — package-sto
- [x] FIX: MEDIUM: Widget task-linkage header mislabeled as agent row
- [x] FIX: MEDIUM: Status line has no width budget and can exceed terminal width
- [x] FIX: MEDIUM: Settings TUI tabs row unbounded
- [x] FIX: MEDIUM: `truncate()`/`wrap()` count JS chars not terminal cells
- [x] FIX: MEDIUM: Doc-promised `└ blocks: <parent wait> (zombie stand-down)` row from `inFlightToolCalls` not rendered anywhere
- [x] FIX: MEDIUM: Doc-promised `subagent_hang_detected` "Recent hangs" panel footer missing
- [x] FIX: LOW: Doc row shape drift — doc shows single-line `● <type> <summary> RUNNING 4m12s tools…` but code renders two-line
- [x] FIX: LOW: `/glla agents --tail` ambiguous prefix silently picks first match — fixed (exact id resolves directly; 2+ prefix hits list candidates and refuse; regression in tests/agents-panel.test.t
- [x] FIX: LOW: Headless settings fallback rows unbounded
- [x] FIX: LOW: Stale file headers claim both loop UI modules are `extensions/loops/goal.ts` ("The goal loop") — wrong module identity for maintainers (extensions/loops/goal-ui.ts:1) — fixed (header na
- [x] FIX: LOW: Stale file headers claim both loop UI modules are `extensions/loops/goal.ts` ("The goal loop") — same wrong header duplicated (extensions/loops/goal-settings-ui.ts:1) — fixed (header na
- [x] FIX: LOW: `completionSummaryLines` default 240-char values emit ~250-char chat lines with no width option
- [x] FIX: LOW: Agents-panel `truncate`/`cleanField` can split surrogate pairs and miscount wide glyphs
- [x] DECIDED: (2026-09-06, user): Show count line — quiet hides only when zero tracked; tracked-but-healthy keeps the compact count line (HUNG still surfaces via ⚠). Implemented: removed the quiet+healthy
- [x] FIX: HIGH: looksLikePi substring match admits non-pi processes (`pip`/`pilot` match "pi") past the SIGTERM gate — fixed (argv-identity gate: argv[0] exact `pi`/`pi-*` or runtime+pi-script; `pip i
- [x] FIX: HIGH: model-supplied measureCmd test-run execs via bash -c before the Confirm dialog shows output; autoAcceptDrafts removes even the after-the-fact dialog (model-triggered shell exec) (exten
- [x] FIX: HIGH: same pre-confirm shell exec on the refine path — newMeasure runs before user sees the re-baseline dialog (extensions/loops/goal-tools.ts:2627) — fixed (same disclosure treatment as the
- [x] FIX: MEDIUM: scheduleContinuation clears abortedStandDown before actionable/guard checks, so no-op schedules discharge the user-abort latch (extensions/goal-continuation.ts:1064) — fixed (clear m
- [x] FIX: MEDIUM: guard trusts durable-state absolute archivedPath for existsSync then discards the live goal (corrupted-state arbitrary-path probe + goal-nulling DoS) (extensions/goal-continuation.ts
- [x] FIX: MEDIUM: 30s ownership-recheck throttle leaves up to 30s of competing writes after an owner change (extensions/loops/goal-session.ts:979) — fixed (throttle 30s→10s single JSON read; command e
- [x] FIX: MEDIUM: last-wins supersede steals a live owner with no generation/epoch fence; racing mains flap the root (extensions/state-root-owner.ts:362) — fixed (same-session lineage reclaims quietly
- [x] FIX: MEDIUM: control-message predicate matches forgeable substrings, letting crafted text get legitimate messages projected out of context (extensions/context-checkpoint.ts:329) — fixed (dead `is
- [x] FIX: MEDIUM: terminal completion notice has no generation fence and can fire into a successor session (extensions/goal-continuation.ts:1117) — fixed (`TerminalCompletionNotice.generation` stamped
- [x] FIX: LOW: proc start re-verified at classify time, not at signal time (pid recycled in the gap gets SIGTERMed) (extensions/state-root-owner.ts:280) — fixed (pre-signal re-read; changed/non-pi occ
- [x] FIX: LOW: auto-advance silently skips head groups with no ledger entry (extensions/loops/goal-list-queue.ts:722) — fixed (`list_group_auto_skipped{groupId,skippedGroups,landedOn}` ledgered on the
- [x] FIX: LOW: CLK_TCK env var overrides the pid-reuse clock divisor and can skew the recycled verdict (extensions/state-root-owner.ts:80) — fixed (hardcoded 100 with safe-direction rationale: overest
- [x] FIX: LOW: archive temp names use Math.random (predictable; wx-flag mitigated, use randomUUID) (extensions/loops/goal-orchestrator.ts:1178) — fixed (`node:crypto randomUUID` in the temp name)
- [x] FIX: LOW: globalThis bridge keeps ~200 names with an any-typed function remainder and no duplicate/overwrite detection (extensions/loops/goal-runtime-globals.ts:14) — fixed (globalThis-held per-n
- [x] DECIDED: (2026-09-06, user): Harness-test + contract-check — VERIFIED LIVE, no move needed. pi's type contract (`MessageEndEventResult.message`, "Replace the finalized message") + runtime (`agent-ses
- [x] FIX: HIGH: headless /glla fallback omits compactorModel/compactorModelFallbacks + subagentDisplayRichness (file:extensions/goal-commands.ts:2695) — fixed (three rows added with provenance; source
- [x] FIX: LOW: status-line width budget truncated the `/glla resume` action off LIST QUEUED status (found by the release gate: list-invisible-restart v0.35.61) — fixed (waitingListStatus budgets the o
- [x] FIX: LOW: list-invisible-restart tests leaked cold-restore auditor-surface suppression into co-resident files (3 display.test.ts failures in combo runs) — fixed (afterEach `__testOnlyResetAuditor
- [x] FIX: MEDIUM: normalizeLoadedSettings leaves tokenLimit/auditCap/stuck/stall/wedge/carryover/decisionPopup/aggressive/notifyCmd/auditorModel unvalidated for hand edits
- [x] FIX: MEDIUM: ModelSelector.retryDelayMs hardcodes 15m base and ignores scope/setting
- [x] FIX: MEDIUM: drafter session-last-resort bypasses forbiddenModels gate
- [x] FIX: MEDIUM: compactor one-shot is process-local so restart refires brief/page per episode
- [x] FIX: MEDIUM: legacy reviewer key is readable but has no row/editor/migration so stale config is immortal
- [x] FIX: MEDIUM: auditorExtensionArgs emits raw specs while dispatch resolves fail-closed, so saved npm: entries silently vanish offline
- [x] FIX: LOW: allowlist normalize dedups case-sensitively while fallback chains dedup case-insensitively
- [x] FIX: LOW: MultiModelPicker silently slices initialSelected to maxSelections with no omitted notice
- [x] FIX: LOW: compactor worker kill is SIGTERM-only with no SIGKILL fallback
- [x] FIX: LOW: release smoke jiti alias points at nonexistent @tintinweb/pi-subagents path (nothing imports the scoped name; package depends on unscoped pi-subagents) — stale tintinweb-era drift
- [x] FIX: LOW: no docs/SETTINGS*.md canonical reference; settings truth lives only in menu/headless/CHANGELOG
- [x] FIX: MEDIUM: worker rows say "silent 0s" while the child is visibly working
- [x] DECIDED: head owns liveness (2026-09-07) — user chose head-keeps-lifesign; status drops its [LIVE/WORKING] capsule + last-stream tail, keeps state + counts
- [x] DECIDED: exceptions-only by default (2026-09-07) — user chose exceptions-only; richness default flips so healthy fan-out lives on the fleet panel, troubled rows + head readout stay, setting remains f
- [x] DECIDED: exceptions-only by default (2026-09-07) — user chose exceptions-only over head-readout-only/keep: richness default flips so healthy fan-out lives on the fleet panel, troubled rows + head rea
- [x] FIX: HIGH: compact count line flags hung only when the stalest child is hung — fixed (trouble flag scans all live children via hasHungWorker; aborting wording kept; sibling-scan pinned in tests/s
- [x] FIX: MEDIUM: hasHungWorker covers hung + abort-requested but not action failed/unavailable — fixed (failed/unavailable fire, matching lifesignBandFor; ended-with-failure still excluded; pins in t
- [x] FIX: MEDIUM: headLifesign triangles only on status hung, ignoring action failed/unavailable — fixed (failed/unavailable triangle the head; pins in tests/lifesign.test.ts), so the head can breathe
- [x] FIX: MEDIUM: head band uses raw freshestMs with no queued-cap and no abort handling — fixed (head band is now the worst per-row band via shared lifesignBandFor; queued caps, abort reads aging; re
- [x] FIX: LOW: fresh head age text paints dim, not the documented success ramp — fixed (fresh age rides success; pins in tests/display.test.ts via theme assertions) (head glyph + age text + row glyphs
- [x] FIX: MEDIUM: completedGoalLines emits `✓ done` twice — fixed (outcome leads once; recap budget counts all fixed adornments; exactly-once pinned in tests/display.test.ts) and objBudget omits the o
- [x] FIX: LOW: widget prefixes every worker row with `agent: ` — fixed (bare glyph-first Option-2 rows; header special-case removed as dead; pins in tests/display.test.ts + tests/agents-panel.test.ts)
- [x] FIX: MEDIUM: status suppresses the worker summary while auditing — fixed (summary rides every branch incl. auditing for HUNG-never-silent; widget rows splice before the auditor block so observati
- [x] FIX: LOW: head `total` elapsed ticks wall-clock every render — fixed (goalTotalText rides the shared 5s/15s/30s bucket grain; goal-ui comment states the honest contract; pins updated in tests/dis
- [x] FIX: LOW: orphan-worker fallback invents an undocumented `● active workers` header — fixed (count line leads when present, else bare rows; pins in tests/agents-panel.test.ts) after v0.38.23 remov
- [x] FIX: LOW: loop branchName line is appended after the `└─` footer — fixed (branch rides an ├─ detail row before the footer; footer-last invariant restored), breaking the footer-last tree invariant
- [x] FIX: HIGH: sendContinuation omits abortedStandDown — fixed (send-side abort-latch check; explicit resumes clear the latch so no deadlock; source pins in tests/stall-handling.test.ts), so an armed
- [x] FIX: HIGH: sendStallEscalation omits abortedStandDown — fixed (same latch check; source pins in tests/stall-handling.test.ts), so a stall nudge resurrects a stood-down chain (file:extensions/goal
- [x] FIX: HIGH: sendLengthContinue omits abortedStandDown — fixed (same latch check; source pins in tests/stall-handling.test.ts), so a length nudge resurrects a stood-down chain (file:extensions/goal
- [x] FIX: HIGH: sendTerminalCompletionNotice omits stoodDown/pending/aborted checks — fixed, scoped (refuses on abortedStandDown with ledger entry; deliberately not on stoodDown/pending — closure wins
- [x] FIX: MEDIUM: agent_start/turn_start fallback acks dispatch with no marker match — fixed (message_start stamps genuine user-role messages via noteUserMessageForDispatch; fallback refuses + ledgers
- [x] FIX: HIGH: zombie-timer `goalId!==undefined||goal` routes loop aborts into the goal branch — fixed (retry routes on the abort closure goalId; a goal started during the delay no longer strands the
- [x] FIX: MEDIUM: silent-successor absorb bumps generation without clearing pendingContinuationDispatch — fixed (shared clearDeadGenerationDispatch helper: clears the dead dispatch via clearContinuati
- [x] FIX: MEDIUM: writeOwnerFile non-atomic read-then-overwrite — fixed (compare-and-swap refresh: re-read before write, abort when the record now names a foreign pid; sole caller refreshes own claim 
- [x] FIX: MEDIUM: supersedeLiveOwnerRoot unlink-then-claim — fixed, bounded (compare-and-swap the unlink: re-read pid/at/instanceId before removeOwnerFile on both reclaim + steal paths, refuse + ledge
- [x] FIX: MEDIUM: 10s ownership-recheck throttle serves cached held/lost — fixed (refreshOwnershipStanding takes force; command entry warnIfStaleAtEntry forces a fresh read per command while backgroun
- [x] FIX: HIGH: fallback-exhausted cycle-reset re-activates goal/loop immediately with no horizon/delay — fixed, scoped (each new cycle does attempts+1 so the next failure's envelope delay grows, and 
- [x] FIX: MEDIUM: session_start unconditionally clears mainModelAbortForRecovery/lastMainModelFailure — fixed (clear only when no recovery episode is active; parked recovery preserves the markers so p
- [x] FIX: LOW: stale-continuation sanitizer exempts length-continue — fixed (exemption removed: marker-less length text with live supervision already falls through to delivered, so only the no-supervi
- [x] FIX: MEDIUM: absorb/self-heal notify consumes the rearm latch with no continuation when old pending survives — fixed (same root cause as the absorb finding: orphaned pending blocked the tail sche
- [x] FIX: MEDIUM: stallShortWords editor promises `0 = off` but save persists 0 into a normalizer that deletes it — fixed at the root (normalizer keeps 0; editor already saved it correctly; consumer a
- [x] FIX: MEDIUM: normalizeLoadedSettings deletes stallShortWords <= 0 — fixed (`<= 0` → `< 0`; junk test updated: -1 still normalizes, 0 = off survives; pins in tests/settings-menu-complete.test.ts)
- [x] FIX: MEDIUM: consumer uses `s.stallShortWords ?? DEFAULT_STALL_SHORT_WORDS`, so the off-state is unrepresentable — no change needed (0 is not nullish so it flows through, and wordCount < 0 never 
- [x] FIX: MEDIUM: auditorModel flow has no inherit/clear for thinking — fixed (ladder reuses drafterThinkingChoiceOptions with the session-inherit row; choosing it clears to undefined, which both spaw
- [x] FIX: MEDIUM: picking a non-reasoning auditor model returns early without clearing stale auditorThinkingLevel — fixed (early-return branch clears the override + says so in the notify; pins in test
- [x] FIX: LOW: subagentDisplayRichness doc comment still advertises rich = rows + task-linkage header — fixed (the :248 type comment was already corrected under Task 1's exceptions-only change, daemon
- [x] FIX: LOW: settings-menu row description still advertises `rich shows worker rows + task linkage`
- [x] FIX: LOW: picker option still advertises `rich — worker rows + task linkage (recommended)`
- [x] FIX: LOW: goal-ui comment still advertises the task-linkage header after its removal
- [x] FIX: LOW: quiet comment vs count-line behavior — fixed (type comment now documents the count line staying at every level per the 2026-09-06 ambient-awareness decision; pin in tests/settings-menu-
- [x] FIX: LOW: menu quiet copy contradicts the count line — fixed (description now `quiet shows troubled workers only + the count line`; pin in tests/settings-menu-complete.test.ts)
- [x] FIX: LOW: picker quiet copy contradicts the count line — fixed (option now `quiet — troubled workers only + the count line`; pin in tests/settings-menu-complete.test.ts)
- [x] FIX: LOW: cmdReviewerSettings comment vs migration — fixed (comment now documents that reviewer-key writes don't stick: load-migration consolidates into postaudit; the write-to-read-key code is u
- [x] FIX: LOW: SETTINGS_KEYS reviewer entry dead provenance — fixed (entry comment now documents the full lifecycle: menu saves can still write it when postaudit is unset, load-migration consolidates 
- [x] FIX: LOW: DESIGN-subagent-visibility two-line worker-row example — fixed (example rewritten to the shipped one-glyph-line rows with the footer-deletion + id-placement notes; orphaned old-example 
- [x] FIX: LOW: SETTINGS.md wedgeAlertMinutes vs aggressive default — fixed (row now reads `unset (30, or off while aggressive mode is on — the default)` + notes the menu shows effective; verified agai
- [x] FIX: LOW: SETTINGS_MUTATING_ACTIONS treats bare `/glla fallbacks` as mutating — fixed (gate in goal-commands.ts is now arg-aware: bare display allowed on stale handle, clear/off/unset/none still 
- [x] FIX: LOW: notifyCmd `auto` display vs literal trap — fixed (editor maps auto/auto-detect/default/empty → unset so the visible word round-trips; menu `auto` stays truthful, headless `(unset)` stay
# Full-project audit pass — 2026-09-08 (v0.38.29, branch main)
- [x] FIX: LOW: approval-render replay runs before the stale/ownership fence (extensions/loops/goal-activation.ts:779-786,789-795,873-878 plus review/list wrappers call replayUndeliveredApprovalRenders
- [x] FIX: LOW: countDone counts only direct children of closed parents while countTotal recurses all descendants (extensions/goal-loop-display.ts:1341-1356 adds 1 + subtasks.length; Task.subtasks recu
- [x] FIX: LOW: plain-text surfaces still use the rejected ANSI-emitting truncator (extensions/goal-loop-display.ts:61-66 documents pi-tui truncateToWidth wraps ellipsis in ANSI resets even for plain t
- [x] FIX: LOW: budgetFor floor defeats narrow widths and recovery truncates ignore width entirely (extensions/goal-loop-display.ts:262 Math.max(floor, width-margin-prefix); modelProvenanceLines :343 f
- [x] FIX: LOW: displayObjective strips only 3 Markdown wrappers while compactness doc claims broader strip (extensions/goal-loop-display.ts:94-99 removes **..**, __..__, `..` only; # Header, *em*, [la
- [x] FIX: LOW: approval-render store ledger spam + surrogate-unsafe slice + unbounded lines (extensions/approval-render-store.ts:47-68 corrupt-file read appends terminal_approval_render_store_invalid 
- [x] FIX: LOW: goal card recovery/provenance block is kind-blind (extensions/goal-loop-display.ts:1652-1665 shows compact recovery when g.status active and any state.mainModelRecovery with no kind che
- [x] FIX: LOW: topOpenAuditFinding strip lags its own matcher (extensions/goal-loop-forever.ts:603 finder accepts aligned/tabbed boxes via /^- \[[ \t]+\]/ per 77a684ce but :604 strip only removes exac
- [x] FIX: LOW: parseLoopStartArgs eats known-key = words in unquoted prose even when the value is junk (extensions/goal-loop-forever.ts:421-436 kvRe matches (\w+)= anywhere, KNOWN_KEYS filter :422 plu
- [x] DECIDED: migrate-on-read for pre-v0.38.21 audit histories (2026-09-08) — user chose migrate-on-read over grandfather: backfill superseded flags on read so no stale retry ever argues settled objection
- [x] DECIDED: normalize findings.md indent convention (2026-09-08) — user chose normalize over enforce-flat: accept optional indent in countOpen/topOpen/auditMeasureCmd + fan-out together; queue as follow
- [x] FIX: LOW: overdue wait-pause claims imminent resume forever + generic tail (extensions/goal-loop-display.ts pausedNextTransition returns "resuming now" for any passed pauseResumeAt; card body "au
# Full-project audit pass — 2026-09-10 (v0.38.44, branch main)
- [x] FIX: HIGH: refreshUpdateCheck spawn has no error listener (extensions/glla-update-check.ts:64; SpawnFn type cannot express one) — a failed npm spawn emits an async error event the outer try/catch
- [x] FIX: HIGH: formatGllaVersion reports up to date on unknown manifest version (extensions/glla-version.ts:84) — compareVersions(latest, "unknown") yields NaN→0, so the exact damaged-manifest case s
- [x] FIX: HIGH: withoutStaleNext drops the recorded-facts fallback Next (extensions/completion-summary.ts:217) — STALE_NEXT_PATTERN /review/i matches buildRecordedFactsCompletionSummary's "Next: revie
- [x] FIX: MEDIUM: future-dated sidecar forces per-contact spawn storm (extensions/glla-update-check.ts:37,62) — strict reader nulls future checkedAt so refresh treats it as a permanent miss and spawns
- [x] FIX: MEDIUM: refresh caches unvalidated npm stdout token (extensions/glla-update-check.ts:70) — last-whitespace-token cached with zero semver check, so registry noise poisons the sidecar to TTL e
- [x] FIX: MEDIUM: formatGllaVersion hand-rolled sidecar parse diverges from readUpdateCheck (extensions/glla-version.ts:75) — honors future-dated/checkedAt-less caches the status path rejects with no 
- [x] FIX: MEDIUM: approval-render goalId dedup blocks a fresh render after delivered history (extensions/approval-render-store.ts:93) — delivered entries are retained as capped history, so the exists-
- [x] FIX: MEDIUM: updateCheckPath ignores the sessionDir state root (extensions/glla-version.ts:9) — hardcodes cwd/.pi-glla while piGlaDir (extensions/goal-loop-core.ts:1210, via resolveGllaStateDir) 
- [x] FIX: LOW: dead readUpdateCheck import (extensions/goal-commands.ts:39) — cmdGllaVersion goes through formatGllaVersion's own read; compiles only because noUnusedLocals is off
- [x] FIX: LOW: auditorVerdictTally void now plus future lastAt renders 0s ago (extensions/goal-loop-display.ts:611,632) — dead parameter beside a real use: fmtElapsed clamps negative to 0, so clock sk
- [x] FIX: LOW: chatSafeDetailValue leaves nested machine-path husks (extensions/completion-summary.ts:161) — single-pass innermost-only paren strip turns "(log (/tmp/x.log))" into "(log )" which the e
- [x] FIX: LOW: clipSummaryValue slices UTF-16 code units (extensions/completion-summary.ts:90) — length/slice can split surrogate pairs, unlike the code-point-safe approval-render-store truncation fix
- [x] FIX: LOW: compactCompletionSummary mis-segments on inner label matches (extensions/completion-summary.ts:111) — first-occurrence indexOf per label, so a value containing e.g. "Tests:" steals the 
- [x] FIX: LOW: recoveryResume disjunct has no production writer (extensions/loops/goal-activation.ts:1554) — repo-wide grep finds no writer for recovery-resume.json (only tests plant it), so the expli
- [x] FIX: LOW: compareVersions equates prerelease with release (extensions/glla-version.ts:15) — parseInt("3-beta")===3, so 1.2.3-beta==1.2.3 and non-numeric parts force silent equality instead of unk
- [x] FIX: LOW: version-tail pins cover one branch plus hand-built literal (tests/display.test.ts:88) — active-goal branch only, while the live goal-ui wiring (runningGllaVersion + sidecar read) has ze
- [x] DECIDED: 2026-09-10 (owner): keep the cleared-segment contract — idle sessions stay versionless. Rationale: on-demand `/glla version` already answers the version question; a permanent idle segment is
# Full-project audit pass — 2026-09-11 (v0.38.48, branch main)
- [x] FIX: MEDIUM: continuation prompt omits the v0.38.48 task-batch tool and pending-task completion gate (prompts/goal-loop-continuation.md:58,60,177,206) — the Available-tools list names only propos
- [x] FIX: MEDIUM: README verify steps omit the pending-task completion gate (README.md:247) — the numbered complete_goal path reads claim straight to detached auditor with no mention that open committ
- [x] FIX: LOW: user docs lag the v0.38.46-48 terminal voice and versions (INSTALL.md:34-38; README.md:27; docs/DESIGN-long-running-supervision.md:91-121) — INSTALL updating examples still show v0.38.4
- [x] FIX: LOW: completion-summary usefulness gate still uses first-occurrence segmentation while every projector uses last-occurrence (extensions/completion-summary.ts:49) — missingCompletionSummaryLa
- [x] FIX: LOW: completing an already-complete task reports not found (extensions/loops/goal-tools.ts:2218,2257) — complete_task falls through to `Task <id> not found` when the id exists with status co
- [x] FIX: LOW: sidecar writers bypass the pending sessionDir write boundary (extensions/approval-render-store.ts:69; extensions/glla-update-check.ts:58,88) — neither references stateRootPending while 
# Full-project audit pass — 2026-09-13 (v0.38.53, branch main)
- [x] FIX: HIGH: tmpdir spawn-child.js fixture with require() breaks under ambient parent package.json type:module — the known 2026-09-13 field failure (stray /tmp/package.json); no .cjs rename or guar
- [x] FIX: HIGH: second instance of the same non-hermetic pattern — spawn-many.js with require() in .js under mkdtemp (tests/regression-shield.test.ts:463)
- [x] FIX: MEDIUM: packed skill never load-tested — release-contract loads the skill from the repo cwd and the smoke asserts only SKILL.md presence, so a present-but-unloadable-as-shipped skill passes 
- [x] FIX: LOW: smoke required[] omits runtime-loaded files (compactor worker, all prompts, schema) so a files-narrowing that drops them ships green (scripts/release-pack-smoke.mjs:46)
- [x] FIX: LOW: pipeline probe hardcodes /tmp instead of os.tmpdir(), ignoring TMPDIR and sharing one fixed path across checkouts/users (tests/mechanical-pipeline.test.ts:63)
- [x] FIX: MEDIUM: single-item list draft behind a paused goal strands the item — v0.38.53 batch fix not ported: willActivate is false for paused, resolveCarryover is restore-only, the item queues with
- [x] FIX: MEDIUM: list_add reports from stale pre-enqueue wasIdle with no n===0 guard — "0 item(s) added; the first is now active" on all-duplicate/persist-fail, and claims active when auto-activation
- [x] FIX: MEDIUM: list_activate runs the destructive conflict before suspicious-content screening — Replace archives the live goal, then activation can refuse on suspicious content and queue a repair 
- [x] FIX: LOW: batch conflict-replace archives before the zero-yield enqueue check — doubly-confirmed razor path (paused goal + live loop + replace + all-duplicate batch) loses the paused record and g
- [x] FIX: LOW: single-item list draft builds the queue item inline without parentObjective binding, so Subtask-of declarations silently insert flat while enqueueItems binds parentId/refuses (extension
- [x] FIX: LOW: single-draft Confirm note and terminal copy claim "waiting behind the active goal" / "activates when the current goal completes" when the holder is paused (extensions/loops/goal-tools.t
- [x] FIX: LOW: list_add reply claims items wait "behind the active goal" even when the holder is paused (extensions/loops/goal-tools.ts:2934)
- [x] FIX: LOW: list_activate description claims it aborts the active goal, but the code asks update/replace/cancel and aborts only on Replace (extensions/loops/goal-tools.ts:2944)
- [x] FIX: LOW: SKILL states the Confirm dialog is the activation gate unconditionally, omitting the autoAcceptDrafts opt-out that skips it (skills/glla-delegate/SKILL.md:18)
- [x] FIX: MEDIUM: README /list block omits the real add|import aliases and claims numbering matches /list output, but bare /list drafts since v0.38.51 and the viewer is /list show (README.md:155)
- [x] FIX: MEDIUM: continuation tool grant gives list_add/list_activate with no pasted-list wording rule and no list_activate selection guard, contradicting the skill consent posture by omission (promp
- [x] FIX: LOW: docs/INDEX claims INSTALL carries an auditor path-checked note that exists in neither INSTALL nor README (docs/INDEX.md:34)
- [x] FIX: LOW: SETTINGS.md Keys table omits the shipped subagentDisplayRichness setting (docs/SETTINGS.md:46)
- [x] FIX: LOW: subagentDisplayRichness missing from SETTINGS_KEYS, so the drift gate passes vacuously and per-key provenance never reports it (extensions/goal-settings.ts:608)
- [x] FIX: LOW: README claims rich is the default richness but code default and menu label both say quiet (2026-09-07 exceptions-only decision governs) (README.md:315)
- [x] FIX: LOW: goal-ui fallback ?? "rich" contradicts the quiet canonical default, so the effective default depends on code path (extensions/loops/goal-ui.ts:827)
- [x] FIX: LOW: goal-loop-draft intro says the user invoked /goal, but draftingTemplateFile serves the file verbatim for /list normal drafts too (prompts/goal-loop-draft.md:71)
- [x] FIX: LOW: docs/INDEX Active-focus bullet trails v0.38.25/v0.38.27/v0.38.28/v0.38.29 after v0.38.53, reading as if older releases came later (docs/INDEX.md:19)
- [x] FIX: LOW: continuation header comment still tagged v0.1.0 vs package 0.38.53 — a recurring-rot tag, not a one-time stale (prompts/goal-loop-continuation.md:1)
- [x] FIX: LOW: INSTALL version-nudge example pins v0.38.47/v0.38.48 and the /list inventory omits show/add/remove/clear/cancel with no post-v0.38.51 bare-/list note (INSTALL.md:34)
## Pass 2026-09-15 (goal: fresh audit pass; 3 parallel scouts: terminal-card, lifecycle, docs/packaging)
- [x] FIX: MEDIUM: persisted replay truncates the uncapped card — sidecar stores slice(0,60) lines x 1000 chars so idle-replay delivers a truncated card verbatim while live chat shows the full parity c
- [x] FIX: MEDIUM: buildFinalRepoStateLines runs 3 sequential sync git spawns with 5s timeouts on the approval path (up to ~15s event-loop block) and discards branch+HEAD+status entirely when any one s
- [x] FIX: LOW: git status --short output flows unbounded into the uncapped card — a huge dirty tree inflates the Final Repository State section with no cap (extensions/completion-summary.ts:477)
- [x] FIX: LOW: command-mode Audit row duplicates the counts text in Scope and Notes with Command "—": `| Audit | — | <body> | <status> | <body> |` (extensions/completion-summary.ts:571)
- [x] FIX: LOW: auditRowStatus counts total history entries, not matching verdicts — mixed approve+disapprove history renders APPROVED ×N with N including disapprovals, inherited by bannerVerdict (exte
- [x] FIX: LOW: testsRowStatus /pass/i substring false-positives on "bypass"/"password"/"passage" — only the fail-count branch is numeric-guarded (extensions/completion-summary.ts:319)
- [x] FIX: LOW: takeBudgetedGroups is dead in prod post-parity (zero callers in extensions/) and pinned only by two unit tests (extensions/completion-summary.ts:370)
- [x] FIX: LOW: stripCommitHashes is fully unreferenced (no callers in extensions/ or tests/) since parity retired hash-stripping (extensions/completion-summary.ts:408)
- [x] FIX: LOW: RICH_FINDINGS_CAP/RICH_VALUE_BUDGET/RICH_NEXT_CAP unreferenced (definitions only; RICH_EVIDENCE_TOKENS_PER_FINDING still live) and the legacy comment names absent consumers (extensions/
- [x] FIX: LOW: verificationLine always null with an unreachable compose branch, and composeRichTerminalLines opts.headline never reached (banner always non-null; all call sites pass no opts) (extensio
- [x] FIX: LOW: "effectively off / shares everything" parity comments overstate — objective echo (80), outcome (140), evidence tokens (4/finding), sanitize trust boundary (6 groups x 6 findings), and c
- [x] FIX: LOW: uncapped render tests bypass the sanitize trust boundary they claim to pin — raw 15-finding groups go straight into the renderers, never through sanitizeFindingGroups (tests/rich-termin
- [x] FIX: LOW: headless /glla display omits shipped contextCheckpointProjection though SETTINGS_KEYS, docs, menu, and editors all carry it — headless operators cannot see/provenance the flag (extensio
- [x] FIX: LOW: richness fallback comment says "rich (the default)" but code assigns "quiet" and the canonical default is quiet (docs scout independently confirmed the same line) (extensions/goal-setti
- [x] FIX: LOW: aggressiveMode docstring promises no-verdict recovery "inside its bounded 24-hour window" while the aggressive path passes unbounded=true to Infinity — pick one contract (conservative p
- [x] FIX: HIGH: continuation prompt still teaches ~200-char clause-boundary clipping ("rich sections budget ~200 chars per value") vs the shipped uncapped card — every future agent gets wrong guidance
- [x] FIX: MEDIUM: continuation prompt gate-table shape omits the repro Command column ("widens to Quality Gate | Scope | Status | Notes") (prompts/goal-loop-continuation.md:208)
- [x] FIX: LOW: continuation prompt "never machine paths" ban reads overbroad vs the parity card's chat-surface repro commands and Final Repository State — scope to log/tarball/tmp paths (prompts/goal-
- [x] FIX: MEDIUM: DESIGN-long-running-supervision still teaches the capped/clipped 4-col card ("Next, capped and clipped to fixed budgets", no banner/Command/Final State) (docs/DESIGN-long-running-sup
- [x] FIX: LOW: DESIGN-subagent-visibility ladder still reads as current rich-default with no at-line note of the 2026-09-07 quiet flip (docs/DESIGN-subagent-visibility.md:98)
- [x] FIX: LOW: release-contract required[] pins no docs//media files — a docs/SETTINGS.md or media/glla2.png drop ships green (tests/release-contract.test.ts:33)
- [x] FIX: LOW: release-pack-smoke required[] pins zero docs//media entries though files ships whole docs/, media/, examples/ dirs (scripts/release-pack-smoke.mjs:47)
- [x] DECIDED: 2026-09-15: keep the one-concrete-action Next rule (v0.38.39 Codex); parity language scoped to findings/values in 79e44dd — no behavior change, nothing to queue.
- [x] DECIDED: 2026-09-15: raise the trust boundary to 12 groups x 20 findings — implemented in 79e44dd, nothing left to queue.
## Fresh audit — 2026-09-16
- [x] FIX: HIGH: Bare /list collapses independently contracted records into the first objective's contract (extensions/goal-loop-core.ts:837).
- [x] FIX: MEDIUM: /list add splits paragraph and standalone Done when clause into separate items because any contracted line triggers batching (extensions/goal-loop-core.ts:837).
- [x] FIX: MEDIUM: Acknowledgment-prefixed compound tweak objectives are misclassified as chatter and replaced by unrelated context or refused (extensions/start-context.ts:317).
- [x] FIX: LOW: Paragraph routing documentation omits contract exceptions and pasted-list instructions also classify arbitrary multiline prose as a list (CHANGELOG.md:9; prompts/goal-loop-draft.md:76).
- [x] FIX: MEDIUM: Paragraph command regression checks notification only, not preservation of the actual seed; inferred-tweak consent rejection lacks behavioral coverage (tests/behavioral-orchestrator.
- [x] FIX: MEDIUM: Held-loop refine regression does not verify resumed dispatch/history or wrong-branch refusal (tests/behavioral-orchestrator.test.ts:1088).
- [x] FIX: MEDIUM: Structured-summary archive-token sanitizer uses unanchored greedy nonspace matching; a 100k plain token causes quadratic scanning and a reproducible default-timeout failure (extensio
- [x] FIX: HIGH: Starvation refuse gate is process-wide module state with no reset; the v0.35.4 behavioral test leaves a hot episode armed, which deterministically refuses every dispatch send in the ne
## Fresh audit — 2026-09-19
- [x] FIX: HIGH: rejected fresh-session recovery is reported as successful after newSession() returns or rejects asynchronously, leaving stale active work without a terminal/fail-closed path (extension
- [x] FIX: MEDIUM: hourly main-model recovery probes bypass supervisor pause, including an already-queued callback race (extensions/goal-recovery.ts:854-873,921-1007)
- [x] FIX: MEDIUM: stall and length continuation nudges omit stale-terminal and zombie-stand-down fences, allowing late events to trigger turns (extensions/goal-continuation.ts:1419-1434,1463-1474)
- [x] FIX: MEDIUM: rich terminal summaries can emit unsanitized ANSI/control bytes from details, findings, proofs, and git-derived repository state (extensions/completion-summary.ts:583-584,650-668,714
- [x] FIX: LOW: packed release smoke aliases peer imports to the source tree, masking consumer peer-resolution failures (scripts/release-pack-smoke.mjs:78-102)
- [x] FIX: LOW: packed release smoke checks launcher/worker tar-list presence but never loads or starts those shipped scripts (scripts/release-pack-smoke.mjs:46-76,104-119)
- [x] FIX: LOW: state-root consumer coverage relies on token presence rather than a live pending-root guard for the goal-session owner write (tests/state-root-consumers.test.ts:160-169)
## Priority field follow-up — 2026-09-23
- [x] FIX: HIGH: Pi 0.87's `session_compact_failed` lifecycle event was unhandled, leaving GLLA's 30-minute in-flight marker armed with no `session_compact` settle event and producing phantom busy/re-a
- [x] FIX: HIGH: after a failed context compaction GLLA did not fail closed: it either spun/queued impossible continuations or left an ACTIVE goal/loop at 98–101% context looking idle/working
## Fresh project audit — 2026-09-23 (v0.38.97)
- [x] FIX: HIGH: active branch-mode loops could add/commit/reset on a branch the user or another process had switched to
- [x] FIX: HIGH: branch-mode terminal Git treated failed status/add/commit/reset/checkout as success, so finish could erase the pending iteration or falsely report branch restoration
- [x] FIX: HIGH: `session_compact_failed` was not consumed, leaving the in-flight marker armed and active work stranded
- [x] FIX: MEDIUM: loop send cleared audit-reprieve, hypothesis, and refine directives before dispatch acceptance, losing one-shot guidance on a transient failure
- [x] FIX: HIGH: context-free stale-auditor parking ignored persistence failure and heartbeat announced the claim safe while restart still read `auditing`
- [x] FIX: HIGH: task-list proposal persistence failure could still consume a repair source and report success
- [x] FIX: MEDIUM: repair promotion wrote a tail-ordered repair first, then attempted a non-atomic RAM-only head promotion; reload could demote it or lose repairTarget
- [x] FIX: MEDIUM: `list_activate` resolved visible positions before hydrating disk-only queue state
- [x] FIX: MEDIUM: failed parent-sidecar deletion during last-child completion still auto-advanced and could reinterpret the parent as ordinary work
- [x] FIX: MEDIUM: repair replan changed the goal contract without bumping `revision`, allowing an older same-revision approval to satisfy the new contract
- [x] FIX: MEDIUM: a failed repair-source sidecar deletion detached `repairTarget` from the still-queued source
- [x] FIX: MEDIUM: confirmed loop refinement mutated RAM before a non-atomic spec write, so failure could report a partial durable refinement
- [x] FIX: MEDIUM: loop draft/refine preflight accepted numeric stdout from a nonzero command
- [x] FIX: MEDIUM: `/loop audit` target and measure used cwd-relative findings while open-finding accounting used the selected state root
- [x] FIX: MEDIUM: a missing/corrupt drafting prompt threw after `draftingTarget` was armed, orphaning the drafting gate
- [x] FIX: MEDIUM: stale read-only `/list show` and `/list settings` wrote shared ledger events; `/glla bug` created a cwd fallback while sessionDir was pending
- [x] FIX: MEDIUM: provider audit/display projections, transcript role labels, recent-hang labels, and loop measure text allowed terminal control bytes
- [x] FIX: MEDIUM: malformed `forbiddenModels` crashed settings rendering, while provenance displayed rejected raw junk instead of effective normalized values
- [x] FIX: LOW: hand-edited `forbiddenModels` wrong types were not normalized and task-level `verificationContract` was absent from the published schema
- [x] FIX: MEDIUM: vision fallback command interpolated untrusted image/question text into shell syntax
- [x] FIX: HIGH: managed subagent settings/sync-state names could traverse outside `agents/` and unlink or overwrite a marked file
- [x] FIX: HIGH: detached auditor inherited unrelated host secrets into its bash-capable process
- [x] FIX: LOW: auditor crash before worker lock rewrite accumulated permanent ambiguous directories
- [x] FIX: MEDIUM: pitfall registry ignored the configured state root and could inject stale cwd content
- [x] FIX: LOW: Unicode clause-bound shortening mixed UTF-16 and code-point indices around emoji
- [x] FIX: LOW: continuation prompt instructed `bg_wait` while omitting it from the available-tool grant
- [x] FIX: MEDIUM: whitespace-only goal drafts could be confirmed/auto-accepted as empty active goals
- [x] FIX: MEDIUM: task-list Confirm omitted command-bearing milestone verification contracts, so later completion executed undisclosed commands
- [x] FIX: MEDIUM: confirmed goal replacement could archive a carryover predecessor before discovering the successor transaction could not be written
- [x] FIX: MEDIUM: INSTALL called Bun optional although every test/release script requires it, and promised an always-visible version on idle sessions
- [x] FIX: LOW: shipped examples/PLAN used pre-current bare `/list` and historical `.pi-gla` paths/backoff claims
- [x] FIX: LOW: `tests/goal.schema.test.ts` was a second hand-written shape model that rejected valid list policy and never read the published schema
### Audit evidence clarification
## Fresh project audit — 2026-09-25 (v0.38.100)
- [x] FIX: HIGH: in-flight loop tick vetoes `/loop stop` and `/glla wipe` branch restoration, stranding the user on the scratch branch (extensions/goal-loop.ts:343)
- [x] FIX: MEDIUM: archive banner claims a review was recorded when none exists — lowercase `no review` from error entries hits the `completion review recorded` fall-through (extensions/completion-summ
- [x] FIX: MEDIUM: `Verdict:`/`Audit:`-prefixed findings vanish from terminal card AND durable archive; group-embedded `Tests:` strings vanish from the archive (extensions/completion-summary.ts:760)
- [x] FIX: MEDIUM: result-time telemetry counters miss `name`-shaped tool_result events while the call-time path recorder handles both shapes, so `fileWrites` and `telemetry.files` contradict (extensio
- [x] FIX: MEDIUM: `decisionPauseBudget` is enforced and documented but invisible on every operator surface — missing from SETTINGS_KEYS, provenance, headless list, and menu (extensions/goal-settings.t
- [x] FIX: LOW: `stranded_audit_recovered` is ledgered before the persistence check it depends on, overstating recovery in post-mortem reads (extensions/goal-heartbeat.ts:1197)
- [x] FIX: LOW: durable post-compact debt discharge ignores persist failure at three sites while the arm path reverts, so a failed append resurrects debt on restart (extensions/goal-heartbeat.ts:1359)
- [x] FIX: LOW: detached audit prompt embeds the full change set uncapped (up to 100 paths) while the recap path caps at 20 (extensions/goal-loop-auditor.ts:213)
- [x] FIX: LOW: wall-feature revert left dead `Auditor exceeded` classification branches at four recovery sites plus the timeout predicate (extensions/loops/goal-auditor-hooks.ts:745)
- [x] FIX: LOW: settlement ordering guards are constant-folded dead code obscuring the live gate (extensions/loops/goal-tools.ts:1528)
- [x] FIX: LOW: transcript role label uses surrogate-unsafe `.slice(0, 40)` on untrusted child text (extensions/goal-agents-panel.ts:409)
- [x] FIX: LOW: tests/README claims schema validation is lightweight without Ajv, but the test compiles the schema with Ajv (tests/README.md:25)
- [x] FIX: LOW: smoke.sh requirements header omits python3 though cleanup and every ledger assertion run through it (scripts/smoke.sh:9)
## Field follow-up — 2026-09-26 (user screenshots, endless-td session)
- [x] FIX: MEDIUM: `complete_goal` rejects over-long `leftOut` at the schema boundary instead of clipping — `leftOut: Type.String({ maxLength: 500 })` (extensions/loops/goal-tools.ts:576) makes Pi refu
## Fresh project audit — 2026-09-28 (v0.38.103, branch main)
### FIX findings (2026-09-28 pass)
- [x] FIX: HIGH: `/loop stop` and `/loop finish` destroy the in-flight iteration's uncommitted scratch-branch work — both call `finishLoopGit` directly (extensions/goal-loop.ts:1390, :1460) and its unc
- [x] FIX: MEDIUM: `runMeasure` fails OPEN when the exec result carries no numeric `code`/`exitCode` (defaults to 0) while its sibling `runGit` fails closed (defaults to 1) (extensions/goal-loop.ts:304
- [x] FIX: MEDIUM: `mainModelFailureDelayMs` returns the 5 s eager quantum for attempt 1 BEFORE the upstream reset-hint check its own comment says must come first ("Checked BEFORE the eager rule, never
- [x] FIX: MEDIUM: `retryContinuationDispatch` mutates the live `pendingContinuationDispatch` record in RAM (`retryCount`/`retrySentAt`/`timeoutMs`) and discards `persistDispatchRecord`'s boolean (exte
- [x] FIX: LOW: `observedSubagentRpcBuses` is add-only for the life of the process (extensions/goal-heartbeat.ts:681, :691-692) — `releaseSubagentRpcHost` deletes only the ready-protocol map entry (ext
- [x] FIX: LOW: the detached auditor worker records EVERY `challenge:false` dispatch as "skipped: light-tier audit" (scripts/goal-auditor-worker.mjs:1104-1105) although the parent sends that same flag 
- [x] FIX: LOW: an audit job dir holding a finished `result.json` but a `role:"parent"` lock whose PID is now alive (reused) classifies `ambiguous` (extensions/goal-loop-auditor-process.ts:1104-1112) a
- [x] FIX: MEDIUM: `mainModelRetryMinutes` and `auditFeedbackChars` are the only numeric policy knobs with no guard in `normalizeLoadedSettings` (extensions/goal-settings.ts:448-643 guards its siblings
- [x] FIX: LOW: `drafterThinkingLevel` / `auditorThinkingLevel` are unvalidated while the sibling `subagentThinkingOverrides` map is pruned against the same ladder (extensions/goal-settings.ts:465-472)
- [x] FIX: LOW: `objectiveExcerpt` / `stopReasonExcerpt` still cut UTF-16 code units on untrusted goal text (extensions/completion-summary.ts:1276-1278, :1281-1283) although the module's own `clipSumma
- [x] FIX: LOW: `summarizeToolArg` truncates a provider/child-controlled tool argument by code units in the live widget card (extensions/loops/goal-ui.ts:637) although the sibling panel routes through 
- [x] FIX: MEDIUM: `complete_goal`'s `newObjective` path discards `updateGoal`'s `false` (extensions/loops/goal-tools.ts:748) and pre-bumps the in-memory revision (:743) — an unwritable `.pi-glla` stil
- [x] FIX: LOW: `list_activate` types `n` as `Type.Number` (extensions/loops/goal-tools.ts:3764) while its own error text tells the agent to pass `"1.1"` (:3781) and the position grammar accepts a dott
### Coverage and honesty notes for this pass
### Final-gate follow-up — pre-existing red suite (2026-09-28)
- [x] FIX: MEDIUM: `tests/context-growth-measurement.test.ts` re-baselined its payload constants to 24_221 chars in the same commit that slimmed the continuation prompt, and was never re-run — the cons
- [x] FIX: LOW: `tests/completion-communication.test.ts` still asserted the pre-v0.38.102 one-line `- **outcome** — evidence` bullet after the gist/evidence split landed, so the grouped-render test was
- [x] FIX: LOW: `tests/stale-delayed-context.test.ts` pinned the tick-local `commitPendingTerminalWork` closure this pass hoisted, so the v0.34.20 rebind contract test could never pass again
- [x] FIX: LOW: three recovery tests pinned "the first retry is always eager", the rule the v0.38.105 reset-hint ordering deliberately replaced (tests/quota-sleep-until-reset.test.ts, tests/model-selec
## Cross-project stuck-at-last-part pass (2026-09-28) — the detached hard cap
- [x] FIX: HIGH: the disapproval hard cap (v0.38.103) was wired only into `complete_goal`'s INLINE settlement, which the field never takes — every real audit settles through the detached driver `retryS
# Full-project audit pass — 2026-09-28 (v0.38.108, branch main)
## FIX findings (2026-09-28 pass, 9 findings: 1 HIGH, 5 MEDIUM, 3 LOW)
- [x] FIX: HIGH: the approval branch of `retryStoredCompletionAudit` calls `settleApprovedCompletion` with NO `return` (extensions/loops/goal-auditor-hooks.ts:1875) — every clean approval through the s
- [x] FIX: MEDIUM: `/goal verify` wrote its manual claim BEFORE calling `resumeStoredCompletionOrSettlement` (extensions/goal-commands.ts:256-267), and the overwrite drops `phase` / `verdictAt` / `atte
- [x] FIX: MEDIUM: the branch-changed loop park named a resume command that could never resume, on the wrong surface (extensions/goal-loop.ts:357-367) — `parkLoopOnWrongBranch` promised `activeGoalSurf
- [x] FIX: MEDIUM: the test runner's documented "orphan-free" guarantee was a no-op (scripts/run-tests.mjs:98,117,121) — the suite child was spawned WITHOUT `detached: true`, so it stayed in the wrappe
- [x] FIX: MEDIUM: `docs/SETTINGS.md` appended "Global-only." to `auditCapHard` and `mechanicalLoadScale`, but neither is in the 18-entry `GLOBAL_ONLY_KEYS` — `loadSettings` only strips the real set fr
- [x] FIX: MEDIUM: `CHANGELOG.md` had no `## Unreleased` section while five untagged milestones (v0.38.104 onward, including the detached hard cap) were already stamped across `extensions/` and `script
- [x] FIX: LOW: the settings menu promised a recovery ceiling the default configuration removes (extensions/settings-menu.ts:295) — the `mainModelRetryMinutes` row said "automatic recovery stops after 
- [x] FIX: LOW: two test-harness surfaces reported coverage that did not exist — `tests/subagent-stop-rpc.integration.test.mjs` gated itself on `node_modules/@tintinweb/pi-subagents`, which nothing ins
- [x] FIX: LOW: dead code in the auditor model path — `const settings2 = undefined;` (extensions/loops/goal-settings-ui.ts:621) was a leftover from a half-applied rename that read as a second settings 
## Retracted / not-a-finding (recorded so a later pass does not re-raise them)
## DECIDE findings
## Coverage and honesty notes for this pass
## Corrections to the 2026-09-28 pass record (independent reviewer rehearsal)
## Fresh parallel audit — 2026-10-07
- [x] FIX: MEDIUM: task milestone verification can overwrite a replacement goal or changed task list after awaiting verification (extensions/loops/goal-tools.ts:3061-3185)
- [x] FIX: MEDIUM: owner takeover recursively retries a persistent live-owner signal failure without a bound (extensions/state-root-owner.ts:357-362)
- [x] FIX: MEDIUM: reviewer extraction drops Outside Scope section boundaries and auto-queues excluded findings (extensions/reviewer.ts:197-210)
- [x] FIX: MEDIUM: reviewer reports requested enqueue counts instead of actual queue admissions (extensions/reviewer.ts:408-470)
- [x] FIX: HIGH: continuation self-healing clears the settled dispatch it requires and cannot recover parked loops through goal-only scheduling (extensions/goal-continuation.ts:796-910)
### Verification correction — 2026-10-07
### Final known-state evidence — 2026-10-07
### Auditor challenge repair — 2026-10-07
- [x] FIX: HIGH: reviewer text-only deduplication lets an outside-scope finding suppress an identically worded local finding, changing local queue admission with source order (extensions/reviewer.ts:21
## Fresh parallel audit — 2026-10-08
- [x] FIX: HIGH: updateGoal/setGoal return true even when persistState fails, so the complete_goal newObjective durability gate cannot catch ledger failure (extensions/loops/goal-orchestrator.ts:1002)
- [x] FIX: MEDIUM: ContinuationDeps declares persistState/updateGoal as void, blinding ~10 dispatch/park call sites to persistence failure (extensions/goal-continuation.ts:145)
- [x] FIX: MEDIUM: guard/archive-fence paths mutate live state plus unchecked persist outside the goal-state transaction, risking memory/disk divergence (extensions/goal-continuation.ts:1184)
- [x] FIX: LOW: replan one-shot latch ledgers armed even when the replanPromptedAt write failed (extensions/goal-continuation.ts:615)
- [x] FIX: LOW: complete_goal claim/pendingTasks write ignores the updateGoal result while abort/confirm paths check it (extensions/loops/goal-tools.ts:996)
- [x] FIX: LOW: stall/storm park paths notify before proving persistence, telling the user work is parked on degraded storage (extensions/loops/goal-orchestrator.ts:397)
- [x] FIX: LOW: message_start user-liveness clears the pressure attempt with a durable budget reset before any healthy turn proves recovery (extensions/loops/goal-activation.ts:1536)
- [x] FIX: LOW: late session_compact success arriving after the pressure timeout-hold is swallowed with no distinct ledger line, hiding late-landing compactions (extensions/context-pressure-attempt.ts:
- [x] FIX: LOW: respec prompts ride no ship-gate — smoke required list and release-contract test omit two runtime-loaded prompts, so a files[] narrowing would pass the gate and break /loop respec (scri
- [x] FIX: LOW: dead 0-byte test-failure-diagnostics plaintext artifact litters tests/ (tests/test-failure-diagnostics.test.ts.plaintext:1)
- [x] FIX: LOW: generated inventory baseline parenthetical is stale next to the regenerated count (docs/RUNTIME-INVENTORY.md:1)
- [x] DECIDED: route test:changed through scripts/run-tests.mjs for stall/orphan protection (2026-10-08)
- [x] DECIDED: keep the documented one-shot boundary-compaction hysteresis until usage halves (2026-10-08)
## Fresh project audit pass — 2026-10-10 (0.39.24)
- [x] FIX: MEDIUM: Fleet terminal output prints arbitrary saved pauseSuggestedAction, exposing private prerequisite text despite its no-journal-text privacy contract (extensions/fleet-health.ts:198).
- [x] FIX: MEDIUM: Narrow shared footer clips required recovery commands after secondary workflow/queue/recovery context, losing executable actions (extensions/goal-loop-display.ts:1426-1443).
- [x] FIX: MEDIUM: Delayed recovery model selection does not recheck supervisor/load holds after setModel resolves; it releases paused work and announces a probe during an explicit hold, though downstr
## Fresh project audit pass — 2026-10-11 (0.39.26)
- [x] FIX: MEDIUM: Pressure attempt in `queued` phase double-recovers on session_compact_failed — settlePressureAttempt returns false for queued attempts (extensions/context-pressure-attempt.ts:121), s
- [x] FIX: LOW: sendContinuation silently drops with no ledger when the extension API is missing or stale (extensions/goal-continuation.ts:1599), unlike the starved-refuse path which ledgers — the drop
- [x] FIX: LOW: Continuation self-heal exhaustion notifies via the stale captured ctx unwrapped (extensions/goal-continuation.ts:917-918) instead of the fresh live ctx used by the ledger lines around i
- [x] FIX: LOW: Bare __dirname under "type": "module" (extensions/goal-compactor.ts:518, extensions/prompt-layers.ts:39) while siblings use fileURLToPath(import.meta.url) — works only if the loader shi
- [x] FIX: LOW: Stale v0.1.0 extensions/loops/goal.ts file headers on three decomposed modules misstate module identity for maintainers (extensions/loops/goal-orchestrator.ts:1, extensions/loops/goal-t
- [x] FIX: LOW: fleet-health boundsFor silently clamps caller bounds down to defaults with no issue entry (extensions/fleet-health.ts:31) — a future caller raising maxMs/limits gets silently ignored an
- [x] FIX: LOW: Audit observation built with observedAt epoch fallback poisons host freshness to unconfirmed (extensions/loops/goal-ui.ts:812, extensions/ui-status-runtime.ts:56) — a progress object wi
- [x] FIX: LOW: No grep guard locks the in-place state-ownership invariant — goal-state.ts owns the object while goal-orchestrator.ts mutates it, so a future `state = …` outside goal-state.ts reintrodu
## Fresh post-release audit — 2026-10-11 (0.39.27)
- [x] FIX: MEDIUM: Failure parking and delayed probes both consume same-model and episode counters, admitting fallback after five actual retries with a configured budget of ten (extensions/goal-recover
- [x] FIX: MEDIUM: pause_goal ignores failed updateGoal admission, reports a successful pause and aborts while durable/live goal remains active (extensions/loops/goal-tools.ts:2754).
- [x] FIX: MEDIUM: Fleet reader accepts arbitrary builder.phase and formatter prints it unsanitized, leaking private journal text and terminal controls from malformed snapshots (extensions/fleet-health
# Fresh audit pass — 2026-10-17 (v0.39.35, branch main)
## FIX findings (2026-10-17 pass)
- [x] FIX: MEDIUM: Resumable loops vanish from always-on UI — heldLoop only surfaces restore/provider holds while RESUMABLE_STOP promises resume for plateau/stuck/stalled/bound/metric-never-moved/zero-
- [x] FIX: MEDIUM: dispatchAccepted returns success on record mismatch, conflating sync-ack clears with genuine wrong-record races and ledgering sends that never proved delivery (extensions/goal-contin
- [x] FIX: LOW: dispatchStartAcknowledged ignores sidecar persist failure, leaving an accepted-but-expired record a restart misreads as stuck dispatch (extensions/goal-continuation.ts)
- [x] FIX: LOW: One-shot loop directives cleared without a state write, so a crash replays reprieve/hint prompts on the next turn (extensions/goal-loop.ts)
- [x] FIX: LOW: recovery_notice_delivered ledgered even when its updateGoal persist fails, re-injecting the stale recovered directive it claims to fix (extensions/goal-continuation.ts)
- [x] FIX: LOW: validateTaskProposal throws TypeError on non-string titles instead of returning the clean validation string the subtask path uses (extensions/goal-loop-core.ts)
- [x] FIX: LOW: Dead replacement field on matchItemNumberedLine misleads consent-target plumbing; callers use only line (extensions/goal-loop-core.ts)
- [x] FIX: LOW: auditEvidenceFingerprint equality is length-only, so a same-length different report on the same attempt+revision skips the full brief (extensions/goal-continuation.ts)
- [x] FIX: HIGH: Stale-session resume releases cold-restore auditor suppression before refusal, unhiding prior auditor feedback the gate was meant to keep hidden until consent (extensions/loops/goal-to
- [x] FIX: MEDIUM: Auditor surface gate is process-global not per-goal/per-session, so one cold restore suppresses and any resume releases for all co-resident sessions (extensions/loops/goal-auditor-su
- [x] FIX: MEDIUM: Worker tool-timeout ceiling not enforced — Math.max floor with no Math.min cap lets huge env values defeat bounded verification and stall brakes (scripts/goal-auditor-worker.mjs:414)
- [x] FIX: MEDIUM: Process-group containment is Linux-only, so the fork-bomb/recursive-helper fence never fires on macOS/Windows (scripts/goal-auditor-worker.mjs:868)
- [x] FIX: MEDIUM: Auditor extension allowlist check is shape-only then passed verbatim to pi --extension, widening the read/grep/find/ls/bash sandbox to arbitrary specs (scripts/goal-auditor-worker.mj
- [x] FIX: MEDIUM: Worker inherits full process.env into the auditor child and env can redirect the auditor binary, leaking host secrets if the parent fence ever regresses (scripts/goal-auditor-worker.
- [x] FIX: LOW: Duplicate tool start with same id silently overwrites the open start, losing first args/startedAt instead of recording unmatched (extensions/goal-loop-auditor.ts)
- [x] FIX: LOW: escapeXmlText leaves newlines/quotes in changed-file entries, letting a crafted path break the evidence block shape the shield parses (extensions/goal-loop-auditor.ts)
- [x] FIX: LOW: Stale module headers document four top-level commands and a legacy in-process auditor path after decomposition moved the surface (extensions/loops/goal-orchestrator.ts:11)
- [x] FIX: HIGH: docs/SETTINGS.md decisionPauseBudget row describes the opposite behavior from code — docs say proceed WITHOUT the suggestion, code ADOPTS the recommended option as a logged assumption 
- [x] FIX: HIGH: docs/DESIGN.md auditor-isolation section omits default-ON auditorMirrorSessionExtensions, contradicting the shipped threat model the section states (docs/DESIGN.md:439)
- [x] FIX: MEDIUM: Aggressive-mode editor title over-claims autoResume as ON by default while the setting remains separate explicit consent (extensions/loops/goal-settings-ui.ts:1201)
- [x] FIX: MEDIUM: docs/SETTINGS.md Global-only paragraph omits mainModelSameModelRetries though it is in GLOBAL_ONLY_KEYS and its own row says Global-only (docs/SETTINGS.md)
- [x] FIX: MEDIUM: examples/example-objective.md Loop 1 step 3 describes a no-extension read-only auditor, stale on mirror default-ON and bounded bash verifier tool (examples/example-objective.md)
- [x] FIX: LOW: Stale section counts claim 8 settings sections after Compactor made 9 (extensions/settings-menu.ts:8)
- [x] FIX: LOW: stuckMaxInterventions editor rejects 0 while file-loaded 0 is accepted with undocumented runtime meaning (extensions/loops/goal-settings-ui.ts:1944)
- [x] FIX: MEDIUM: pi-subagents pinned as "*" so any npm install can silently pull a new major and churn the lock under the sync daemon (package.json:85)
- [x] FIX: MEDIUM: No upload-artifact step in publish.yml, so promised failure diagnostics in $TMPDIR are unrecoverable when CI discards the runner (.github/workflows/publish.yml)
- [x] FIX: LOW: test:all executes tests/repro-jiti-state-split.test.mjs twice via bun discovery and an explicit node rerun, wasting gate minutes and risking conflicting results (package.json:66)
- [x] FIX: LOW: Three 0-byte dead files shadow live tests and invite editing the wrong file (tests/infrastructure-retry.test.ts.plaintext)
- [x] FIX: LOW: --changed space form misclassified as explicit path, yielding bunArgs with --changed plus a bare ref instead of a filter (scripts/run-tests.mjs:52)
- [x] FIX: LOW: npm pack --json shape parsed twice differently between smoke and release-contract, so a shape difference greens one lane and reds the other (scripts/release-pack-smoke.mjs)
- [x] FIX: LOW: generate-inventory crashes with bare TypeError if the global-names marker is renamed, and its audit-baseline count text decays silently (scripts/generate-inventory.mjs:33)
- [x] DECIDED: Unacknowledged-dispatch restore — verify whether the existing restore path reconciles it; add regression coverage and repair a confirmed gap rather than unconditionally adding a new park (ex
- [x] DECIDED: Contract-amendment command selection — keep last-wins with explicit Accept and snapshot-bound matching; no exactly-one-backtick restriction chosen (extensions/goal-loop-core.ts; 2026-10-17).
- [x] DECIDED: Goal schema — treat goal.schema.json as documentation-only; do not introduce global writer-side schema enforcement or remove existing runtime validation/guards (schemas/goal.schema.json; 202
- [x] DECIDED: Auditor --tools/--extension trust — verify the claim against Pi core first and repair the GLLA-owned boundary only if that verification finds a gap; no unconditional removal/default-empty ch
- [x] DECIDED: Legacy quota-waiting phase — verify and test the current loader migration first; repair a demonstrated gap rather than introducing duplicate normalization (schemas/goal.schema.json; 2026-10-
- [x] DECIDED: subagentFallbacks provenance — implement per-role source attribution with nested provenance tracking and tests rather than merely documenting whole-map labels (extensions/settings-menu.ts; 2
- [x] DECIDED: Forbidden-model policy placement — move the shared policy rows to Main-agent and update navigation/row-order tests (extensions/settings-menu.ts; 2026-10-17).
- [x] DECIDED: CI push churn — cancel superseded push-quality runs while protecting active release publication; retain validation of the newest pushed state. Correction: GitHub concurrency allows one runni
- [x] DECIDED: Packed-worker smoke isolation — use a disposable probe working directory instead of the live checkout; adapt fixture paths while retaining the actual packed-worker protocol/challenge checks 
- [x] FIX: HIGH: automatic zero-stream retries replayed the wedged model route, stranding completed project work (field screenshot 20261017_163203, hellhunter increment 3): ledger showed 3 abort/retry 
- [x] FIX: LOW (audit Gap 1, 2026-10-18): zombieRetryRoutedViaFallback survived into fresh episodes, falsely reporting "routed via the fallback model" on same-route retries and "(later attempts reroute
- [x] FIX: LOW (audit Gap 2, 2026-10-18): missing-permission fence had zero behavioral evidence. Added test 11 (pause_goal missing-permission interruption parks with the permission reason, interruption
- [x] FIX: per-role subagentFallbacks provenance (goal 20261018012308, chosen 2026-10-17): shallow mergeSettings let any project map shadow ALL global roles while every row carried the whole-map source
- [x] FIX: (audit falsification round, goal 20261018012308): per-role merge normalized AFTER spreading, so a dead project entry (worker:[], whitespace/`unset` junk) shadowed the live global role while 
## Fresh audit pass — 2026-10-19 (goal 20261019090658-b5sem2)
- [x] FIX: MEDIUM: Carryover clear consumes its decision and acknowledges queue removal despite final journal snapshot refusal, allowing cleared items to return after restart (extensions/loops/goal-ses
- [x] FIX: MEDIUM: resume_goal ignores updateGoal refusal and reports active continuation, releases auditor feedback and may retry a stored claim despite incomplete durable resume (extensions/loops/goa
## Fresh project audit pass — 2026-10-19 (v0.39.40, branch main)
- [x] FIX: MEDIUM: a refused `resume_goal` still spent the cold-load consent gate — the tool cleared `loadHoldAt` in RAM, journalled `load_hold_released {via:"agent-resume"}` and notified "Load hold re
- [x] FIX: HIGH (closed, behaviour already fixed): stale-session resume releases cold-restore auditor suppression before refusal — see the 2026-10-17 entry above. The behaviour was already fixed in the
## Scout findings from the 2026-10-19 pass
- [x] FIX: HIGH: the published goal schema declared `pendingCompletion.leftOut` as an ARRAY while the runtime writes a STRING (extensions/goal-loop-core.ts `PendingCompletion.leftOut?: string`, written
- [x] FIX: HIGH: the audit-rework projection discarded the whole Required-fixes section when any line merely MENTIONED the `<evidence` tag — the filter matched the substring anywhere, so one prose sent
- [x] FIX: MEDIUM: the compact rejection card's `agent:` field lost its wrapped continuation silently under a truncated widget height — the omission marker covered next/why/resume/candidate but not the
- [x] FIX: MEDIUM: the schema/runtime TYPE parity was only checked for one field — the published schema is permissive, so a field the schema DESCRIBES with the wrong type is a contract no real goal fil
- [x] FIX: MEDIUM: the shipped docs contradicted the code in four places — the README settings table listed eight sections where the menu ships nine (Designer missing), docs/ARCHITECTURE.md said "12 sl
- [x] FIX: MEDIUM: docs/RUNTIME-INVENTORY.md was stale on every count it published, so the documented release gate `npm run release:check` failed at the inventory step. Regenerated with `node scripts/g
- [?] DECIDE: LOW: the compact card labels a goal whose turn is QUEUED but not yet started as "working", while its `you:` line claims "no action needed; agent owns rework". The rework's rule is that an un
- [?] DECIDE: LOW: the `leftOut` schema correction changes the published contract for a field the runtime has always written as a string. Consumers that validated `leftOut` against the shipped schema as a
### Not covered by this pass (deferred)
## Docs review pass — 2026-10-19 (v0.39.40, branch main)
- [x] FIX: MEDIUM: `mainModelSameModelRetries` was missing from `SETTINGS_KEYS` — it is a real global-only setting (declared at extensions/goal-settings.ts:133, listed in GLOBAL_ONLY_KEYS at :376, defa
- [x] FIX: MEDIUM: LIST-PHILOSOPHY.md:63-68 claimed the Reviewer "fires a regression-scan audit on clean completions" unconditionally, but the default cascade at extensions/reviewer.ts:43 omits `fire-a
- [x] FIX: MEDIUM: docs/INDEX.md did not link two CURRENT shipped docs (docs/DESIGN-work-lifecycle.md, docs/UI-STATUS.md) nor the shipped PLAN.md — the index is the only map a reader of the published p
- [x] FIX: LOW: docs/INDEX.md:36-37 said the CHANGELOG "records the release history from v0.35.14–v0.39.39", but CHANGELOG.md holds 196 release headings running from `## [0.1.0-alpha.1] — 2026-07-19` t
- [x] FIX: LOW: prompts/goal-loop-continuation.md:91 and the shipped auditor prompt at extensions/goal-loop-auditor.ts:203 named `stop_reason="length"` — a field that exists in neither Pi (`stopReason:
- [x] FIX: LOW: docs/COMPATIBILITY.md:11-12 called the pi-subagents development entry "a versionless manifest entry", but package.json carries `"pi-subagents": ">=0.74.0 <1.0.0"` — changed from the exa
- [x] FIX: LOW: the README's `/glla` "Common actions" table (README.md:299-318) never mentioned `/glla reviewer`, which still opens the same post-completion audit menu as `/glla postaudit` (extensions/
- [x] FIX: LOW: note.md read like a document of record — 62 source citations across 22 files with nothing saying what the file was, while the citations point at content since consumed into the shipped 
- [x] FIX: LOW: docs/DESIGN.md:511 named `runGoalCompletionAuditor` — a function that was SUPERSEDED AND REMOVED (audit/GUIDANCE-LITERALS-AND-DEAD-CODE-2026-08-08.md:49: "superseded by runDetachedGoalC
- [x] FIX: LOW: docs/DESIGN.md:417 spelled the token-guard setting `tokenlimit`; the key is `tokenLimit` (extensions/goal-settings.ts:231, validated at :705-706). A reader who typed the misspelling int
- [x] FIX: LOW: docs/DESIGN.md:493 named a structured `goal_questionnaire` widget that never shipped — no such identifier exists in extensions/ or schemas/. The canned questionnaire it describes was re
### Coverage and honesty notes for this pass

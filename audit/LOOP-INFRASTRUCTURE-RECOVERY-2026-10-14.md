# Loop infrastructure recovery — 2026-10-14

## Objective and ownership

Confirmed objective: automatic paced recovery from every infrastructure error,
including auth/config, across all loop lifecycles without a count cutoff.
Explicit stop/pause/freeze, bounds, persistence and reload consent remain
independent authority. The implemented slice covers admitted project, metric and audit-loop
infrastructure recovery; admission and independent stop authority remain separate. No credentials, providers, Pi core, other plugins,
release metadata, branches, identities or history were changed.

The supplied watchdog incident is GLLA-owned at the recovery boundary: the
worker correctly cancelled a stalled auditor, but
`extensions/respec-builder-runtime.ts` converted both `result.error` and local
exceptions to `active=false`, requiring manual resume. The claim/requirements
remained unfinished, but no durable due date could restart supervision.
External provider behavior is observed/contained, not repaired here.

## Implemented slice

- `extensions/infrastructure-retry.ts`: small typed pure scope-bound envelope;
  failures are diagnostic, saturating at 1,000,000, never an admission limit.
  Pacing starts at 5s and caps at 5m. Failure classes include auth/config.
  Sanitizer removes unknown fields, rejects foreign scope/invalid deadlines;
  the envelope contains no provider objects, credentials or raw error strings.
- Project claim persists that envelope; `readState` sanitizes it on reload.
- One transactional adapter handles infrastructure results/no-verdict and
  exceptions. Failure retains active supervision, claim, requirement/task
  status, revision, productive iteration/history and bounds. Failed commits
  roll RAM back; cursor-persistence refusal prevents a new dispatch.
- Candidate walking is still a finite episode, unchanged at process level.
  Cursor is retained while waiting; only the next due/admitted, journaled
  episode clears it and re-resolves current settings/models.
- Existing loop/session timer remains the sole timer owner. Due gates protect
  scheduler and real runtime entry, including urgent/agent_end wakes. Timer
  callback fences exact handle, cwd, loop identity and claim; existing session
  timeout generation fences remain authoritative. Latch is released before
  recovery wake. Durable waits are not falsely counted as lost main turns.
- Restore uses existing consent; legacy automatic `audit infrastructure:`
  parks migrate only with admission. User holds and bounds are not migrated.
  Restore/resume persistence succeeds before arming; no saved deadline grants
  cold-load consent.
- Saved approval lookup remains before worker execution. Archive/outbox repair
  retries settlement from saved evidence. Infrastructure never verifies a
  requirement or creates semantic needs-work history.
- Status/widget show durable no-verdict, unresolved class/count and retry due
  time without asserting a live worker. `docs/RECOVERY.md` states slice limits.

## Evidence

Validation commands (all bounded, global settings redirected before preload):

1. `npm run check` — PASS (`tsc --noEmit`).
2. `GLLA_GLOBAL_SETTINGS_PATH=$(mktemp /tmp/glla-project-tests.XXXXXX) npm test -- tests/infrastructure-retry.test.ts tests/respec-builder-audit-runtime.test.ts tests/respec-builder.test.ts tests/recovery-restore-after-restart.test.ts tests/heartbeat.test.ts`
   — PASS, **62 tests / 5 files / 0 failures**, approximately 13 seconds.
   Captured output: `/tmp/glla-project-test-final.log` (ephemeral local evidence).

Runtime evidence uses the actual project adapter, MockPi, real temp journals,
real protocol-speaking local Node workers and injected existing timer/clock
seams; no provider calls. The stress test drives **2105 consecutive
infrastructure failure → due admitted next-episode cycles**, alternating
credentials/configuration/throw failures, reloading journal checkpoints,
checking early duplicate wakes, preserved work/accounting and capped pacing,
then recovers through one real worker approval. It is not 2105 provider workers
or 2105 separately approved projects. Additional real workers prove finite
chain exhaustion over two episodes and fresh-candidate recovery, and stalled
workers prove paced timeout recovery with owned scratch cleanup.

Coverage also includes due/overdue restore, no-consent cold load, legacy hold
admission, user stop, same-callback single dispatch, superseding claim and
shutdown callback refusal, pause/resume, supervisor freeze, time/token/iteration
bounds, ownership refusal, persistence rollback and before-episode refusal,
saved approval after archive/outbox failures, disapproval and regression shield.
Pure tests cover sanitizer scope/deadline/count/sensitive unknown fields and
status without live-worker evidence.

During development, expected old archive-held assertions were updated to the
new durable active retry contract. A new stall test initially expected retained
job directories, but the existing process layer intentionally deletes owned
no-result scratch: the corrected test verifies two distinct worker-confirmed
attempt clocks and zero retained scratch. No production cleanup was changed.
A restore fixture initially used project autoResume; its failure exposed the
existing global-only policy, and the test now uses the isolated global settings
path rather than weakening admission assertions.

## Next coherent slice: admitted metric/audit loops

Implemented typed measurement outcomes in `goal-loop.ts`: verified reading or
infrastructure/no-verdict. Throws, nonzero exits,
missing codes and malformed stdout do not mutate numeric history, best/last,
productive iteration, plateau or stuck state. Zero-exit empty, nonnumeric and nonfinite output now enters config/no-verdict
recovery too, preserving productive accounting rather than hitting the plateau brake.
Unknowns return before progress classification and all git operations.

The admitted loop persists the shared retry envelope before its existing timer
arms. Due measurement retries run only the measure, not another agent turn;
counts affect capped pacing only. Timer identity, generation, cwd, claim/retry
identity, stop/freeze/load gates and numeric-era ownership fence callbacks.
Refinements invalidate the old retry; asynchronous measurements cannot attach to
an object or metric era superseded while awaiting exec. An in-flight tick latch
prevents duplicate measurement dispatch. The original retry envelope saved only a broad failure class: it did NOT
retain the actual stderr/exit/exception or project failure cause. The actual-cause
objective was correctly rejected despite passing recovery tests. The subsequent
repair is documented in [LOOP-INFRASTRUCTURE-DIAGNOSTICS-2026-10-14.md](LOOP-INFRASTRUCTURE-DIAGNOSTICS-2026-10-14.md).
Retry status now includes bounded credential-redacted cause prose and remains
metadata, never proof of a live worker. Bounds stop retries without destructive
git cleanup, retaining uncommitted work. Persistence refusal rolls the retry
transition back and arms nothing.

The activation fallback no longer terminalizes error turns at
`LOOP_MAX_CONSECUTIVE_ERRORS`: it durably paces them, while recognized provider
errors continue through the existing main-model recovery owner. Explicit aborts
retain their cap (including error envelopes positively identified as user aborts).
No changes to credentials, providers, external project state or release metadata.

Evidence added in `tests/loop-infrastructure-recovery.test.ts`: actual MockPi
lifecycle/adapters and temp journals, **2105 failures each for metric and audit
loops**, early duplicate wakes, journal reload checkpoints and final productive
numeric recovery; repeated recognized provider errors and recovery; fallback
errors beyond the former cap; stale timers; freeze/stop/token bounds; stale
async refinement; actual future/overdue reload and cold no-consent; storage
refusal via an unavailable runtime directory. These are simulated exec outages,
not provider calls. Missing-code tests now explicitly assert preserved history
instead of counting infrastructure toward the invalid-metric brake. Source
pins retain exit-code and measure-timeout assertions.

Validation:
- `timeout 60s npm run check`: PASS.
- Isolated-global, bounded targeted run of 11 files: **173 pass / 0 fail**,
  approximately 21 seconds; `/tmp/glla-loop-gates.log` (ephemeral evidence).
- New lifecycle file: **10 pass / 0 fail**, approximately 3 seconds.
- Isolated-global `timeout 150s npm test`: **INCOMPLETE / TIMEOUT** after 150s;
  no `(fail)` lines observed before SIGTERM. `/tmp/glla-full-fast.log` is
  ephemeral evidence, not a completed full-suite result.

Development diagnostics: the first combined targeted run caught an early-bound
check bypassing ordinary terminal git preservation. Restricting that early check
to infrastructure waits restored the existing terminal commit-failure assertion;
the 173-test rerun passes. The cold fixture initially emitted shutdown without
reason, which correctly consented a same-process successor. Explicit quit models
a genuinely cold load: it retains active=false, zero timers and zero new execs;
no consent assertion was weakened.

### Current complete slice / acceptance boundary

- Admitted project, metric and audit loops recover infrastructure/no-verdict,
  including auth/config and unknown errors, without count/horizon termination.
- Initial baseline/proposal probes intentionally refuse invalid drafts before
  admission. Explicit force or audit deferred-baseline admission is separate
  consent; behavioral coverage proves admitted missing-baseline recovery.
- `Goal.pendingCompletion` completion hooks are goal-only, not loop gates.
  No goal completion eligibility was modified or claimed as a loop blocker.
- Explicit user interrupt/abort diagnostics now carry `user-abort`, preserving
  the existing three-abort stop authority and queued-list announcement. Generic
  provider outages retain supervised loop ownership beyond the old error cap;
  the queue stays inactive until explicit stop, which announces availability.
- External providers/credentials, host availability and unavailable storage are
  not repaired. Bounds, pauses, cold-load consent and durable admission still win.

## Focused repair evidence

Independent prior release check `/tmp/glla-loop-review-release.log` was **FAILED**:
3876 pass / 1 skip / 2 fail, before downstream release checks. Failures were a
stuck fixture without actual admission and explicit interrupt classification.
The repaired stuck fixture now admits via isolated global autoResume and supplies
an actual numeric measurement. Assertions still require the real stuck stop,
recap and queued-list availability. The interrupt test retains actual abort
semantics, preserved accounting and queue announcement; a separate generic
provider test checks supervised ownership and no queue activation.

Added actual-adapter cases drive each zero-exit empty/auth-text/not-number output
12 times (beyond plateauWindow), checking exact due dates, early duplicate wakes,
no git operations, durable accounting and one subsequent productive reading.
They also prove explicit stop fences the retained callback. Missing-baseline
coverage refuses unconsented admission then exercises explicit-force recovery.
Classifier tests pin all existing explicit interrupt spellings to user-abort.

Commands use a unique `GLLA_GLOBAL_SETTINGS_PATH` set BEFORE preload.
- First focused run: 37 pass / 2 fail (fixture lacked numeric measurement and
  expected the wrong abort cap); corrected without weakening behavior assertions.
- Eight-file targeted run: **165 pass / 0 fail**, 14s,
  `/tmp/glla-loop-repair-targeted.log`.
- Initial typecheck caught a test-only null/undefined mismatch; corrected.
- Parent corrected the remaining obsolete nonnumeric expectation to assert preserved
  best/last/history and durable recovery. The provider-exhaustion healthy fixture
  now returns a numeric reading: a healthy model alone is not metric evidence.
- Full suite after those corrections: **3883 pass / 1 skip / 0 fail**, 416 files;
  the skip is `commit survives the auto-committer daemon`, explicitly env-gated.
  The first green-suite release chain exposed stale generated inventory, regenerated
  with `node scripts/generate-inventory.mjs` rather than bypassing its check.
- Final isolated `timeout 1200 npm run release:check`: **PASS, exit 0**,
  `/tmp/glla-loop-verified-release.log`. This includes the full suite, typecheck,
  jiti state-binding repro, offline auditor extension loading, inventory validation,
  package dry-run and package smoke. No publication, version bump or release.
- `git diff --check`: PASS. Separate `npm run check`, inventory and pack dry-run
  also pass. Ephemeral command logs are not substitutes for reproducible commands.

The independent first rehearsal blocked missing metrics, user-interrupt handling
and two release tests; each finding has now been repaired and behaviorally tested.
Final independent source review reports **No issues found; merge verdict OK**:
`audit/LOOP-INFRASTRUCTURE-RECOVERY-REVIEW-2026-10-14.md`. It inspected the
current six behavioral contract areas, prior P0 repairs and raw passing release
log. The active universal-recovery goal is not terminalized by this document;
completion still requires the detached goal auditor. No publication or history
operations were performed.

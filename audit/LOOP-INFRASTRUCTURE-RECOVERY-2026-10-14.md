# Loop infrastructure recovery — 2026-10-14

## Objective and ownership

Confirmed objective: automatic paced recovery from every infrastructure error,
including auth/config, across all loop lifecycles without a count cutoff.
Explicit stop/pause/freeze, bounds, persistence and reload consent remain
independent authority. This is a **first project-audit slice**, not completion
of the universal objective. No credentials, providers, Pi core, other plugins,
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

## Remaining BLOCKERS for the overall objective (parent-owned next slices)

- Completion audit retry gates in `extensions/loops/goal-auditor-hooks.ts`
  still have ordinary one-shot/aggressive recovery-horizon eligibility. Shared
  pacing alone does not remove those gates.
- `runMeasure` in `extensions/goal-loop.ts` still collapses infrastructure to
  `number | null`; null readings can hit the measurement brake in
  `extensions/goal-loop-forever.ts`. A typed metric adapter must preserve best,
  history and productive accounting, and avoid regression actions on unknowns.
- Unclassified provider-error loop turns in
  `extensions/loops/goal-activation.ts` still have a finite-stop seam; recognized
  main-model recovery is separate. Parent is tracing/implementing that seam.
- Broader integration/full-suite review remains required; this slice does not
  claim the universal recovery goal is complete. Persistence refusal cannot
  make unavailable storage durable or authorize unjournaled work.

No staged files; daemon owns automatic source/evidence commits. No history
operations or release commands were performed.


## Next coherent slice: admitted metric/audit loops

Implemented typed measurement outcomes in `goal-loop.ts`: verified reading,
successful invalid metric, or infrastructure/no-verdict. Throws, nonzero exits,
missing codes and malformed stdout do not mutate numeric history, best/last,
productive iteration, plateau or stuck state. Successful nonnumeric output
retains the existing explicit invalid-metric brake; it is not numeric progress.
Unknowns return before progress classification and all git operations.

The admitted loop persists the shared retry envelope before its existing timer
arms. Due measurement retries run only the measure, not another agent turn;
counts affect capped pacing only. Timer identity, generation, cwd, claim/retry
identity, stop/freeze/load gates and numeric-era ownership fence callbacks.
Refinements invalidate the old retry; asynchronous measurements cannot attach to
an object or metric era superseded while awaiting exec. An in-flight tick latch
prevents duplicate measurement dispatch. Retry status is saved diagnostic
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

### Remaining BLOCKERS / acceptance boundary

- Completion audit `goal-auditor-hooks.ts` remains unchanged: ordinary one-shot,
  aggressive horizon, provider retry eligibility and timer-plan persistence
  require a separate ownership review. Ordinary goal completion limits must not
  be silently widened under a loop-only continuity contract. All callers of the
  existing arm-then-return scheduler still need transactional conversion.
- Initial start baseline failures and proposal/refinement measurement probes
  still use their pre-existing refusal contract. This admitted-loop slice does
  not claim automatic recovery across those initial admission paths.
- Full-suite/slow-suite review remains incomplete; no release check was run.
- Bounds coverage here is token-bound behavioral coverage plus existing suites;
  additional metric retry time/iteration-bound and explicit-abort stress cases
  remain useful independent-review targets.

The universal objective is **not complete**. Reviewer gate is still required.
No staged files or history operations; the daemon remains commit owner.

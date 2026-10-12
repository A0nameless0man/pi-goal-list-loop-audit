# Supervised provider exhaustion: diagnosis and bounded verification

Scope: GLLA goal/list/loop only. Ordinary unsupervised chat persistence, Pi/core,
providers and external projects are not implementation targets. No actual
provider/quota requests were made. Screenshot actual session state is UNCONFIRMED:
no supplied session journal ties “Retry failed after 15 attempts” or IDLE to lost
work. IDLE is also an activity projection of retained work.

## Public host contract (read-only inspection)

Installed @earendil-works/pi-coding-agent 0.99.1:
`dist/core/extensions/types.d.ts` defines AgentEndEvent with `messages: AgentMessage[]`
and ExtensionAPI.on('agent_end'); its ExtensionEvent union has no auto_retry_end.
`dist/core/agent-session.js` forwards agent_end messages to the extension runner
before notifying public listeners and prepares bounded core retries separately.
`auto_retry_end` is a host session notification, not a registered extension event.
GLLA consumes assistant stopReason=error and errorMessage/content through its
existing normalized diagnostic path. No unsupported exhaustion hook was added.

## Actual state machine and defects

Existing main already normalized away legacy autoRetryUntil; attempts are durable
nonnegative safe integers with no terminal attempt cap. Automatic recovery is
paced and persists retryAt before arming timers. Cold restore remains consent-gated.
The old 24h comments were stale, not actual enforcement.

Confirmed behavioral defects repaired:

1. No-backup loop errors initially went through loop consecutive-error ticks,
   rather than the shared durable provider wait. Recoverable supervised errors
   now park immediately; dead failures still do not consume iterations.
2. A full-chain cycle reset erased modelFailureSteps even while retrying the
   same unhealthy model. A deterministic 2101-failure runtime test never escaped
   eager 5-second pacing. Cycle reset now retains that model's failure rung;
   actual rotation and healthy settlement retain their existing reset policy.
3. On consented reload, a recovery-held loop with queued list work reached
   activateNextListItem, replacing the supervisor and retiring its recovery.
   Queue activation now defers while the loop recovery record owns work.
4. Regular recovery timers fenced session generation but not episode identity.
   A callback already dequeued before replacement could probe the new episode.
   It now checks the captured episode/owner before invoking the shared probe.
5. Healthy settlement lacked owner validation. A late success could clear an
   old recovery and resume a replacement goal carrying recovery-like pause text.
   It now requires completed restore and reconciles retired ownership first.
6. Same-model/cycle probe surface resumption could unpause a stored audit claim.
   It now excludes pendingCompletion and decision/user pause kinds. Provider
   health assessment remains separate from audit claim ownership.

## Verification

New runtime tests use MockPi registered event handlers, real goal-recovery probes,
real durable journals, and actual final continuation timers. Each goal/list/loop
executes 2101 simulated provider exhaustion failures before successful settlement;
only Date.now advances to scheduled deadlines (no live provider calls). Every
failure must persist a future retry, arm a timer and preserve the work identity,
contract, queue and loop bounds/history. Final success must deliver continuation.
The simulated episode exceeds 24h without a terminal count/time cutoff.

Reload tests simulate shutdown/process-latch reset/re-registration/restoration,
verify held versus consented timers, retain queue and exact owner, exercise
supervisor pause and cancel/loop stop, invoke a dequeued stale callback, and check
late successful settlement cannot adopt a replaced goal. A stored completion
claim must remain paused and unchanged when provider probing runs.

Tests redirect GLLA_GLOBAL_SETTINGS_PATH to a new temporary directory before
Bun preload and fixtures save/restore that temporary file. No user settings are
written. Commands have outer timeouts and per-test limits. Initial test failures
were diagnostic: same-model eager-reset and loop queue replacement above, plus
fixture normalization/cold-versus-same-process consent expectations (corrected).

Passing new tests: 4 exhaustion/audit tests and 5 reload/fence tests. Parent owns
full-suite, release and broader audit acceptance. See worker acceptance report
for final targeted validation results. No branch, identity or history operations.

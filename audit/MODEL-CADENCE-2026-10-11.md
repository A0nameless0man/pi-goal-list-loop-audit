# Model-cadence isolation — 2026-10-11

## Background

Reviewer `independent-…` flagged that a freshly selected backup could
inherit the primary’s retry rung, and that the same-model deadline could
still apply while the new model was healthy. While the recovery card was
already truthful, the underlying state could make a backup spend the
primary’s 30-minute rung on its first failure.

## Durable fix

1. New `modelFailureSteps` counter on `MainModelRecovery`:
   - `extensions/goal-loop-core.ts` — schema, sanitizer accepts bounded
     non-negative integer ≤ 1 000 000.
   - `extensions/goal-recovery.ts` — initialised to 0 alongside
     `sameModelRetries` at every selection / failback / cycle-reset.
2. `extensions/main-model-recovery.ts` —
   `sameModelRetryDeadline` now returns `undefined` while a backup is
   healthy (`primaryProbeAt` set, no pending `retryAt` or in-flight
   probe). The deadline resumes only when the new model actually
   fails, so a serving backup is never artificially bounded.
3. `extensions/goal-recovery.ts` —
   `parkMainModelAfterFailure` walks
   `previousSteps = existing.modelFailureSteps ?? (sameModelRef(active, primary) ? attempts : sameModelRetries ?? 0)`
   so the rung always reflects THIS model’s own failure history, never
   the predecessor’s. A new backup starts at step 1; only a true
   same-model retry increments the rung; the phase is reset when the
   active model differs from the predecessor.
4. `extensions/goal-recovery.ts` —
   `mainModelRecoverySucceeded` zeroes `sameModelRetries` and
   `modelFailureSteps` and clears `sameModelPhaseStartedAt`; a later
   failure on a healthy serving backup therefore starts a fresh phase
   and an eager short delay.

## Tests

- `tests/same-model-retry-window.test.ts`
  - New: `attempts=30` then `parkMainModelAfterFailure` keeps
    `attempts=31` (episode history) but advances
    `modelFailureSteps=1`, and the new timer is ≤ 5s.
  - New: `mainModelRecoverySucceeded` clears the failure phase and
    `sameModelRetries`; a subsequent failure on the same model starts a
    fresh phase with eager retries.
  - Existing: the prior `attempts=2` post-success assertion still passes
    (a backup inherits the previous attempt history but never its
    retry rung).
- All targeted recovery, pause-attribution, and UI surface tests pass
  (`129 pass / 0 fail` in
  `/tmp/glla-final-targeted.log`).

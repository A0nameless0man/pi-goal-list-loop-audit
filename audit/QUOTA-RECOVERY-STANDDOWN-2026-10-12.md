# Quota recovery vs storage stand-down — 2026-10-12

Note: `we have quota but we didnt retry, we need to be activley retrying
and retry extra after the start of every hour`
(`Screenshot_20261011_211430.png`).

## What the screenshot actually shows

The card's top warnings are persistence failures (`Goal update was not
fully persisted`, `Auditor recovery stopped because its durable cursor
could not be saved`), and the audit row reads `parked — no review
recorded` with `automatic recovery is stopped`. The true stop cause was
the storage safety hold — not a quota wait. Two GLLA-owned defects made
the stop sticky and unreadable:

1. **Repaired-disk deadlock.** The degraded latch clears on the next
   successful wrapped write, but the stand-down gates (`probeMainModel-
   Recovery`, `resumeSupervisedRecoverySurface`,
   `releasePausedGoalAfterRecoveryProbe`) returned before attempting any
   write — so a fixed disk stayed latched and resume/probe paths refused
   forever, with no write in flight to heal them.
2. **Indistinguishable WAITING.** Quota-wait and storage-hold both render
   `WAITING` in `/goal status` and list views, so a stopped card reads as
   "retrying".

## Fix

- `recheckPersistenceAfterRepair(cwd, via)` (`goal-loop-core.ts`): when
  degraded, one probe ledger write. Landing self-heals and the caller
  proceeds; failing keeps the latch and the stand-down. Wired into the
  three gates above. The hourly ticker and auditor backstop ride the same
  probe entry, so they self-heal too; paths that already attempt a write
  (normal resume admission, `retireOrphaned`, audit dispatch) needed no
  change.
- `waitingStatusLabel(hold)` (`goal-loop-core.ts`, rendered in
  `goal-commands.ts` status/list views): a degraded wait renders
  `WAITING (storage hold)`.

Deliberately unchanged (recorded as by-design, not defects): restart
without autoResume/consent arms no timers; `/glla pause`, load holds, and
`manualResumeRequired` freeze probes; explicit opt-out disables the hourly
backstop; non-recoverable/deterministic-400 failures never auto-retry.

## Verification

- `tests/quota-recovery-standdown.test.ts` (6 tests): recheck no-op when
  clear, recheck keeps the stand-down while broken, recheck heals a
  repaired store; `waitingStatusLabel` both forms; runtime repair →
  single probe entry, active goal, no switch; runtime still-broken →
  stays paused, no release, no model switch.
- Pre-existing coverage (unchanged, cited not duplicated): quota classify/
  parse/caps/retry (26 tests `quota-retry.test.ts`), sleep-until-reset,
  horizon exemption, same-model budget, hourly slot math + queue jump +
  dedup + session-start re-arm (`hourly-quota-probe.test.ts`, runtime
  scripts), restart restoration (`recovery-restore-after-restart.test.ts`),
  persistence latch contract (`persistence-hardening.test.ts`).

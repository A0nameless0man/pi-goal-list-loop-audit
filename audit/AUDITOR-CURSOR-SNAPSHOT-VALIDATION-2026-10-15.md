# Auditor cursor snapshot validation — 2026-10-15

## Scope

Validate and durably repair the false completion-auditor cursor persistence refusal. This item does not release the package or reload/resume other projects. Sanitizer validation and live-project rechecks are separate queued items.

## Implementation and invariant

`extensions/goal-loop-core.ts:3672-3680` renders persisted audit lifecycle evidence against the saved goal snapshot timestamp, falling back deterministically through creation time, claim time and epoch for malformed legacy timestamps. The same goal must render byte-identically regardless of the wall clock.

The production readback gate in `extensions/loops/goal-orchestrator.ts` remains intact: `updateGoal` writes markdown and the state journal and only succeeds when both landed, including exact markdown readback through `goalMarkdownLanded`. No refusal handling, attempt ownership, provider cadence or automatic-resume permissions were weakened.

The live `auditLifecycleProjection` default still reads the current clock. New coverage explicitly proves fresh evidence becomes stale in a live projection while persisted markdown stays fixed.

## Verification

Command:

```sh
node scripts/run-tests.mjs tests/audit-markdown-determinism.test.ts tests/goal-loop-core.test.ts tests/auditor-fallback-unification.test.ts tests/persistence-recovery.test.ts tests/persistence-hardening.test.ts tests/guard-persist-rollback.test.ts tests/audit-recovery-persistence.test.ts tests/audit-persistence-status-precedence.test.ts
```

Result: **101 pass, 0 fail**, 8 files (7.23s), exit 0. Log: `/tmp/glla-cursor-item-validation.log`.

The new file covers actual temporary-file writes/readbacks for all five persisted phases, across second ticks, stale thresholds and retry deadlines. Its additional test covers invalid legacy timestamps (creation/claim/epoch fallback) and ensures live clocks/staleness remain dynamic.

Regression sensitivity: during the initial investigation, the five clock-boundary cases failed against the old current-time renderer (**0 pass / 5 fail**, `/tmp/glla-audit-clock-before.log`), then passed after the snapshot fix. This was a new-test-before-fix run, not a rewrite or reversal of shared git history.

Unchanged fallback safety tests passed in the same 101-test run:

- `tests/auditor-fallback-unification.test.ts:515`: actual cursor refusal fails closed before retry/fallback.
- `:580`: refusal while the ladder is live remains a persistence failure.
- `:594`: refusal after generation handoff stops quietly on the result already in hand.

`npm run check`: exit 0 (`/tmp/glla-cursor-item-types.log`). `git diff --check`: exit 0.

## Limits

A local reproducible false-failure mechanism does not prove every historical storage warning was false. Genuine disk/ownership failures still stop recovery. Already paused live claims were not altered or resumed. Full release validation and npm publication belong to the final queued release item.

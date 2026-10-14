# Screenshot-report repairs verification — 2026-10-14

## Scope

Reconciles the three tested repair reports against actual code and tests,
records the one diagnosis-only report, notes the user-facing documentation
and inventory updates, and reports the full isolated release gate. No live
project sessions were mutated or recovered; no publication was performed.

## Report → repair map

| Tracked report | Disposition | Tested repair or evidence |
| --- | --- | --- |
| `audit/SCREENSHOT-RECOVERY-DEPLOYMENT-2026-10-14.md` (Outpost Eden stalled auditor) | Diagnosis only — no repair justified | Historical park matched the pre-`eb1dc957` branch; durable retry already existed. Compatibility proven by `tests/respec-builder-audit-runtime.test.ts` legacy infrastructure-held cases (pause + cancel), 34 pass / 0 fail. |
| `audit/SCREENSHOT-AUDITOR-RECOVERY-REGRESSION-2026-10-14.md` (legacy held-state recovery) | Verified existing fix, no runtime change | Same legacy cases as above; no additional runtime repair was established. |
| `audit/SCREENSHOT-CONTEXT-ISOLATION-2026-10-14.md` (Freeport report provenance) | Two defects repaired and regressed | (1) Root-scoped live telemetry: `extensions/respec-builder-ui.ts:28-43` (`respecAuditLiveScope`, scope-composed `key()`), enforced at `extensions/respec-builder-runtime.ts:136,153` and rendered at `extensions/loops/goal-ui.ts:891`, `extensions/goal-loop.ts:1598`. Regressions: `tests/respec-builder-ui.test.ts` two-root + stale-attempt tests. (2) Unchanged-audit dedupe: `extensions/goal-continuation.ts:289-319,1507` (delivered fingerprint, re-armed on new audit, cleared by `resetContinuationInitialSend`). Recovery-cache guard: `extensions/loops/goal-activation.ts:3520-3531` (`isGllaDispatch`). Regressions: `tests/audit-evidence-continuation-isolation.test.ts` (3 tests). |
| `audit/SCREENSHOT-PAUSE-ABORT-PRESENTATION-2026-10-14.md` (Page Ninja pause/abort) | One defect repaired and regressed; one upstream-only limitation recorded | Repair: `goal-paused-host-abort` carve-out at `extensions/loops/goal-activation.ts:795-826` fires before the generic non-recoverable branch for paused non-blocked goals, recording `pauseKind`/`pauseReason` and notifying that the red `Error:` line is host transport. Regressions: `tests/unsupervised-error-retry.test.ts` wait-pause case + active-turn counterproof. Limitation: the red `Error: This operation was aborted` line is host-rendered; GLLA cannot suppress it without changing the pi transport. |

No-defect dispositions held: the Freeport widget text is Freeport-local
builder history (no cross-root report attachment); the `Why: provider
error` label is deliberate credential redaction (`PROVIDER_SENSITIVE_MARKER`
in `extensions/quota-retry.ts:144-164`), not a mislabel.

## Documentation and inventory updates in this pass

- `docs/RUNTIME-INVENTORY.md` — regenerated via
  `node scripts/generate-inventory.mjs` (was stale; 5 lines changed);
  `check:inventory` now passes.
- `docs/RECOVERY.md` — added a short paragraph under "Protected holds and
  truthful displays" documenting the paused-goal host-abort distinction
  (`goal-paused-host-abort` record, no retry, host-transport notice) and
  the preserved `goal-blocked-paused` record.

No other user-facing doc changes were needed: the audit docs already carry
the per-incident evidence, and the redaction/scope behaviors are
implementation details with test pins.

## Verification

```sh
timeout 500s node scripts/run-tests.mjs tests/unsupervised-error-retry.test.ts \
  tests/respec-builder-ui.test.ts tests/respec-builder-audit-runtime.test.ts \
  tests/delta-only-continuation.test.ts tests/audit-evidence-continuation-isolation.test.ts \
  tests/respec-builder-display.test.ts tests/project-audit-status-consistency.test.ts \
  tests/compaction-failed-recovery.test.ts tests/continuation-retry-persistence.test.ts \
  tests/blocked-resolution.test.ts
# 116 pass, 0 fail across 10 files
timeout 3000s npm run release:check
# exit 0: 3904 pass, 1 skip, 0 fail across 418 files (1229s);
# skip is the env-gated auto-committer daemon test
# ("commit survives the auto-committer daemon (item 32, env-gated watched repo)");
# jiti repro pass; auditor-extensions offline verify OK;
# check:inventory clean; pack + smoke OK (pi-goal-list-loop-audit-0.39.31.tgz)
timeout 120s npm run check
# tsc --noEmit: 0 errors (covered inside release:check's test:all as well)
git diff --check
# 0 diagnostics
```

The full-suite skip is environment-gated (requires the watched-repo
auto-committer daemon) and is disclosed here per the contract; it is not a
weakened assertion.

## Residual limits

- Original auditor execution cwds for the Freeport/Page Ninja reports
  remain inferred from session/journal evidence, not source-hash-proven.
- The audit-evidence fingerprint is process-scope; a fresh process
  re-teaches via the existing first-send latch.
- The host-rendered red `Error:` line is an upstream-only limitation.
- No live recovery of the affected projects was attempted or claimed.

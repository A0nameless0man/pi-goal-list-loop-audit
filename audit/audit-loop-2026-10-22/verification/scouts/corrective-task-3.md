# Code Context

## Files Retrieved
- `extensions/approval-render-store.ts` (1-287): enqueue, corrupt-store refusal, replay acknowledgement.
- `extensions/loops/goal-orchestrator.ts` (780-884, 990-1081, 1420-1529): creation, update rollback, archive persistence boundaries.
- `extensions/loops/goal-list-queue.ts` (755-868, 884-1019): repair sidecars, failed promotion rollback, activation retry.
- `extensions/goal-loop-core.ts` (3019-3164, 3590-3701): snapshot replacement and transaction recovery/cleanup.
- `tests/goal-state-drift.test.ts` (1-140): current drift regressions and stated durability contract.
- `tests/terminal-approval-render.test.ts` (398-452), targeted test-name search: acknowledgement failure and corrupt-store coverage.
- `.pi-glla/audit-loop/findings.md` (targeted matches including 1133-1139); `audit/audit-loop-2026-10-22/README.md` (1-78): deduplication and repaired contracts.

## Finding — MEDIUM: failed repair creation rolls RAM back but leaves its new durable queue sidecar

**Source:** `extensions/loops/goal-list-queue.ts:837-855`.

The new-repair branch first successfully writes the repair sidecar (842), adds the repair to RAM (847), then attempts the state snapshot (851). If that append fails, it restores only `state.list` (852). There is no removal of the newly written repair sidecar before returning, yet the notification says the queued order is unchanged (854).

**Concrete failure sequence:**
1. Begin with a suspicious queued item and no existing repair.
2. Permit queue-sidecar writes but refuse the state-ledger append—the exact selective-failure setup described in `tests/goal-state-drift.test.ts:43-50`.
3. Attempt activation. The repair sidecar lands; the state append fails.
4. RAM and the last state snapshot omit the repair, while durable queue storage contains it with head ordering and `repairTarget` metadata.

This is actionable storage, not an inert projection: `extensions/loops/goal-list-queue.ts:891-893` explicitly hydrates durable sidecars before activation. The caller also retries activation immediately after the helper returns, without distinguishing promotion failure (`951-961`). At minimum the refused repair survives on disk despite rollback; subsequent hydration can recover it.

**Violated contracts:**
- `tests/goal-state-drift.test.ts:4-6`: live state must not drift from its durable projection.
- `audit/audit-loop-2026-10-22/README.md:39`: failed repair promotion restores queued order.
- `extensions/loops/goal-list-queue.ts:854`: operator is told the queued order is unchanged.

**Deduplication:** The existing finding at `.pi-glla/audit-loop/findings.md:1135` / tracked README:39 concerned ignoring `persistState` and falsely journalling success. Those parts are repaired. This is the surviving sidecar half of rollback, not another allegation that the result is ignored. Treat as a follow-up to that existing finding rather than inventing a second project audit.

**Suggested verification:** Add a focused activation regression with writable sidecars and failed state append; assert the refused new repair is absent from RAM, snapshot, and recoverable sidecars. No test was executed in this read-only pass.

## Key Code
```ts
const written = writeQueueItemFile(ctx.cwd, repair); // 842
// ...
if (persistState(ctx) !== true) {                    // 851
  replaceState({ ...state, list: current });         // 852
  // no sidecar rollback
  return;                                          // 855
}
```

## Architecture
Queue sidecars are a recovery input as well as a durable projection. Rolling back only the state array does not undo enqueueing into that recovery input. Snapshot/transaction and terminal-render fixes otherwise showed no additional confirmed defect within this narrow inspection.

## Start Here
`extensions/loops/goal-list-queue.ts:837-855`: reconcile the new sidecar with the failed snapshot boundary, and propagate refusal to the immediate retry at 951-961.

## Residual Risks
- Static source review only; no fault-injection reproduction or tests run.
- The hydrator implementation is outside the assigned scope; the finding's guaranteed divergence is the surviving sidecar, not a claim that every retry necessarily dispatches work.
- Corrupt-outbox preservation/refusal and `goal_created { persisted:false }` were accepted as revised contracts, not reopened. Crash-verdict authentication was not reopened.

```acceptance-report
{
  "criteriaSatisfied": [{"id":"criterion-1","status":"satisfied","evidence":"One concrete surviving repair-sidecar rollback defect with source and contract citations; residual limitations documented."}],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [{"command":"nl -ba scoped source/test files | sed -n selected ranges","result":"passed","summary":"Verified exact rollback, hydration-entry, retry and contract line references."}],
  "validationOutput": ["Read-only source inspection; no tests executed."],
  "residualRisks": ["Static finding not runtime-reproduced; hydration implementation intentionally outside scope."],
  "noStagedFiles": true,
  "diffSummary": "No repository edits; report artifact only.",
  "reviewFindings": ["blocker: extensions/loops/goal-list-queue.ts:851-855 - failed new-repair promotion retains durable sidecar while restoring RAM."],
  "manualNotes": "Deduped against both audit records; report is a surviving rollback follow-up within the existing 2026-10-22 audit, not a new audit. No installs, commits, reloads, or suites."
}
```

BLOCKERS: 1 — incomplete new-repair sidecar rollback.

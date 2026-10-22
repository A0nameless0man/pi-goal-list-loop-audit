# Release 0.39.45 gate record

## Version and content

`package.json` and both `package-lock.json` entries declare **0.39.45**. The
`Unreleased` section was promoted to `## 0.39.45 — authenticated verdicts,
fail-closed recovery and a fail-closed test gate (2026-10-22)` with a fresh
empty `Unreleased` left for future work. `docs/INDEX.md` reaches v0.39.45. A
test-only export and the commit-point correction required a regenerated
`docs/RUNTIME-INVENTORY.md`.

Contents: authenticated detached-auditor verdicts (HMAC over the result, key
delivered on the worker's stdin pipe), fail-closed crash recovery after key
loss, an extension-fence root restriction, the `auditorToolTimeoutMs` floor
correction, the fail-closed Bun capability preflight in the test runner, queued
rework wording in the compact card, two-scope role thinking inheritance, repair
sidecar rollback, and the `pendingCompletion.leftOut` string compatibility note.

## First full gate: 4310 pass / 7 fail — two distinct causes

`release-first.log` ran the complete `npm run release:check` on this host
(load average ~133 throughout). Suite: 4310 pass, 7 fail across 465 files,
5296s. The seven failures split cleanly:

1. **Wall-clock contention, no defect (5).** Two 2,101-cycle
   provider-exhaustion stress tests timed out, and three further tests in that
   same file failed in consequence. `tests/supervised-provider-exhaustion-runtime.test.ts`
   passes alone: **7 pass, 0 fail**, 265s (`stress-alone.log`). Per
   `docs/RELEASING.md`, a wall-clock test that passes alone is host
   contention, not a regression.
2. **A real regression introduced by this pass's own audit fix (1).**
   `tests/contract-resolution-runtime.test.ts:59` threw
   `TypeError: undefined is not an object (evaluating 'durable.status')` — it
   reproduced 3/3 alone, so it was not contention.

### The regression: a deleted commit point

Commit `9fe3036a0` (this pass, "failed updates restore recoverable state") made
`updateGoal` roll back RAM, markdown **and** the pending goal-state transaction
whenever the JSONL/markdown projection was incomplete. But
`writeGoalStateTransaction` is the documented durable commit point that
`readState` adopts on restart, and `extensions/goal-commands.ts:963-968` reads
that very snapshot to report "Amendment committed to the durable recovery
snapshot". The rollback therefore discarded a real commit and blinded the path
that reports it.

Fix `92adcb72b`: when the transaction landed but the projection is incomplete,
`updateGoal` returns false and warns, keeps the committed goal live, and leaves
the transaction on disk for the restart projection. Rollback happens only when
no transaction landed. The notification wording distinguishes the committed
case from the uncommitted one.

The regression test in `245789ec9` was rewritten to assert the invariant that
actually matters — the live goal equals what a restart *adopts* — instead of the
incorrect "discard every unprojected update" assertion that had let the bug
through. A second case drives failure onto the transaction itself (a directory
in its place) and proves an uncommitted update is still not kept in RAM.

## Post-fix gates

- `drift.log`: `tests/goal-state-drift.test.ts tests/contract-resolution-runtime.test.ts`
  — **24 pass, 0 fail**.
- `stress-alone.log`: provider-exhaustion file alone — **7 pass, 0 fail**.
- `auditor.log`: `tests/auditor-stall-watchdog.test.ts tests/auditor-verdict-authentication.test.ts`
  — **12 pass, 0 fail** (both had failed in the contended suite).
- `types.log`: `npm run check` — exit 0.
- `inv.log`: `npm run check:inventory` — exit 0 after regeneration.

All runs used Bun 1.3.14 from the ignored repo-local test-tool install with
`TMPDIR` on `/dev/shm`.

## Decisions and limits

The tree was corrected rather than re-running the full gate as-is, because a
reproducible failure is a defect (`docs/RELEASING.md`). A second complete
`release:check` after this fix is the remaining step before tagging; it is not
assumed to pass and is not claimed here. No tag, GitHub Release, npm
publication or live-host reload has happened yet. Publishing requires creating
and pushing the `v0.39.45` tag against this validated commit, then publishing a
GitHub Release, which is what triggers `.github/workflows/publish.yml` (the tag
must equal `package.json` and descend from `main`).

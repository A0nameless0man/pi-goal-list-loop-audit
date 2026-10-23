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

## Second and third full gates: two test races found, then green

`release-second.log` (4315 pass / 3 fail) and `release-third.log` (4317 pass / 1
the fixed tree) exposed two further defects, both in tests rather than product
behavior, and both reproducible only under load:

3. **`tests/auditor-verdict-authentication.test.ts` raced its own forgery.** The
   worker held the forged unsigned result for a fixed 250ms so the parent would
   observe and reject it. On a starved host the parent's poll loop could miss
   that window entirely and see only the signed verdict, so the
   `auditor_result_unauthenticated` row never appeared even though
   authentication worked. The worker now waits until the parent has actually
   journalled the rejection (bounded), then publishes the signed verdict.
4. **`tests/compaction-containment.test.ts` waited a fixed 2500ms for a 2000ms
   timer**, so a delayed settle callback read as zero sends. It now waits for the
   observable `compaction_refire` row under the shared host-sized budget; the
   existing asserts still require exactly one probe, exactly one send and no
   storm escalation.

Both were proven to still detect a real break: disabling the authentication
check fails the first test (`va-negative.log`), and disabling the refire fails the
second (`compaction-negative-control.log`). The forgery wait also had to be routed
through the shared host budget to satisfy `tests/host-contention.test.ts`'s
guard against hand-rolled deadlines.

**Final gate `release-final-green.log`: `npm run release:check` exit 0 — 4318
pass, 0 fail, 4319 tests across 465 files in 1582s**, followed by typecheck,
inventory, `npm pack --dry-run` (206 files, 1.8 MB) and the packed-tarball smoke
(installed launcher RPC challenge, skill diagnostics, installed import). Both
provider-exhaustion stress tests passed inside the suite in this run; no stress
test was weakened, skipped or reduced from 2,101 cycles at any point.

## Decisions and limits

The tree was corrected rather than re-running the gate as-is each time, because a
reproducible failure is a defect (`docs/RELEASING.md`). Exactly one complete gate
now passes on the tagged tree: attempts one through three failed and are kept as
records, not relabelled. No stress-test budget or assertion was lowered to reach
green; the two fixes tighten test determinism.

No tag, GitHub Release, npm publication or live-host reload had happened when this
file was written. Publishing requires creating and pushing the `v0.39.45` tag
against this validated commit, then publishing a GitHub Release, which is what
triggers `.github/workflows/publish.yml` (the tag must equal `package.json` and
descend from `main`).

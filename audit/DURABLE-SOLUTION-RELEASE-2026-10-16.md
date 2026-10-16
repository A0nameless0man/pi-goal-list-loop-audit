# Durable-solution final gate — recorded command evidence

This is a reviewable record of observed local command output, NOT a GLLA
execution/progress receipt or permission to approve completion. The original
contract is unchanged. Prior failed attempts remain documented in
DURABLE-SOLUTION-VERIFICATION.md.

## Final invocation

Command: `timeout 3600 npm run release:check`
Started: 2026-10-16T14:32:04Z
Ended: 2026-10-16T15:12:21Z
Exit code: **0**
Pre-invocation HEAD: `eb04c210b76277cf050c46ce38a98c9098c901c1`.
Package manifest: `pi-goal-list-loop-audit` 0.39.34 (unchanged from baseline).

Raw full log: `/tmp/glla-durable-release-check-3.log`.
Status: `/tmp/glla-durable-release-status-3.json`.
Content-hash inventory: `/tmp/glla-durable-release-inputs-3.json`.
Post-run comparison: **RELEASE_INPUT_DRIFT: []** for extensions, tests, scripts,
schemas, prompts, package/lock/tsconfig and generated runtime inventory.
`git diff 6943a00b -- package.json package-lock.json`: empty.

## Full-suite output excerpt

```text
1 tests skipped:
(skip) commit survives the auto-committer daemon (item 32, env-gated watched repo)

 3985 pass
 1 skip
 0 fail
Ran 3986 tests across 423 files. [2222.67s]
[run-tests] finished in 2227s (exit 0)
```

The one skip requires an explicitly configured watched-repository daemon
integration environment. It was neither newly introduced nor used to skip a
failed assertion. All 2,101 provider-failure cycles per mode remain asserted;
progress is emitted only after actual durable cycles verify, not on a timer.

## Remaining release gates, raw excerpts

```text
✔ jiti: /list audit enqueues, persists the item, and ACTIVATES (state binding not split)
ℹ tests 1
ℹ pass 1
ℹ fail 0
ℹ skipped 0

> pi-goal-list-loop-audit@0.39.34 test:auditor-extensions
> node scripts/verify-auditor-extensions-offline.mjs
OK: -e <resolved-path> registered 1 glla-auditor-fixture models offline (PI_OFFLINE=1)
OK: no temporary extension install directory created
VERIFIED offline auditor extension loading via resolved path

> pi-goal-list-loop-audit@0.39.34 check:inventory
> node scripts/generate-inventory.mjs --check

npm notice version: 0.39.34
npm notice total files: 183
OK: packed launcher loaded and worker completed its bounded RPC probe (challenge confirmed)
OK: packed glla-delegate skill loads with zero diagnostics
OK: installed and imported pi-goal-list-loop-audit@0.39.34 from its packed tarball
```

`test:all` includes `tsc --noEmit` before the Jiti/offline gates; the command
chain exited 0. A separate `timeout 180 npm run check` also passed immediately
before this invocation (`/tmp/glla-durable-final-types.log`).

## Dedicated contract command

`timeout 300 node scripts/run-tests.mjs tests/durable-solution-*.test.ts`
(`/tmp/glla-durable-final-dedicated.log`):

```text
 40 pass
 0 fail
Ran 40 tests across 2 files. [1337.00ms]
[run-tests] finished in 1s (exit 0)
```

These 40 tests are also included in the full suite; do NOT add them again to
the full-suite total. Jiti's separate one-test result is reported separately.

## Boundary

The package smoke installed the local tarball into a disposable temporary
prefix and ran an RPC stub. It did not publish, bump the manifest, reload a
real interactive session, contact a provider, or mutate an external project's
journal. A temporary install/import is package validation, not proof that a
user's live session loaded the new source. Live deployment is outside this
local-only contract.

# Patch 0.39.44 preparation

## Contract and deliverables

- Six repairs are mapped to real lifecycle/resolver regressions in
  `audit/glla-command-review-2026-10-21/README.md` (the final dispositions table).
- `package.json`, lockfile root and lockfile package entry all declare 0.39.44;
  `CHANGELOG.md` has one entry describing all six repairs and retains Unreleased.
- `docs/SETTINGS.md` documents session inheritance, explicit null session override,
  on-demand registration, downward thinking resolution and independent ten-slot
  settings. `docs/INDEX.md` reaches the new release; runtime inventory regenerated.
- No package publication, tags, live-session reload or live project recovery.

## First gate attempt: incomplete, not a pass

The first `timeout 10800 npm run release:check` was interrupted during the suite
(after about 1921 seconds); no success or timeout-as-pass is claimed. Its log
(`release-first-incomplete.log`) exposes four failing assertions:

1. Healthy real detached project approval was cancelled by the fixture's hardcoded
   5-second no-progress/startup budget. The shared host reported load ~137 and the
   worker needed ~10 seconds. Both general healthy-worker fixtures now use the
   existing measured host-budget helper for those deadlines. Intentional 50ms
   stalled-worker cases are unchanged, as are all phase/archive assertions.
2. Doc parity and release contract both caught the missing new version in
   `docs/INDEX.md`; the index is updated to 0.39.44.
3. Detached completion's post-tool repaint assertion only recognized the later
   live-progress `execution unconfirmed` vocabulary. A repaint before boot uses
   the durable `no worker event yet` vocabulary instead. The assertion now accepts
   that explicit absence-of-evidence statement too, and retains a diagnostic widget
   dump. It still requires withheld execution evidence; an asserted live worker
   without one of those statements fails. No display source or existing queued
   identity contracts were changed. Before the assertion fix, five isolated runs
   passed: this was a timing-dependent coverage gap, not five proofs of cleanliness.

## Bounded checks before fresh release gate

- Integrated original six-scenario reproducer: 6 passed, 0 failed.
- Project audit runtime and release-contract tests: 49 passed, 0 failed
  (`focused-tests.log`; only two files matched, not the nonexistent docs-drift name
  also included on that invocation).
- Actual `tests/doc-parity.test.ts` and detached repaint targeted check: 2 passed,
  0 failed (`doc-repaint-tests.log`).
- Disposable project-worker fixture with a harmless extra 250ms result delay:
  approval/archive test passes. Same fixture emitting disapproval instead of
  approval: test fails on builder phase (`harmless-delay.log`, `verdict-regression.log`).
  Thus measured budgets do not turn missing/wrong behavior into a success.

## Subsequent gate assessment

An interrupted tool call did not terminate its release process tree. Inspection
found overlapping owned runners; they were explicitly terminated before the clean
run. One log was also shared by overlapping writers, so that log is not a clean
revision-bound result. These runs are not relabeled as passing. A subsequent isolated
run failed on filesystem `ENOSPC`, including inability to save its exit file. No
unrelated files were deleted and no OS repair was attempted. Final validation uses
an owned `TMPDIR` under `/dev/shm` (15 GiB available), with the same release command,
assertions and deadlines. This is test scratch isolation, not a claim to have fixed
machine storage.

The complete isolated gate then terminated **exit 1**: 4281 passed, 1 skipped,
1 failed across 462 files. Only `tests/auditor-ladder-discipline.test.ts` failed:
it asserted `via: session` for an explicit auditor pin to the session identity.
That is not implicit session inheritance: `resolveCandidateThinkingLevel` must
retain the configured auditor dial for an explicit pin, as documented in
`extensions/auditor-thinking.ts` and `docs/SETTINGS.md`. The old assertion would
reintroduce the dial bug if used to change the resolver. It now exercises that
consumer behavior (`low` configured vs `high` live session), while preserving
same-model selection and the empty/no-duplicate ladder assertion. With the configured
dial absent, it still checks inheritance of `high`. The literal route spelling is
not made a new requirement. Focused ladder and fallback tests pass 52/52.

The repaint's earliest compact queued card is now also covered explicitly: its
`Audit starting`, `no activity yet`, and `worker starting` statements must all be
present. An ordinary running card cannot satisfy that branch. One targeted run
passed after this extension. Runtime displays and existing queued identity tests
remain unchanged.

The independent reviewer found no static issues in metadata, documentation and
the earlier two gate-test changes, but had no execution tool. Its report is retained;
full execution belongs to the parent, not the reviewer. The later explicit-pin
consumer assertion is executor-reviewed and covered by the final gate, not attributed
to that earlier static review.

## Final gate repairs and verified release result

Further complete runs were retained rather than relabeled:

- `release-stress-and-marker-failures.log`: 4277 pass, 1 skip, 5 fail. Two
  2101-cycle workloads exceeded their unscaled 300-second caps; unfinished async
  fixtures then leaked assertions into the following cases. Those workloads now
  use the same measured host deadline helper, with all 2101 cycles, durable
  assertions, no-output watchdog and finite bounds retained. The mechanical
  descendant could write its fixed-delay marker *before* a load-scaled kill;
  it now records real child startup and waits for an explicit release written only
  after cancellation completes. No production process-kill assertions were removed.
- `release-fleet-budget-failure.log`: 4281 pass, 1 skip, 1 fail. The saved-retry
  provenance test exhausted the production scan's 10-second total I/O deadline
  under host scheduling pressure, so there was no status to assert. Its observation
  clock is now fixed locally and restored in `finally`; production time limits,
  independent fleet budget/incompleteness checks and saved-retry honesty assertions
  remain unchanged. All 12 fleet tests pass in `fleet-focused.log`.

Disposable sensitivity checks retain behavior, not incidental literals:

- Explicit-pin test tolerates a model identity rename, and fails when candidate
  provenance incorrectly becomes implicit session (`ladder-*.log`).
- Descendant test tolerates a longer timeout and fails when the child deliberately
  escapes the owned process group and writes after cancellation
  (`mechanical-harmless.log`, `mechanical-escape-regression.log`). Initial disposable
  invocations omitted Bun's explicit test budget and timed out at its 5s default;
  those are not evidence of behavior. Retained logs are the corrected bounded runs.
- Fresh static follow-up review found no issues in pin/dial, measured stress budget,
  child release gating or compact-starting repaint (`review-gate-followup.md`). It
  is static-only, not an independent command execution. The later fleet clock
  fixture was executor-reviewed and exercised by the complete gate.

**Final observed command:**

```sh
TMPDIR=<owned-executable-tmpfs-directory> timeout 10800 npm run release:check
```

**Exit 0** (`release-check-final.exit`). `release-check-final.log` records:

- **4282 passed, 1 skipped, 0 failed** across 462 files (4283 tests); the sole skip
  is the pre-existing env-gated watched-repo auto-committer integration case.
- Full serialized test runner exited 0; TypeScript check and real Node/jiti state
  split regression succeeded.
- Offline auditor extension fixture registered and ran without installation side
  effects.
- Generated runtime inventory passed its consistency check.
- `npm pack --dry-run` succeeded, and the isolated packed installation imported
  0.39.44, loaded the launcher, completed the bounded worker RPC challenge, and
  loaded the delegate skill with zero diagnostics.

`tested.sha256` binds package/lock/changelog and every gate-test repair to this
execution; all hashes were rechecked against the worktree afterward. Evidence-only
report additions followed; no runtime/test source changed after the passing gate.
`git diff --check` also passed. Source stays on main; there was no tag, publication,
installed-session reload or live project recovery. Package and both lockfile version
fields are 0.39.44, with six repair bullets and the Unreleased section retained.
The gate is a prepared-release result, not a provider-health or live-session receipt.

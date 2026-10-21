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

Final release gate and independent rehearsal evidence will be appended once observed.

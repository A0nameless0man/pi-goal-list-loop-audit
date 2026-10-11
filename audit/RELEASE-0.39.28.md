# Release 0.39.28 — verified retry budget and durable pause admission (2026-10-11)

## Scope

Promote the three unpublished post-release audit repairs plus this goal's isolated
recovery verification and context-growth followup. The package version is the
only change to `package.json` and `package-lock.json`; every other change is
either a tracked source/test/audit/script artifact or a docs/changelog entry.

## Gate

`timeout 1800 npm run release:check` exited zero on the final source.

- `npm run test:all`: 3666 pass, 1 skip, 0 fail across 394 files.
- `npm run check`: tsc --noEmit exits 0.
- `node scripts/generate-inventory.mjs --check`: regenerated doc counts match.
- `npm pack --dry-run`: 169 files, sha512 printed.
- `node scripts/release-pack-smoke.mjs`: packed launcher loaded, RPC probe
  challenge confirmed, glla-delegate skill loaded with zero diagnostics,
  installed and imported pi-goal-list-loop-audit@0.39.28 from the packed
  tarball.

`/tmp/glla-03928-release-check.log` retains raw output.

## Publish

- Tag `v0.39.28` pushed to origin.
- `gh release create v0.39.28 --generate-notes` produced
  `https://github.com/DraconDev/pi-goal-list-loop-audit/releases/tag/v0.39.28`.
- `Publish npm package` workflow run `38130445193` (triggered by the release)
  concluded `success` after running the same release:check gate on the tagged
  source, then `npm publish --provenance --access public`.
- Registry convergence (cached): `npm view pi-goal-list-loop-audit version
  dist-tags.latest` resolved to `0.39.28` after a short cache window.
- `npm install --global pi-goal-list-loop-audit@0.39.28` exited zero and the
  installed `package.json` reports `0.39.28`.

## Scope compliance (verification contract item 6)

- `package-lock.json` diff vs v0.39.27 is limited to the package and root
  `version` fields. No dependency, peer, optional, or workspace entries
  changed. (Per-release release-check log + diff.)
- No forced existing-session reload, no external project or upstream code
  change, no git history rewrite. The isolated verifier and followup are
  bounded to this repository.
- The previously published release 0.39.27 remains the registry entry on
  every mirror until the registry cache window completes; that mirrors
  documentation, not a publish failure.

## Artifacts

- `audit/ISOLATED-RECOVERY-2026-10-11.md` + `audit/isolated-recovery/`
  (trace, ledger, session): independent proof of the new retry budget and
  fallback path against a real Pi SDK session.
- `audit/CONTEXT-GROWTH-FOLLOWUP-2026-10-11.md` +
  `audit/context-growth/freeport-metadata.json`: timestamped overshoot
  evidence, automatic compaction confirmation, and the new
  safety-hold-then-firing regression.
- `scripts/verify-isolated-recovery.mjs` + new
  `tests/between-tasks-compaction.test.ts` case: durable repro of both
  investigations.
- `CHANGELOG.md`, `docs/INDEX.md`: version bump and unreleased-section
  promotion.

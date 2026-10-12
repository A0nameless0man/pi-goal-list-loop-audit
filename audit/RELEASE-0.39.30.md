# Release preparation — 0.39.30

Prepared 2026-10-12; NOT tagged or published.

## Baseline and version

Registry and GitHub checks reported 0.39.28 as latest published release.
0.39.29 existed only as an untagged development package version. The prepared
candidate is 0.39.30, incorporating all changes since v0.39.28.

`package.json` and both root version fields in `package-lock.json` now agree
on 0.39.30. Lockfile changes are limited to those two fields. CHANGELOG.md
summarizes waiting/wake registration, objective/audit status, suggestion
acceptance, manual resume model selection, persistence repair and model retry
cadence. docs/INDEX.md tracks the prepared version without asserting registry
publication.

## Release gate — NOT GREEN

Ran `timeout 2400 npm run release:check`:
- exit 1 after 755 seconds;
- 3702 pass, 1 skip, 19 fail across 403 files;
- retained log: /tmp/glla-03930-release-check.log.

Failures were in audit-glance-clarity, activity-first-status,
context-checkpoint/context-growth-measurement, behavioral-orchestrator,
respec-builder-ui and release-contract. They require diagnosis against current
evidence-based UI/runtime semantics; no assertions have been removed or
weakened to obtain a release pass.

The two release-contract failures were repaired: shipped docs used relative
links to audit files excluded from the tarball, and the index lacked the
current version-range token. Repository audit links now use explicit GitHub
URLs rather than packaging the entire audit tree.

After these documentation fixes:
- `timeout 120 npm test -- tests/release-contract.test.ts`: 14 pass, 0 fail;
  /tmp/glla-03930-package-contract.log.
- `timeout 120 npm run check`: exit 0; /tmp/glla-03930-types.log.

The other 17 full-suite failures have not been repaired/reverified here.
The full release gate must pass on the final tree before tagging and publishing
through .github/workflows/publish.yml. No npm publication, release tag or
published GitHub Release was created during this preparation.

# Code Context

Read-only fresh release/packaging reassessment at `9a17047b0`. **No new actionable defects established.** This supplements the existing 2026-10-22 audit; it does not create a new audit or repeat checked findings.

## Files Retrieved
1. `.github/workflows/real-host-canary.yml` (lines 1–39): dispatch/schedule entry, checkout fence, provider-secret step.
2. `.github/workflows/publish.yml` (lines 1–201): quality/publish isolation, tag validation, ancestry gate, publication.
3. `scripts/run-tests.mjs` (lines 1–363): packaged imports, stall policy, process containment and settlement.
4. `scripts/slow-files.mjs` (lines 1–38): shipped thirteen-file policy list.
5. `scripts/release-pack-smoke.mjs` (lines 1–208): tarball creation, isolated installation/imports, worker/skill probes.
6. `tests/release-contract.test.ts` (lines 1–300): repaired-seam contracts and surrounding release assertions.
7. `.pi-glla/audit-loop/findings.md` (scoped matching entries, especially lines 1122–1125 and 1153–1155) and `audit/audit-loop-2026-10-22/README.md` (lines 1–75): deduplication and existing repair contracts.

## Key Code
- Canary checkout now uses `ref: ${{ github.event.repository.default_branch }}` (`.github/workflows/real-host-canary.yml:14–21`), not nonexistent `github.default_branch`. This satisfies the recorded default-branch secret boundary (`audit/audit-loop-2026-10-22/README.md:28,73–75`). The regression accepts harmless whitespace and rejects the undefined property (`tests/release-contract.test.ts:81–102`).
- Runner imports `./slow-files.mjs` and exports the actual policy (`scripts/run-tests.mjs:38–43`); packaged import coverage and tarball inclusion are required (`tests/release-contract.test.ts:104–124`). The smoke imports the installed runner rather than the checkout (`scripts/release-pack-smoke.mjs:114–125`). No surviving missing-policy import found.
- Default contention scaling is ceiling-clamped; extension uses `Math.max(limitMs, grown)` (`scripts/run-tests.mjs:99–143`). These match the existing non-shrinking-window repair contract (`audit/audit-loop-2026-10-22/README.md:29`). Explicit operator timeout overrides remain deliberate and are not reclassified as a defect.
- Publication checks tag/version agreement and tag ancestry against `origin/main` before dependency installation and the release gate (`.github/workflows/publish.yml:137–184`). This addresses the already-recorded ancestry finding (`audit/audit-loop-2026-10-22/README.md:30`); no new bypass established in the scoped source.

## Architecture
Quality and release publication use separate concurrency lanes. Release checks operate on the checked-out tag; packed smoke installs the tarball into a disposable prefix, loads installed modules and runs its worker probe in a disposable working directory. Runner policy now travels with its shipped consumer.

## Start Here
`tests/release-contract.test.ts:81–124` contains the explicit repaired-seam expectations, including the corrected GitHub context and shipped import-graph checks.

## Validation and residual risks
- Ran a small Node assertion probe only: corrected canary expression matched; runner imported; all thirteen slow paths exist; sampled stall extensions never shrink; default scaled stall window respects its ceiling. Passed.
- `git status --short` was empty. No repository edits, staging, installs, commits, full suites, or provider calls.
- GitHub Actions execution and npm tarball installation/worker smoke were not rerun. This is source-backed review plus narrow pure-function/import validation, not live release attestation.

BLOCKERS: none

```acceptance-report
{
  "criteriaSatisfied": [{"id":"criterion-1","status":"satisfied","evidence":"Scoped source review and deduplication found no new actionable defects; narrow Node assertions passed and execution limitations are recorded."}],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [{"command":"git rev-parse --short HEAD; git status --short; node --input-type=module (scoped import and policy assertions)","result":"passed","summary":"HEAD 9a17047b0; clean worktree; corrected canary context, runner import, slow paths and stall assertions passed."}],
  "validationOutput": ["PASS: corrected canary expression; runner imports; 13 existing slow paths; stall windows do not shrink; default scaled window respects ceiling. No suite executed."],
  "residualRisks": ["Live GitHub Actions and installing packed smoke were not executed under the read-only/no-install constraint."],
  "noStagedFiles": true,
  "diffSummary": "No repository changes; only the requested external report artifact written.",
  "reviewFindings": ["no blockers"],
  "manualNotes": "Read all six scoped files; deduped against both designated audit records; did not re-report the corrected canary context or other checked repairs."
}
```

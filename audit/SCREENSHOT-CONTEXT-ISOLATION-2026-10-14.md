# Screenshot context-isolation review — 2026-10-14

## Disposition and boundary

The Freeport widget evidence in `Screenshot_20261014_110758.png` references
another project's audit, but inspection shows the displayed text is durable
Freeport builder history (cycle 3 audit report for `bb37eae3-e525-4d84-8a26-9d2a76274d68`,
landing at 06:09:43.062Z in Freeport `.pi-glla/ledger-segments/segment-1791963234186-2113827-nbqpu6jw.jsonl`,
iteration 4 dispatch in the Freeport-cwd session
`S=.../2026-10-13T09-57-53-038Z_01a134b2-750e-71c5-abb2-217a682a1122.jsonl` at
`S:2386`). The screenshot describes historical Freeport state, not a
cross-project contamination.

Two narrowly demonstrated GLLA defects are present in the source as read:

- **Live telemetry isolation key was root-less**: `extensions/respec-builder-ui.ts`
  keyed the in-process telemetry map by `${projectId ?? "legacy"}:${attemptId}`
  only, so two distinct roots with the same copied identity (legacy import or
  UUID clash) shared one entry; clearing either erased the other.
- **Unchanged audit forced a full continuation on every routine retry** and
  **the recovery request cache could be overwritten by a GLLA checkpoint
  prompt**. Scout task-3 enumerated both as `B1` / `B2` against
  `extensions/goal-continuation.ts:1476-1507` and
  `extensions/loops/goal-activation.ts:3477-3483`.

The auto-commit daemon committed a partial scope-key change to
`respec-builder-ui.ts` (commit 5dd3d18f). This session added the
two-root regressions, restored the telemetry lease scope in the existing
display/status tests, implemented the audit-evidence fingerprint dedupe, and
guarded the recovery request capture against GLLA dispatch payloads.

## Screenshot and provenance evidence

| Evidence | Established observation |
| --- | --- |
| `Screenshot_20261014_110758.png` | Freeport footer, increment 4 held, evidence starts with the exact report prefix "Now I have a complete picture. Let me write the audit report. # Audit Report — pi-goal-list-loop-audit (phase2-combat-death + live-defect-repair)" |
| `L:6,8` Freeport ledger | Cycle 3 report for attempt `bb37eae3-e525-4d84-8a26-9d2a76274d68` lands at `2026-10-14T06:09:43.062Z / .077Z`; outcome `needs-work` |
| `S:1` Freeport session header | cwd is Freeport |
| `S:2386` | First matching report-bearing `[LOOP ITERATION 4]` dispatch, persisted in a Freeport-cwd session |
| Current package config | `/home/dracon/.pi/agent/settings.json:28` selects local repository; not historical loaded-attestation |
| Widget source | `extensions/goal-loop-display.ts:3326-3328` picks the last requirement evidence report (array-order) or the latest history report; it does not search other repositories |
| Final auditor cwd | Unverified; the original Freeport auditor job was not present in scoped Freeport session tree |

## Implementation evidence

- `extensions/respec-builder-ui.ts:1-43` — `respecAuditLiveScope` returns
  `{stateDir, cwd, startedAt}` from the configured state root; `key()`
  composes a JSON of `[stateDir, cwd, startedAt, projectId, attemptId]`.
  Two roots with identical identity get distinct keys. A superseded lease
  cannot publish or clear.
- `extensions/respec-builder-runtime.ts:136,153` — runtime captures the
  live scope at dispatch and re-checks `JSON.stringify(scope) === JSON.stringify(liveScope)`
  on every progress/result call, refusing foreign scopes.
- `extensions/loops/goal-ui.ts:891` and `extensions/goal-loop.ts:1598` —
  widget status uses the same scope when rendering.
- `extensions/goal-continuation.ts:1476-1507` — `needsFullContinuation`
  compares the last audit against the in-process delivered fingerprint
  (`{attemptId, revision, reportChars}`). A new full dispatch that included
  the audit updates the fingerprint; the next routine retry is a marker.
- `extensions/loops/goal-activation.ts:3477-3493` — `before_agent_start`
  capture skips prompts whose first line is a GLLA dispatch marker
  (`[GOAL CHECKPOINT goalId=…]`) or whose body begins with the
  `[POST-COMPACTION RESYNC]` sentinel, so a continuation cannot overwrite a
  real captured user request.

## Verification

Bounded isolated tests, each run through the standard runner with the same
outer timeout the CI release check uses. No project writes, no provider
calls, no session reload, no upstream changes.

```sh
timeout 60s node scripts/run-tests.mjs tests/respec-builder-ui.test.ts
# 6 pass, 0 fail
timeout 60s node scripts/run-tests.mjs tests/audit-evidence-continuation-isolation.test.ts
# 3 pass, 0 fail
timeout 180s node scripts/run-tests.mjs tests/respec-builder-audit-runtime.test.ts
# 34 pass, 0 fail
timeout 60s node scripts/run-tests.mjs tests/delta-only-continuation.test.ts
# 6 pass, 0 fail
timeout 60s node scripts/run-tests.mjs tests/respec-builder-display.test.ts
# 1 pass, 0 fail
timeout 60s node scripts/run-tests.mjs tests/project-audit-status-consistency.test.ts
# 3 pass, 0 fail
timeout 300s node scripts/run-tests.mjs tests/compaction-failed-recovery.test.ts
# 11 pass, 0 fail
timeout 60s node scripts/run-tests.mjs tests/continuation-retry-persistence.test.ts
# 8 pass, 0 fail
timeout 120s npm run check
# tsc --noEmit: 0 errors
git diff --check
# 0 diagnostics
```

False-positive check: temporarily reverting the live telemetry key to the
legacy `JSON.stringify([projectId, attemptId])` form made the new two-root
test fail (`live telemetry is scoped to its own root …`, 31.81 ms,
1 fail / 0 pass), confirming the regression is meaningful. The reverted
file was restored before committing.

Total: 72 pass / 0 fail across 8 isolated files plus 3 pass / 0 fail for
the new isolation test and 6 pass / 0 fail for the existing respec-builder-ui
suite. The full test list above is the verification contract for this
list item.

## Residual limits

- The original Freeport auditor subprocess was unavailable; the Freeport
  audit report's exact execution cwd remains inferred (Freeport session cwd
  + dispatched claim), not source-hash-proven. This matches the previous
  Outpost Eden diagnosis.
- The audit-evidence fingerprint is process-scope and cleared by
  `resetContinuationInitialSend`, which is the canonical rebind hook.
  A genuinely fresh process re-teaches the audit through the existing
  `continuationInitialFullSentFor` first-send latch.
- A live-cache collision requires the project identity to be copied
  between roots, which is an unusual but not impossible operational
  scenario. New projects receive a fresh UUID via
  `extensions/respec-builder.ts:41`, so normal use is unaffected.
- The dispatch-payload detection in the recovery request capture is a
  best-effort regex on the dispatch marker and resync sentinel. Future
  GLLA dispatch shapes that omit both signatures will need to be
  classified here to keep the same protection.

## Files changed

- `extensions/goal-continuation.ts` — added `deliveredAuditFingerprints`,
  `__testOnlyRecordDeliveredAudit`, `__testOnlyGetDeliveredAudit`,
  `auditEvidenceFingerprint`, `auditFingerprintEqual`; updated
  `needsFullContinuation`, the dispatch accept site, and
  `resetContinuationInitialSend`.
- `extensions/loops/goal-activation.ts` — guarded
  `before_agent_start` interruptedTurnPrompt capture against GLLA dispatch
  payloads.
- `tests/respec-builder-ui.test.ts` — added the two-root and stale-attempt
  regressions and changed `projectId` to its natural `string | undefined`
  shape to satisfy typecheck.
- `tests/audit-evidence-continuation-isolation.test.ts` — three unit tests
  covering the in-process fingerprint dedupe, the reset hook, and the
  dispatch-payload detection rule.
- `tests/project-audit-status-consistency.test.ts` and
  `tests/respec-builder-display.test.ts` — moved the `startRespecAuditLive`
  lease to outer scope so `finally { telemetry.clear(); }` can see it.

The Freeport and Outpost Eden `.pi-glla` projects were not modified.

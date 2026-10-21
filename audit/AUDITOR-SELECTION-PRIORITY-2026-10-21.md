# Auditor selection priority

## Report and ownership

Operator reports stuck project audits and requires explicit auditor selection to win, with the session model at its own thinking level as the default fallback. The resolver is GLLA-owned (`extensions/loops/goal-settings-ui.ts`). No upstream or machine configuration was changed.

## Root cause and change

The resolver used the recovery selector's current-model exclusion to skip a configured auditor matching the session model. With the default-on `auditorSameSessionSwap`, explicit selection could silently lose to an unrelated configured fallback. A session model explicitly included among fallback refs could also be moved out of its configured position.

The resolver now walks configured refs without excluding the current session model. The legacy fourth argument and saved setting remain readable for compatibility but cannot change priority. The obsolete toggle was removed from the settings menu. Goal, resumed-claim, and project callers no longer pass it.

Order remains primary → explicit ordered fallbacks → automatic session tail, subject to forbidden/unavailable filtering and model deduplication. With no configuration, use the session directly. The automatic tail always retains `session-fallback` provenance, even when every configured model was unavailable, so the existing per-candidate thinking policy uses the session dial. An explicitly pinned session model still uses the configured auditor dial. Runtime retry/backoff and recovery cursors were not weakened or reset.

## Evidence

- `bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/auditor-fallback-unification.test.ts tests/model-picker.test.ts tests/settings-editors.test.ts tests/settings-menu-complete.test.ts tests/auditor-thinking.test.ts tests/auditor-fallback-thinking.test.ts`: **142 passed, 0 failed**. Covers legacy toggle values, bare/qualified session pins, explicit session fallback position, missing/auth-unavailable selection, session thinking, actual fallback-walker launch order, and settings wiring.
- `bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/respec-builder-audit-runtime.test.ts -t 'respec uses the shared bounded retry/fallback policy|real detached protocol approval|actual project lifecycle reaches detached verification through /glla resume'`: **3 passed, 0 failed, 31 filtered**. Exercises detached project approval, fallback cursor persistence, and stalled-project resume.
- Initial `npm run check`: passed after source changes. A later repeat exceeded a 180-second shell bound under host load; no new TypeScript source changes were made between those runs.
- Full `npm test` did not finish within 200-second and 600-second shell bounds. The latter log also contains Bun `EEXIST: file already exists, epoll_ctl` / test-lifecycle errors. A direct project-suite run without the runner's extended timeout also failed on the default five-second budget; those results are not counted as passing. Focused serial runs above supersede that invocation, not the uncompleted full suite.

## Limits

This is a source fix, not a published release or a live-session reload. Existing projects were not modified or claimed recovered. A paused project still needs its normal explicit resume after updated code is loaded. There may be additional causes of stalls beyond this demonstrated priority defect. Full release validation and inventory verification remain unverified.

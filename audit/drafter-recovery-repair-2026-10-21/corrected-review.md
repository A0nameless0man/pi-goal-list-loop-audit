## Review

No issues found.

- **Correct:** Per-switch expectations distinguish native automatic defaults from manual selections; retained overrides and post-await comparisons protect manual thinking during restoration and recovery (`extensions/loops/goal-list-queue.ts:472–526, 636–655, 739–755`).
- **Correct:** Cancellation aborts recovery and serializes restoration behind an accepted pending switch. Generation, API, and live-owner checks fence delayed actions (`extensions/loops/goal-list-queue.ts:454–459, 604–621, 684–694`).
- **Correct:** Original-session thinking inheritance remains separate from configured drafter thinking (`extensions/drafter-model.ts:25–26`).
- **Correct:** Public hooks feed the lease observers with foreign-context and model-selection guards (`extensions/loops/goal-activation.ts:3674–3694`).
- **Coverage:** Behavioral regressions cover manual changes before/after `model_select`, event-less post-await changes, automatic defaults, pending-switch cancellation, and retryable restoration (`tests/list-bare-draft.test.ts:453–533`).

### Verification

Independent command execution was unavailable; supervisor approved static-only independent rehearsal. I read the supplied **supervisor-run** logs:
- Required bounded Bun command: **40 passed, 0 failed**, 58.38 seconds (`/tmp/glla-drafter-revision-required.log`).
- Required bounded TypeScript check: **exit 0**, no diagnostics (`/tmp/glla-drafter-revision-typecheck.log`).

Event-less coverage establishes preservation of observable post-await dial changes, not reconstruction of edits erased without any host event.

No repository edits made. No committed diff was supplied; this reviews the current named source seams.

**Merge verdict: OK with notes** — independent static review completed; execution evidence is supervisor-run.

BLOCKERS: none
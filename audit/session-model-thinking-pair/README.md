# Session model + thinking inheritance

## Contract

With no role model or explicitly configured chain, Designer, Drafter and auditor default to the live session's model **and thinking level**. This is default inheritance, not fallback configuration. An explicit model is selected first and may carry its own thinking override. An automatic return to the session route ignores the role-specific dial. Explicit configured fallback lists retain their order.

## Changes

- Choosing the session entry for Designer, Drafter or auditor clears both model and thinking overrides immediately, without asking for another thinking selection.
- Designer resolution now returns provenance and effective thinking with the selected model. Startup sync, settings resync and goal/task continuation all write that resolved pair, rather than combining the selected model with an unrelated stale Designer dial. An implicit session model need not pass another registry/auth lookup.
- Drafter default inheritance has `session` provenance (not `session-last-resort`); its automatic session routes use the saved original session dial instead of a drafting-specific override.
- Settings show the live session dial even if a role-only stale thinking pin is present. Empty fallback rows distinguish session default from session fallback, and do not show a pinned role's dial beside the session model.
- Existing watchdog, retry budgets, persisted audit cursors and subagent ownership guards were retained, not bypassed.

Designer still preselects an eligible model at registration; its running child is supervised through existing subagent hang hooks, not the detached auditor retry walker. No pi-subagents files were changed. Explicit fallback-only configurations remain explicit configuration; they are not relabeled session inheritance.

## Verification

- `bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/designer-settings.test.ts tests/designer-drafter-policy.test.ts tests/settings-menu-complete.test.ts tests/settings-editors.test.ts tests/model-picker.test.ts tests/auditor-thinking.test.ts tests/auditor-fallback-unification.test.ts tests/auditor-thinking-display.test.ts`: **171 passed, 0 failed**; `focused.log`.
- The session-choice test was strengthened after that run to assert the actual managed Designer file changes from `thinking: max` to `thinking: off` when the session dial changes. Its rerun: **1 passed, 0 failed, 44 filtered**; `session-choice.log`.
- `bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/auditor-stall-watchdog.test.ts tests/subagent-hang-detection.test.ts -t 'worker that never emits a first event|long frozen tracked child requests one bounded'`: **2 passed, 0 failed, 35 filtered**; `watchdog.log`. The auditor fixture is a genuinely silent detached worker and verifies cancellation, timeout classification and scratch cleanup. The subagent test verifies a child-specific bounded abort request, not a real provider recovery.
- `node scripts/generate-inventory.mjs --check`: passed after regeneration.
- `git diff --check`: passed for the current working diff; source edits had already been checkpointed by the sync daemon.
- Full `npm run check`, Bun-hosted TypeScript, and a source-root-only TypeScript attempt exceeded bounded shell budgets (150s/180s) without producing a diagnostic result. **Typechecking remains unverified**, not passing. Full release validation was not rerun.

This is a source/settings behavior change. No release was published, no active session was reloaded, and no existing stalled project was claimed recovered.

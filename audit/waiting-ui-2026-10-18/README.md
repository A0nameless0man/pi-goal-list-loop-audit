# Waiting UI and intentional cancellation — 18 October 2026

The supplied `Screenshot_20261018_165605.png` shows a saved scheduled wait, duplicate verbose reporting, and the misleading red `Error: This operation was aborted` line. This is not a backup repair or a change to the waiting schedule.

## Changes

- The waiting card leads with **Waiting — work saved**, then a readable UTC next check, then an explicit explanation that stopping to wait is intentional and not task failure. Its reason follows that hierarchy. Waiting uses the theme's accent, not failure styling. The active-session/automatic-check condition remains explicit; a progress check is not a completion promise.
- `pause_goal` has compact tool-call/result renderers. A successfully admitted scheduled wait gets a short saved-wait receipt pointing to the canonical card. Expanded arguments/results retain their content. Refusals, partial results and genuine errors are not compressed into success; older hosts without error context conservatively retain the full result. Model-facing execution instructions are unchanged.
- The screenshot exposes the missing cancellation variant: the host can encode its cancellation as `stopReason: error`, not just `aborted`. `isPauseAbortMessage` recognizes only exact cancellation strings for error stops. The public `message_end` hook replaces them with a normal intentional-pause notice **only** after consuming GLLA's current-turn owner/goal marker and matching the current saved pause kind/reason/deadline. A new turn, foreign owner, changed pause, unmarked cancellation, provider failure or extended error description remains visible. A ledger event records the original transport stop classification. No Pi/core files were modified.

## Verification and limits

`tests/pause-wait-ui.test.ts` exercises the registered message hook for both cancellation encodings and preservation of real errors, changed pauses, one-shot markers and turn invalidation. It renders the production waiting card at 40/100 columns with Pi's real dark theme, and executes the registered pause tool before rendering its actual result. Tool rendering tests cover expansion, partial/error results and older-host fallback. Existing owner/goal/foreign-session fences remain covered by `stale-continuation-integration.test.ts`; its old duplicated-reason expectations were updated to the already-adopted canonical-card contract. The admission test now uses the real reminder builder rather than an obsolete stub missing its presentation fields, while retaining refusal/no-side-effect checks.

`tests.log` records 102 passing tests, zero failures across 10 affected/adjacent files. Bounded `npm run check` and `npm run check:inventory` also passed. `capture.ts` reproduces `preview.txt` with the real production reminder renderer; it is a fixture, not a live backup-session screenshot. No provider call, scheduler modification, package release or live-session reload was performed.

The user's global extension configuration points at this local checkout. Reload the affected Pi session to load these changes; an old error already in terminal scrollback is not retroactively erased.

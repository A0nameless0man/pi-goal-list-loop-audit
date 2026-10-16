# Scheduled-wait UI clarity — 2026-10-16

## Observed issue / ownership

`/home/dracon/Pictures/Screenshots/Screenshot_20261016_192551.png` shows
an intentionally admitted wait alongside manual-resume instructions, two
identical GLLA host-abort notices and Pi's red abort transport line. The
screenshot reports v0.39.34; conflicting wait copy also existed in released
v0.39.35. This repair changes GLLA presentation, not Pi's renderer, providers,
wait admission, timer deadlines or an external project's state.

## Repair

- `extensions/action-reminder.ts`: canonical automatic-wait copy explains
  intentional turn termination, names UTC explicitly for ISO Z deadlines,
  retains conditional owned-wake/hold/closed-session caveats, and never makes
  manual resume the next action. Expected-abort disposition is separate from
  the one-shot message-rewrite marker: exact owner, goal, pause kind/reason/
  deadline and turn generation fence it. Turn start/reset clears it.
- `extensions/loops/goal-tools.ts`: tool result and local/external notifications
  reuse the automatic assessment copy. Non-wait/redirect behavior remains.
  Hourly clamp wording says assessment/re-evaluation, not manual intervention.
- `extensions/loops/goal-activation.ts`: matching expected abort is recorded
  once, without redundant notifications after the canonical card. An unmarked
  abort still notifies once and does not retry; new turns or different pause
  snapshots/owners do not inherit suppression. No additional abort/timer/wake
  is created. Unexpected non-abort errors keep their existing handling.
- `extensions/ui-status.ts`: remove the 'next: Next assessment' duplication and
  make UTC explicit. No status/liveness precedence or scheduling changes.
- `CHANGELOG.md`, `docs/RECOVERY.md`, generated runtime inventory updated.

Pi may still render its red transport line. The GLLA card now explains that
an admitted wait intentionally ended the turn; suppressing Pi's own renderer
is outside this repository. No live wake or screenshot verification is claimed.

## Verification

`tests/scheduled-wait-presentation.test.ts` reproduced three failures before
production changes (0 pass / 3 fail in /tmp/glla-scheduled-wait-red.log):
contradictory tool copy, two notices for a matching expected abort, and two
notices for an unmarked abort. The fixture exercises both real host event
shapes: aborted message_end and error-shaped agent_end. A fourth test covers
owner/goal/pause/turn/reset fences after marker consumption.

The final bounded command used `timeout 480 node scripts/run-tests.mjs` on:

```text
tests/scheduled-wait-presentation.test.ts
tests/action-reminder.test.ts
tests/unsupervised-error-retry.test.ts
tests/load-wait-bound.test.ts
tests/stale-continuation-integration.test.ts
tests/ui-status-projection.test.ts
tests/ui-status-runtime.test.ts
tests/ui-status-surfaces.test.ts
tests/glla-status-ux.test.ts
tests/paused-status-action-first.test.ts
tests/paused-overdue-display.test.ts
tests/paused-owner-honesty.test.ts
tests/pause-informativeness.test.ts
tests/pause-message-content.test.ts
tests/pause-redirect.test.ts
tests/pause-decision-interrupt.test.ts
tests/pause-admission-failure.test.ts
tests/wait-overdue-backstop.test.ts
tests/waiting-on-subagent-pause.test.ts
tests/blocked-pause-autoclear.test.ts
tests/behavioral-orchestrator.test.ts
```

**308 pass / 0 fail across 21 files**, exit 0 (290 seconds).
Raw log: `/tmp/glla-scheduled-wait-final-2.log`.
`timeout 180 npm run check`: exit 0 (`tsc --noEmit`), raw
`/tmp/glla-scheduled-wait-types.log`.

The first broader run had 307 pass / 1 fail: T2b required the optional
`compaction_refire` scheduling trace although its real ledger showed successful
same-session recovery and a delivered post-compaction resync. The test now
waits for the bounded real resync event and requires exactly one post-compact
resync send plus the actual goal checkpoint in MockPi's delivered messages.
Existing active-state, interrupt-clearing, stale diagnostics, no-double-grace
refire and visible-recovery assertions remain. No production compaction or
retry behavior was changed. Raw original failure:
`/tmp/glla-scheduled-wait-final.log`.

Final `node scripts/generate-inventory.mjs --check` and `git diff --check`
both passed (exit 0). This is a
local unreleased correction after v0.39.35: no version bump, publication,
external project journal mutation or other session reload performed.

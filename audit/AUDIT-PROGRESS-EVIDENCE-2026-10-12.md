# Audit progress evidence — 2026-10-12

## Scope and observations

This item covers Screenshot_20261012_110726.png (capture-anime-girls),
110723.png (junk-runner), and 110721.png (polis). Native inspection used the
original screenshots and readable bottom crops under /tmp/glla-note-*.
Their cards show counts of finished calls, an activity clock and elapsed audit
age; Polis additionally shows a current bash tool and its timeout budget.
Those facts are useful, but do not tell the user which concrete worker action
last happened. A fresh count/clock is not a percentage of verification work.

Read-only latest-journal inspection found capture-anime-girls still auditing
with a running claim, while junk-runner and polis had active goals with no
pending completion claim at observation time. This does not prove why their
prior audits settled or that any worker is currently alive. Capture's saved
progress artifact contains timestamped read/bash completions and a thinking
phase; its actual completion is not established by this snapshot.

No game project was mutated, resumed, restarted, or tested by this executor.
Saved artifacts are observations, never authorization for external work.

## Source map and root-cause direction

- `extensions/loops/goal-ui.ts:publishDetachedAuditProgress` admits snapshots
  only for the bound generation, goal and claim attempt. It retains tool
  arguments, completion timestamps, current tool start/budget and worker
  activity timestamp.
- `extensions/goal-loop-display.ts:lastAuditorTool` discards the argument
  target and completion timestamp, returning only a tool name.
- `compactAuditingCardRows` exposes total calls/activity/elapsed and tool
  name, but not the latest concrete completed action. Detailed rendering
  exposes more history but also uses the name-only summary.
- Existing phase/liveness and persistence-hold gates must remain authoritative.
  Adding an action row cannot turn old, missing or replaced-attempt data into
  live execution, nor imply tool completion while a bounded tool still runs.

Implement a shared bounded action projection using attributed completion time
and safe basename targets, not arbitrary command lines or report prose.
Retain historical/stale labels, reject mismatched attempt/owner evidence, and
keep stage, tool budget, activity age and next inspection/recovery action
visible across compact/detailed cards and footer. Respect silent report mode.

## Implementation, regression and capture evidence

- `extensions/goal-loop-display.ts` adds a shared `auditorLatestAction`
  projection that reads the most recent completed tool call from
  `AuditDisplayProgress.toolCalls`, filters future/invalid timestamps and
  renders `last action: <name> [→ <basename target>] · <age> ago`. The
  card/footer reuses it through `auditingCardBlock` and the production
  footer. Compact and detailed surfaces carry the row when an
  attributed latest action exists; replaced/legacy or empty evidence
  renders `last: not observed` and a dedicated inspect command instead of
  inventing a target.
- `scopedAuditProgress` rejects audit snapshots whose `ownerKey`,
  `attemptId` or `generation` do not match the current claim, or whose
  context session is not open. This is enforced at both
  `buildWidgetLines` and `buildStatusText` boundaries.
- `compactAuditingCardRows` drops the redundant `last tool:` row when the
  action row already exists, and the widget budget is widened to ten rows
  for the action + tool-budget + inspect combination so narrow terminals
  keep the action visible.
- Holds (supervisor, load, persistence) and gate precedence are preserved:
  `BUILD` tests verify that a `supervisorPausedAt` claim still reads
  `BLOCKED` and the audit footer stops advertising `AUDIT RUNNING` /
  `AUDIT TOOL WAIT`.

## Verification and inspected captures

- New tests: `tests/audit-latest-action.test.ts` (9 cases) — fresh/stale
  completion, current tool budget alongside the last action, missing
  data, replaced attempt, future timestamps, arbitrary command hiding,
  legacy un-stamped snapshots, holds outranking audit live evidence.
- Existing affected tests rerun (37 across 5 files) all pass.
- Reproduction: `timeout 30 bun scripts/audit-action-capture.ts && timeout 70
  python3 scripts/capture-ui-status.py --audit-action` produced
  `audit/audit-action-captures/{40,120,40-detailed,120-detailed}.{ansi,json,png}`.
  Inspected all four real xterm/private-Xvfb PNGs. Fresh progress shows
  `last action: read → Widget.svelte · 8s ago`; stale completion shows
  the historical age (`1m 00s ago`) with `AUDIT UNCONFIRMED` heading;
  bounded tool keeps the elapsed/budget row and a separate last-action
  row; settling claim labels itself `auditor: settling · ...` and the
  footer offers `/goal resume finishes approved settlement`; replaced
  attempt shows no live evidence and a generic inspect path. No
  percentage of work, no invented command content, no claim of
  completion, and no claim that a replaced attempt is alive.
- `npm run check`: exit 0 (`/tmp/glla-audit-action-types.log`).
- Limited scope: only GLLA changes; the new fixture lives in the
  repository; the original screenshot evidence under /tmp/glla-note-* and
  the capture-anime-girls progress artifact remain read-only observations
  and were not used as projection inputs.
Unrelated full-release failures, settlement messaging and blocked-resolution
behavior belong to other items and are not repaired by this item.

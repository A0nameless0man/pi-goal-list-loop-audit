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

Implementation, executable matrix and terminal captures remain pending.
Unrelated full-release failures, settlement messaging and blocked-resolution
behavior belong to other items and are not repaired by this item.

# Pause author and bounded UI follow-up

User correction: the operator did not pause the goal. Screenshot_20261011_134941.png shows an agent `pause_goal` call. A workflow label of `paused` alone does not explain the author, prerequisite, or the effect of resume. Wrapping alone fixes horizontal cuts but can consume the terminal vertically.

## Implementation

- Add durable `Goal.pauseSource` (`agent`, `user`, `system`). Agent pause_tool and user pause_command explicitly record their authors. Transactional updateGoal clears attribution on leaving paused state and resets it to system for new runtime pauses, preventing a later provider hold from inheriting an earlier user's/agent's author.
- The shared status projection filters attribution to known enum values. Legacy absence is unknown, not an inferred user pause. Widgets/footers distinguish `paused by agent`, `paused by you`, `paused by GLLA`, or `paused (source unknown)`.
- Manual blocked goals carry explicit resume semantics: resume retries work AFTER resolving the prerequisite; it does not repair missing evidence or authorize remediation. Decision pauses retain their choice-resolution path. No provider wait is reclassified as a user pause merely for presentation.
- The production widget has both a width and height budget. It reserves headline, next action, reason, resume semantics and inspection path before wrapped continuations, judgment/worker history or generic runtime diagnostics. Compact shared cards default to eight rows; runtime chooses at most twelve and one-third of terminal height. Very small widgets retain the headline/inspection path as space permits.
- Interactive TUI mode now uses a stateless widget component whose render reads current width and terminal rows on EVERY paint, including resize. JSON/RPC/noninteractive bindings retain bounded string arrays. The component owns no timers and changes no durable work. Legacy unbudgeted formatter calls retain compatibility; actual runtime always supplies a height budget.
- Wide action-first footers reserve the pause author context instead of consuming the whole line with action prose. Narrow condensed cards shorten the footer label before truncating its inspection command.

## Evidence and verification

`timeout 240 npm test -- tests/pause-author-and-widget-bounds.test.ts tests/blocked-card-readability.test.ts tests/ui-status-surfaces.test.ts tests/ui-status-projection.test.ts tests/ui-status-runtime.test.ts tests/paused-status-action-first.test.ts tests/pause-admission-failure.test.ts tests/resume-during-recovery.test.ts tests/recovery-owner-fences.test.ts tests/display.test.ts tests/fleet-health.test.ts tests/fleet-malformed-workflow.test.ts tests/terminal-approval-render.test.ts`: **224 pass, zero failures across thirteen files**, exit zero, /tmp/glla-pause-bounds-final.log.

`timeout 120 npm run check`: exit zero, /tmp/glla-pause-bounds-types-final.log.

New tests execute real registered agent/user pause and resume paths, read durable attribution, then verify a provider pause is marked system rather than reusing user attribution. Production card and responsive component tests resize through 200x60, 40x24, 20x12, 8x6, 80x30 and 120x18 with ANSI styling and large blocker/action fields. They assert cell widths and row bounds, preserved critical labels when space allows, inspection command retention, explicit unknown legacy origin and no render mutation. Existing ownership, resume, privacy, cadence/diff and terminal-render checks remain covered. Height-related compact assertions now test an eight-row budget with resume semantics; detailed status still preserves full prose within its larger bounded view.

## Scope and known state

These fixes do not repair or resume the Books goal, change its permissions, modify external project code, or interpret missing cover admissions as proven artwork mismatches. Agent pauses in older saved records without attribution remain explicitly unknown; the screenshot is evidence of that one call, not a basis for guessing the author of every legacy pause.

No source outside GLLA was changed. Host-generated abort errors and third-party terminal widgets are not claimed fixed. This limits GLLA's own widget; it cannot guarantee an entire terminal containing unrelated plugins never overflows. No fresh real-terminal screenshot or full release gate has been captured for this follow-up, and it has not been published.

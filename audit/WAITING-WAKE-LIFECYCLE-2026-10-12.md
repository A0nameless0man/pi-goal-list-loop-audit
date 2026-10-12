# Waiting and wake lifecycle — 2026-10-12

## Incident evidence (read-only)

Native inspection of Screenshot_20261012_015606.png shows chat saying the
render queue is progressing and will auto-wake for verification, while the
widget says `paused by agent · BLOCKED` and tells the user to resume after
the prerequisite resolves. Those are different lifecycle promises.

Read-only inspection of ai-auto-video's latest saved state found:
- status paused, pauseKind blocked;
- pauseResumeAt absent, backgroundWait absent;
- no supervisor/load hold or main-model recovery;
- a suggested action beginning `On next wake`, but no registered wake.

Render evidence observed independently:
- queue log records successful verification of volumes 01 and 02, with
  volume 02 completion at 2026-10-12T01:32:22Z;
- bounded ffprobe reads confirmed durations 3610.58 and 3517.94 seconds;
- volume 03's build_music_video.py and ffmpeg processes were present;
- two observations of its partial output grew from 192151600 to 192675888
  bytes. This records observed output writes alongside running processes,
  not validated content progress, successful completion, or an ETA;
- existing final volume 03/04 files failed ffprobe (`moov atom not found`).

No external journals, processes, render scripts, or project files were
modified. The operating-system load and rendering implementation are not
GLLA repair targets. Continued render progress after these observations is
unknown until fresh evidence is obtained.

## Root-cause map and implementation direction

`pause_goal` saves blocked parks without a deadline; prose such as `On next
wake` does not register anything. A blocked park is therefore truthful about
its saved state but cannot fulfill the assistant's automatic-wake promise.

Existing distinct mechanisms:
- `background-wait-runtime.ts` admits exact observed, owned subagent run IDs,
  persists dependencies, and settles them on events or reconciliation;
- `pause_goal kind=wait resumeAt=...` stores a bounded deadline;
- `goal-heartbeat.ts` checks overdue deadlines and resumes assessment through
  hold, ownership, persistence, and dispatch gates. A restart requires an
  admitted host session; a saved deadline alone is not proof of a live timer.

Use these mechanisms rather than guessing dependencies from text or adding
unbounded shell polling. A scheduled check means re-assess the external work,
not declare it complete. Expose saved deadline, wake ownership, current host
registration/hold evidence, and uncertainty independently.

## Implemented mapping

- `goal-tools.ts` rejects a missing/invalid wait deadline and failed heartbeat
  registration without parking the goal. Explicit time-gated waits remain
  bounded by the existing one-hour agent-wait cap; quota policy is retained.
- `ui-status.ts` projects scheduled checks and owned dependency waits using
  fresh owner/generation-attributed evidence. Holds and terminal states win.
- `background-wait-runtime.ts` retains actual worker `lastActivityAt` samples
  obtained during bounded reconciliation, scoped by wait/run identity. UI
  renders neither read worker files nor refresh worker activity timestamps.
- `goal-continuation.ts` distinguishes overdue assessment checks from model
  recovery: only the deadline elapsed; completed/failed/unknown external work
  must be assessed using fresh authorized evidence.
- `goal-loop-display.ts` uses shared WAITING/RUNNING/BLOCKED/UNCONFIRMED
  semantics, with dedicated check/wake rows and wrapped next actions.
- `action-reminder.ts` conditions wake copy on an admitted host and holds;
  saved deadlines are not represented as completion or a live post-close wake.

## Verification and inspected captures

Commands and retained output:
- `npm run check`: pass (`/tmp/glla-wait-types.log`).
- `npm run check:inventory`: pass after regenerating the tracked inventory
  (`/tmp/glla-wait-inventory.log`).
- Affected-area batch: 261 pass, 0 fail across 14 files
  (`/tmp/glla-wait-area.log`): UI projection/runtime/surfaces/display;
  background runtime/host; overdue backstop; reminder/suggestion admission;
  truthful pause labels; admission persistence failure; quota stand-down;
  recovery ownership fences.
- Restoration/safety batch: 41 pass, 0 fail across 4 files
  (`/tmp/glla-wait-restoration.log`). Includes consent-gated reload, completed,
  failed and missing outcomes, failed durable writes remaining retriable,
  supervisor/load/user holds, replaced ownership and single dispatch.

Capture reproduction:
```
timeout 30 bun scripts/wait-status-capture.ts
timeout 65 python3 scripts/capture-ui-status.py --wait-status
```

Inspected all four real xterm/private-Xvfb PNGs under
`audit/wait-status-captures/`: `40.png`, `120.png`, `40-detailed.png`, and
`120-detailed.png`. Each contains scheduled check, observed background
progress, intervention blocker, stale background activity, and saved check
with unconfirmed wake. ANSI sources and metadata accompany the images.

Findings: check ISO timestamps survive at 40 columns; wake ownership and
assessment guidance wrap rather than disappearing into a clipped tail.
Registered waiting is lavender accent, observed worker progress is green,
blockers/unconfirmed execution are amber, and secondary rows remain grey.
Compact footers and objective summaries may ellipsize at 40 columns; the
card retains the actual check, owner, action and `/glla status` entry point.
Detailed views retain actual activity age and runtime/saved provenance.
No caption treats stale worker activity as proof of a stuck/dead worker.

This is implementation/verification evidence, not terminal audit approval.
No external-project resume, rendering modification, or process mutation was
performed. Actual external completion after the incident remains unknown.

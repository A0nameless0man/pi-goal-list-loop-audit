# Blocked-card compactness — 19 October 2026

## What the screenshot actually shows

`Screenshot_20261019_010941.png` is a **blocked** bucket-qualification list item, not a failed sync daemon and not an automatic wait. Read-only inspection after the screenshot found:

- The ordinary user `dracon-sync.service` is active/running (PID 429684) and still commits/pushes unrelated repositories.
- Its bridge-fixture bucket runner still refuses. The saved goal is task 1 of 3: fixture created; autonomous upload/manifest and independent consumer fetch/fresh restoration remain unverified (`uploadVerified:false`, `restoreVerified:false`).
- The reproduced root cause is the user-manager filesystem sandbox collapsing root ancestors to UID65534, which the ownership validators correctly refuse. The prepared workaround is an administrator-managed system service still running the daemon as UID1000, not as root.
- The system `dracon-sync-operator.service` is inactive/dead. The prepared v8 migration has not been applied. It requires the operator's interactive sudo password; `/list resume` alone cannot progress the acceptance criteria.
- Earlier migration attempts rolled back safely. v7 exposed a post-start identity race; v8 changes readiness to `Type=exec` and has 17 offline tests. That is preparation, not live deployment, upload or restoration evidence.

So the project has made diagnostic/migration progress, but **no progress on the two acceptance tasks that matter to the user**. The UI made that harder to see by repeating long prose in the transcript, permanent card and status segment, then truncating the very path needed for action.

## UI correction

- Compact blocked cards now bound `next` to two lines and `why` to one line below 200 columns (two at very wide widths). The complete action/reason remains in detailed status, the action card expansion and saved state.
- Compact resume is always the one-line `<command>; fix first`, preserving the exact command and prerequisite-first meaning.
- Internal durable/defer selection and compaction/token diagnostics no longer displace the prerequisite on compact user-action cards. Detailed status retains them.
- GLLA's one-line status segment now caps itself at 96 terminal cells even when the caller supplies a wide terminal width or no width. Pi's status bar is shared, so terminal width is not this extension's budget. Slash commands continue to be reserved by the existing narrow-footer logic.
- Successful non-wait `pause_goal` results render `Paused. See the action card.` instead of repeating generic turn-stop instructions. Expanded, partial, older-host and error results retain their original content. Existing current-owner cancellation handling for host `aborted`/`error` encodings is unchanged.

`capture.ts` exercises the production card/footer builders with a representative screenshot-shaped fixture. `preview.txt` contains 40/120/240-column compact output and detailed 120-column output. It is not a live project screenshot and does not prove the already-running dracon-utilities Pi session has reloaded this code.

## Verification

- `adjacent-tests.log`: 220 passed, zero failures across 14 affected/adjacent files.
- `typecheck.log`: `timeout 120 npm run check`, exit 0. `inventory.log`: generated inventory check, exit 0.
- `negative-controls.log`: with current regressions copied onto pre-fix commit `1df136b9` in a disposable tree, the screenshot-shaped card and pause-receipt tests both fail; current source passes. Main source was not mutated for the control.
- The initial focused red log is retained locally at `/tmp/glla-blocked-ui/red.log`; the final adjacent log supersedes it for current-state validation.

No bucket-project files, services, credentials, IAM, daemon state or goal state were modified by this UI batch. No release was published in this batch.

## Exact next project action

Reload the dracon-utilities Pi session after installing/reloading this GLLA change. Then, only when ready to perform the service handover, run the already-prepared v8 lines from `dracon-sync/evidence/bucket-live-qual-2026-10-18/administrator-handoff.md` in that project's terminal and return the complete post-start JSON/result. Do not reboot during qualification: the v8 runtime install is ephemeral while the persistent user mask remains. After a successful handover, resume the list item so the agent can verify the actual service identity/watchdogs, scheduled upload, independent consumer bytes/digest and fresh restoration. A migration receipt alone does not complete the goal.

# Compatibility and execution boundaries

## Supported Pi versions

GLLA supports **Pi 1.x and the later 0.x line**. The declared peer range is
`>=0.84.2 <2.0.0` for `@earendil-works/pi-agent-core`, `pi-ai`,
`pi-coding-agent`, and `pi-tui` — one range covering both the 0.x series and
every 1.x release, so a Pi 1.x upgrade does not make your GLLA install
peer-conflict. Keep the four Pi packages on the same version. TypeBox is
`>=1.3.14 <2.0.0`; Node requires 22.19 or newer.

| Pi line | Status | How it is verified |
| --- | --- | --- |
| 1.4.x | supported | `npm run check` against Pi 1.4.0 (zero errors) |
| 0.99.x | supported | development dependency; full suite |
| 0.84.2 | oldest supported | compatibility CI matrix |

**What "supported" means here.** The peer range states which Pi versions GLLA
loads and runs against; it is not a claim that every intermediate release was
individually tested. The two boundaries (oldest `0.84.2`, current development)
run in the compatibility workflow across Linux, macOS and Windows; releases
between them are covered by the range but are not each certified. Pi 1.x is
covered by a direct `tsc --noEmit` against the published 1.4.0 types, and the
extension API GLLA uses (`defineTool`, `ExtensionAPI`, `ExtensionContext`,
`Theme`, `DynamicBorder`, `getAgentDir`, `loadSkills`,
`createBashToolDefinition`) is unchanged between 0.99.1 and 1.4.0.

**Upgrading Pi within a supported range needs no GLLA change.** The range is
deliberately open-ended at the top of 1.x so ordinary Pi releases do not
require a GLLA release. GLLA stops claiming support only at 2.0.0, where a
breaking API change is expected and the range must be re-verified.

One real adaptation was needed for 1.x: Pi added required `durationMs` and
`outputPad` members to `ToolRenderContext`. No GLLA extension source used them,
so nothing shipped changed — only a test fixture that hand-listed the context
fields had to stop doing that and build the object from the host type instead.

`pi-subagents` is an optional, separately installed companion. GLLA imposes no
companion version pin and does not import it as a runtime dependency. Install
with `pi install npm:pi-subagents`. Development uses an unpinned-range manifest
entry and a lockfile for reproducibility; this release was checked with 0.74.0.
The GLLA tests exercise lifecycle events, persisted status and ownership-fenced
stop handling, plus the installed companion's role definitions. They do not
certify every upstream version or replace a real-host upgrade canary.

The compatibility workflow exercises both Pi boundaries (0.84.2 and the current
development 0.99.1) on actual Linux, macOS, and Windows runners with Node 22.19 and Bun 1.3.14. It checks
TypeScript, competing owner processes, child-tree cleanup, persisted receipts,
archive recovery, and the Node/jiti state singleton. All six lanes passed
[run 36746020362](https://github.com/DraconDev/pi-goal-list-loop-audit/actions/runs/36746020362).
This is boundary coverage, not the entire release suite on every platform.
Linux SIGKILL cases explicitly skip on Windows; these skips do not establish
Windows abrupt-power-loss recovery.

POSIX children use owned process groups; Windows cleanup uses `taskkill /T`
while the leader is identifiable. Linux test cleanup additionally records
process birth ticks and session/group membership to reclaim registered detached
workers after a leader exits. Each launch first publishes an independent
obligation in a sibling `.obligations` directory before reading process identity.
Denied, unavailable or malformed identity retains a failed obligation and stops
only the directly owned child when no group identity has been captured. Proven
already-exited and non-detached children retire that declaration. Failed record writes stop the
known child and propagate a launch error; missing records, failed refreshes and
unreadable configured registry owners make the runner fail and retain evidence.
Successful cleanup removes both directories. Non-detached children remain
covered by their suite group. That detached-worker registry is Linux-specific.
Windows descendant reclamation after an unregistered leader disappears is not
promised; it would require a Job Object or equivalent durable identity seam.
Owner publication retries bounded Windows sharing violations without deleting
the destination. Ownership requires coherent local directory reads and atomic
replacement; network filesystems are outside the contract.

The auditor is a fresh verifier, not an OS sandbox. Mirrored extensions and
bash checks can write files. Use a separate worktree/container and host file
permissions when verification requires stronger isolation. Evidence is untrusted
input; it does not grant authority to change host permissions or external plugins.

## Dependency disposition

The supported update from Pi 0.84.2 to 0.99.1 removed the installed undici and
coding-agent aggregate advisory entries. The full development audit still reports
one affected package, `brace-expansion` 5.0.9, pinned inside Pi's published
shrinkwrap. A GLLA manifest override to 5.0.12 did not replace that bundled pin
and was removed. Raw before/current/after audit responses are retained in
[audit evidence](https://github.com/DraconDev/pi-goal-list-loop-audit/tree/28c9fb1a53ba6d0ac3047cb394052a87acdda96b/audit/improvement-evidence-2026-09-30/).
The production-only audit does not certify host-supplied Pi peers.

This residual is an upstream dependency report, not a demonstrated GLLA exploit.
Disposition: retained and reported; remediation belongs to Pi's dependency
publication. GLLA does not edit installed external packages or force-upgrade the
host. Recheck the raw advisory response when changing the supported Pi boundary.

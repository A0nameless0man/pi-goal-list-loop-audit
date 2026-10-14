# Screenshot pause/abort presentation — 2026-10-14

## Disposition and boundary

The misleading presentation in `Screenshot_20261014_131941.png` had two parts:

- **Host-only red `Error: This operation was aborted` line** beneath the GLLA
  widget. The TUI renders this from the host's own error envelope and is
  outside GLLA's hooks. GLLA cannot suppress the upstream "Error:" prefix
  without modifying the pi transport. This is recorded here as an
  upstream-only limitation per the verification contract.
- **GLLA-side `Why: provider error` and `Goal paused by agent: provider error`**
  labels. The word "provider error" is the deliberate credential-redacted
  display from `extensions/quota-retry.ts:144-164` — the Codex 429 text
  contains "Token Plan" / "credits" markers that `PROVIDER_SENSITIVE_MARKER`
  detects, so the redacted display is a privacy/credential safety behavior, not
  a mislabel. Both the GLLA widget and the action-reminder `Why:` line
  re-use that redaction.

The Page Ninja journal (`/home/dracon/Dev/browser-extensions-shared/extensions/standalones/page-ninja/.pi-glla/ledger-segments/segment-1791991750891-4048996-x7hy27t3.jsonl`)
shows the actual sequence at 12:57:36 UTC on 14 Oct:

1. `context_hygiene_dropped` with `lastError: '429: {"message":"Provider returned error","code":429,…'`
2. `pause_quota_rerouted_to_wait` at `12:57:36.341Z` — GLLA reclassified the
   blocked pause to a wait pause because the 429 carries a quota signal. The
   goal's `pauseKind` changed from `blocked` to `wait`; the saved
   `pauseResumeAt` is `2026-10-14T13:57:36.341Z`.
3. `pause_goal_aborted_turn` with `kind: "wait"` at `12:57:36.355Z`.
4. `unsupervised_error_retry_refused` at `12:57:36.553Z` with
   `reason: "non-recoverable", kind: "non-recoverable",
   display: "This operation was aborted"`. The pre-fix code path did NOT
   include the goal's pauseKind/pauseReason in this refuse record, so the
   audit trail could not distinguish a host abort on a wait-paused goal
   from a host abort on an active turn.

The misleading presentation in the screenshot is the host "Error: This
operation was aborted" line stacked above the GLLA action card. The GLLA
action card itself is accurate; the upstream red line is not GLLA-rendered.

## GLLA-owned fix

`extensions/loops/goal-activation.ts:756-852` — added a new carve-out in
`maybeScheduleUnsupervisedErrorRetry` that fires before the generic
`non-recoverable` branch when:

- the failure classifier reports `non-recoverable` (the bucket for
  "This operation was aborted" and similar host aborts), AND
- the goal is already paused with a `pauseKind` that is NOT `blocked`.

The carve-out records `reason: "goal-paused-host-abort"`, includes the
goal's `pauseKind` and `pauseReason` in the ledger, and emits an
`info`-level `ctx.ui.notify` plus a `notifyExternal` page that names the
pause kind, the saved work status, and the resume command. The notify
text says "the red 'Error:' line is the host's own transport, not a GLLA
retry" so the operator can tell at a glance that GLLA is not the source
of the abort.

The existing `goal-blocked-paused` fence below the new carve-out is
preserved verbatim for backward compatibility with the existing test
contract at `tests/unsupervised-error-retry.test.ts:180`.

The `display` field in the ledger record still includes the original host
text (`This operation was aborted`) for forensics. Only the
operator-facing `ctx.ui.notify` and `notifyExternal` text was rewritten
to avoid echoing the host "aborted" wording.

## Tests

Two new tests in `tests/unsupervised-error-retry.test.ts`:

- `'This operation was aborted' on a wait-paused goal records pause
  context and does not retry` — seeds a wait-paused goal whose
  `pauseReason` matches the Page Ninja 429 quota text, fires
  `agent_end` with `errorMessage: "This operation was aborted"`, and
  asserts:
  - no retry was dispatched (`sentRetries().length === 0`),
  - the refusal is ledgered with `reason: "goal-paused-host-abort"`,
  - the ledger `pauseKind` is `wait` and `pauseReason` matches the
    quota text,
  - the ledger `display` retains the actual host text for forensics
    AND names the pause kind (`paused (wait) …`),
  - the operator notify is `info`-level, names the host's transport
    rather than echoing the host "aborted" word.
- `'This operation was aborted' on an ACTIVE (unpaused) goal does not
  reach the unsupervised-error-retry path` — counterproof: an
  active goal routes through the goal's own turn-handler, so the
  unsupervised lane never sees it and no refuse event is recorded.

False-positive check: temporarily reverting the new carve-out in
`extensions/loops/goal-activation.ts` made the wait-pause test fail
with `the refusal is ledgered` (no `goal-paused-host-abort` event was
emitted). The reverted file was restored before commit.

## Commands and results

```sh
timeout 60s node scripts/run-tests.mjs tests/unsupervised-error-retry.test.ts
# 24 pass, 0 fail (including 2 new tests)
timeout 240s node scripts/run-tests.mjs tests/unsupervised-error-retry.test.ts tests/blocked-resolution.test.ts
# 44 pass, 0 fail across 2 isolated files
timeout 120s npm run check
# tsc --noEmit: 0 errors
git diff --check
# 0 diagnostics
```

## Residual limits

- The red "Error: This operation was aborted" line beneath the GLLA
  widget is host-rendered (pi TUI). GLLA cannot fully suppress or
  rewrite that line without modifying the host transport. The fix
  makes the GLLA-side copy explicit that the red line is upstream, so
  an informed operator can tell the two sources apart. A future host
  change could replace the upstream "Error:" prefix with a non-fatal
  transport indicator; that is a host-side change outside this repo.
- The credential-redacted display "provider error" remains in place
  because the underlying 429 message contains "Token Plan" / "credits"
  markers. The redaction is the correct safety behavior and is shared
  with all provider surfaces.
- The `pause_quota_rerouted_to_wait` reclassification and the existing
  `goal-blocked-paused` fence are unchanged.
- No product code or operator project was modified during the
  investigation.

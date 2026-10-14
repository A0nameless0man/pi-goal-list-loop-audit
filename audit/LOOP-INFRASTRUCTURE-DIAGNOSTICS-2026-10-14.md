# Actual-cause retry diagnostics — 2026-10-14

## Diagnosis and boundary

The auditor rejection was correct. The earlier recovery implementation preserved
supervision, accounting and pacing, but its envelope retained only a broad class.
`runMeasure` discarded exit/stderr/exception and invalid-stdout details; the
project adapter received the actual error but journaled only its class. A passing
recovery test did not establish durable actionable-cause acceptance.

This repair is GLLA-only. No provider outage was induced, external project was
modified, credentials/settings were repaired, goal tools were invoked, or release,
branch, identity or history operation was performed. The repository sync daemon
may checkpoint working-tree edits normally.

## Changes

- `InfrastructureRetry.diagnostic` is optional bounded safe prose, refreshed for
  the current failure, not accumulated. Journal admission and reload sanitizer
  both apply `safeDiagnostic`; unknown fields are still discarded.
- Extracted/enhanced the existing progress-observer bearer/key/token/password
  redactor into `extensions/safe-diagnostic.ts`, shared by retry and progress
  telemetry. It limits processing to 16,384 characters and retained prose to 600
  (160 for telemetry), removes terminal/bidi controls and markup, redacts bearer/
  basic authorization, keys/access/refresh tokens/passwords/secrets/cookies,
  URL userinfo and all query/fragment content (including signed URLs), and PEM.
  It projects only string/Error.message, drops stack frames, projects the message
  from a standalone JSON payload rather than retaining provider objects, and
  omits embedded structured payload tails. Redaction occurs before output
  truncation and is idempotent through repeated reloads.
- Measurement failures retain exit code (or missing-code reason), stderr, absent/
  empty/nonfinite/nonnumeric stdout, and safe executor exception message. Transport
  timeout wording remains visible even under the existing transport class.
- Project auth/config/transport exceptions and detached-worker stall/timeout
  causes are journaled. The pending project production card shows a separate
  cause and absolute retry deadline; status puts the cause before truncatable
  coverage decoration. Metric/audit-loop status and `/loop status` show the cause
  beside retry timing. Pending durable retry takes precedence over stale live
  telemetry, without claiming an active worker.
- Failure counting, exponential pacing, timer ownership, admission, stop/freeze,
  cold-load consent, scope fencing, candidate episode bounds and numeric accounting
  remain unchanged. Broad classification is presentation metadata, not cause
  substitution or a new recovery policy.

## Checked behavioral evidence

Final bounded run: **70 pass / 0 fail**, seven files, 11.05 seconds.
Tracked log: `audit/infrastructure-diagnostics-captures/focused-tests.txt`.
Typecheck: **PASS** (`typecheck.txt` in the same directory).

New/updated tests:
- `tests/infrastructure-retry.test.ts`: legacy re-redaction, idempotence, marked
  secret table including incomplete quoted values, URL/signature/PEM/headers,
  long/control/markup strings, Error.message/stacks, objects and malformed JSON.
- `tests/loop-infrastructure-recovery.test.ts`: real metric AND audit adapters,
  two distinct exit/stderr causes plus empty/missing/nonfinite stdout and thrown
  timeout, actual `readState` journal reload, production status, and recursive
  durable journal/ledger plus notification/display secret absence checks.
- `tests/respec-builder-audit-runtime.test.ts`: real project adapter auth/config/
  thrown transport causes, actual journal reload, production widget/status,
  deadline and durable/display/notification secret absence; real detached stalled
  worker also asserts persisted/rendered cause after reload.
- Existing 2,105-episode metric/audit/project endurance, healthy recovery,
  persistence refusal, load admission, timer fencing and bounds tests pass.

Development checks caught a truncated footer hiding the cause (fixed by moving
cause ahead of coverage) and repeated URL-redaction drift (fixed with stable
plain-prose markers); neither assertion was weakened. Initial capture harness
stub lacked its message-renderer hook and an empty globals file was invalid;
the corrected reproducible command initializes isolated settings to `{}`.

## Reproduction (no live state)

Run from repository root; set globals BEFORE preload/imports:

```sh
GLLA_GLOBAL_SETTINGS_PATH=$(mktemp /tmp/glla-diagnostics-global-XXXXXX.json) \
  timeout 240 bun test --max-concurrency=1 \
  tests/infrastructure-retry.test.ts tests/loop-infrastructure-recovery.test.ts \
  tests/respec-builder-audit-runtime.test.ts tests/respec-builder-ui.test.ts \
  tests/respec-builder-display.test.ts tests/progress-telemetry.test.ts \
  tests/project-audit-status-consistency.test.ts
npm run check
globals=$(mktemp /tmp/glla-diagnostics-global-XXXXXX.json)
printf '{}' > "$globals"
GLLA_GLOBAL_SETTINGS_PATH="$globals" timeout 30 bun scripts/infrastructure-diagnostics-capture.ts
timeout 60 python3 scripts/capture-ui-status.py --infrastructure-diagnostics
git diff --check
git diff --cached --name-only
```

## Current project UI capture methodology

`infrastructure-diagnostics-captures/{40,120}.{ansi,json,png}` are current
production widget/status captures, **isolated fixtures, NOT a live provider
outage or a full Pi viewport**. The script drives the real project retry adapter
with deterministic auth/config errors, persists each to a private temporary
journal, reloads through production `readState`, and invokes production
`buildWidgetLines`/`buildStatusText` at fixed time 2026-10-14T12:00:00Z.
A real xterm rasterizes those ANSI rows on a private Xvfb framebuffer using the
existing capture harness; no AI-generated/mock drawing or user-display capture.
The 120-column PNG visibly places auth/config cause beside retry deadline
2026-10-14T12:00:05.000Z. The 40-column PNG honestly demonstrates truncation;
the full cause remains in journal/status details. Metadata records dimensions,
fixture identity, fixed clock and rasterization method. Temporary project state
is removed. Only isolated temporary global settings are read/written.

Parent native-vision review of the PNGs was requested separately; that review
and the full release gate remain parent-owned, not claimed by this report.

## Residual boundary

Marked credential redaction is not a universal detector of arbitrary unlabelled
sensitive prose. URLs intentionally lose all query/fragment details. Long causes
are bounded; narrow displays truncate and point to details. Prior journals that
already contained raw legacy data are re-redacted in the loaded projection, not
rewritten retroactively. No full >15-minute gate was run by this writer.

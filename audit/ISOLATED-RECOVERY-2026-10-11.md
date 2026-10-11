# Isolated Pi recovery verification — 2026-10-11

## Reproduce

`timeout 120 node scripts/verify-isolated-recovery.mjs`

Run from this repository with its installed development dependencies (Pi 0.99.1). This is a standalone verifier, not a test that recursively launches the suite. It loads the public `extensions/loops/goal.ts` through Pi's resource loader, creates a real file-backed SDK session and runs `/goal start` through the registered command.

The provider is an OpenAI-compatible server listening only on 127.0.0.1 with a dummy credential. HTTP 400 carries the screenshot's hintless `429 Token Plan rate limit reached (2062)` body; this deliberately prevents SDK HTTP retries from inflating the request count. Pi agent/provider retries and compaction are disabled to isolate GLLA's recovery envelope. All primary calls fail, while the configured backup returns a tool call that performs actual fixture work. No external API or credentials are used.

GLLA settings: same-model budget 10, configured fallback fixture/backup, positive retry base 0.0002 minutes, hourly probe disabled. The generic eager recovery floor still produces approximately five-second waits plus continuation dispatch latency; this is not a default long-ladder timing benchmark.

## Observed result

Final invocation exited zero and printed `ISOLATED_RECOVERY_PASS /tmp/glla-isolated-recovery-Pax4Br`.

Session 01a12934-62d0-73ad-850f-381a6bda7060, created 2026-10-11T04:24:21.476Z. Authoritative captured artifacts:

- `audit/isolated-recovery/session.jsonl`: real Pi conversation, model transition and tool execution.
- `audit/isolated-recovery/ledger.jsonl`: GLLA durable state projections and recovery events.
- `audit/isolated-recovery/trace.json`: timestamped provider, session and work checkpoints.

Primary requests: 11 (initial failure plus all ten configured retries), from 04:24:21.658Z through 04:25:21.924Z. First backup request: 04:25:24.446Z. Work checkpoint: 04:25:24.451Z, model backup, durable goal status active. A real model-issued `fixture_checkpoint` invocation writes `work-checkpoint.txt` only after checking the active persisted goal and selected backup model. The fixture then explicitly pauses its own goal, aborts/disposes its own session and closes its server. Zero extension/server errors, one work-tool execution, twelve requests total.

Assertions verify retry exhaustion before fallback, durable recovery probe/fallback events, active supervised work on the backup, and absence of fixture errors. A hard twelve-request cap and immediate tool-error rejection prevent accidental request storms.

## Setup attempts retained honestly

Earlier attempts failed due to harness setup, not production recovery assertions: absent headless UI methods, a proxy that Pi could not copy as enumerable UI methods, and SDK `tools: []` acting as a hard allowlist that hid the checkpoint tool. The final architecture uses a concrete headless UI contract and `noTools: 'builtin'`, which disables built-ins without hiding extension tools. It asserts durable goal admission and checkpoint tool availability before waiting. One failed setup caused rapid backup tool-not-found responses before the twelve-request cap was added; those loopback-only requests incurred no external quota. Failed traces remain under their original temporary roots, not mixed with the successful evidence.

## Scope and limits

No existing Pi session was reloaded, switched, interrupted or edited. No external project code, provider implementation, upstream plugin, credentials or OS configuration changed. All fixture session/workspace/settings files were newly created under one temporary root; only selected synthetic evidence was copied into tracked audit files. Git history was not rewritten.

This proves an actual isolated Pi/GLLA session lifecycle, not recovery of the screenshot's original live session or behavior of a live paid provider. It does not prove long-reset hints, the entire default 24-hour ladder, every fallback provider, or compaction interaction; existing behavioral tests cover those bounded mechanisms separately.

Baseline before fixture work: `timeout 180 npm test -- tests/pause-admission-failure.test.ts tests/same-model-retry-before-fallback.test.ts tests/fleet-malformed-workflow.test.ts tests/context-pressure-recovery.test.ts` exited zero, 54 passed, zero failures (`/tmp/glla-gap-baseline.log`).

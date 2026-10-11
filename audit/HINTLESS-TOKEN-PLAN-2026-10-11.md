# Hintless Token Plan retry — 2026-10-11

Operator screenshot Screenshot_20261011_032621.png shows MiniMax Token Plan error 2062, an unconfirmed retry and 24m25s since host activity. Read-only inspection of the affected deathrun recovery journal confirmed repeated same-model probes followed by scheduled 1h, 4h and 5h waits, not proof of a dead timer. No state or code in that external project was modified.

Root cause: mainModelFailureDelayMs excluded any quota signal from the eager window even without an upstream reset hint. The operator requests bounded aggressive retries followed by configured fallbacks. Hintless rate-limit/plan-quota errors now share the ten-slot 5s eager window and post-window 1m doubling/30m-capped ladder. Existing same-model budget/fallback selection remains unchanged. Auth, billing, user abort and context-overflow behavior stays conservative. Explicit reset hints still win and are capped by the established 5h envelope.

Regression: tests/hintless-token-plan-retry.test.ts uses the field JSON message, checks eager slots 1–10, the bounded later delay, persisted-diagnostic probe parity, exhausted budget, and explicit 3h reset priority. Focused six-file gate: 44 pass, zero failures, /tmp/glla-hintless-retry-final.log. Typecheck passed /tmp/glla-hintless-check.log. Full release gate must be rerun after this policy change; the prior passing 0.39.27 gate predates it.

Installed/loaded version separation matters: screenshot runs 0.39.25. No sessions forcibly reloaded. Release 0.39.27 has not yet been tagged or published.

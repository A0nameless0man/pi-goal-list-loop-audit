# Final change inventory

This list describes the GLLA-owned implementation, tests and supporting evidence for the pointless-pinning repair. The auto-pushing daemon owns source/evidence commits. The frozen baseline is `7ab03c4dcab9fa78daa679be74b7bef14fd167e8`. No external project, runtime setting, pause/wake behavior, existing tag or published artifact is changed.

## Implementation
- `extensions/verification-value.ts` — new shared policy module (executor and reviewer variants).
- `extensions/goal-loop.ts` — prefix the loop and project-builder prompts with the canonical policy.
- `extensions/goal-loop-core.ts` — include the canonical policy in the long-running judgment policy used by drafting, loop execution, continuation and project-builder rendering.
- `extensions/goal-loop-auditor.ts` — include the reviewer policy in the detached completion-auditor prompt.
- `prompts/goal-loop-forever-metricless.md` — clarify that test addition alone is not progress.
- `scripts/check-external-repair-proposals.py` — replace source-string coupling with Python AST structure for the local report validator.
- `scripts/generate-inventory.mjs` — not changed; only regenerated `docs/RUNTIME-INVENTORY.md` to match the post-inventory diff.
- `scripts/verify-test-pin-controls.mjs` — new standalone, opt-in mutation evidence harness. Not imported by the collected suite.

## Tests
- `tests/ci-workflow-concurrency.test.ts` — replace the comment-only assertion, drop CRLF/comment-only lines, extract jobs without enforcing order, and protect the actual tag comparison. Adds 7 specific configuration regressions that must fail.
- `tests/stuck-audit-latch.test.ts` — drop intent-comment and trailing-comment requirements.
- `tests/settings-menu-complete.test.ts` — drop the type-comment line; the actual quiet/count behavior remains in `subagent-display-richness.test.ts`.
- `tests/hourly-quota-probe.test.ts` — drop the `:00:30` docstring requirement; keep timestamp boundary cases.
- `tests/tool-overrides.test.ts` — check accepted settings shape through TypeScript and actual key membership.
- `tests/postaudit-surface.test.ts` — inspect AST conditional bodies, type-accepted fields and key membership; drop comment version, source distance and key-order coupling.
- `tests/long-running-discipline.test.ts` — exercise the fail-closed monitor predicate directly.
- `tests/stall-handling.test.ts` — split per-handler check after the disposable control exposed a coverage gap.
- `tests/delta-only-continuation.test.ts` — replace 15,000-character lower bounds with objective/contract/canonical-policy delivery.
- `tests/pause-message-content.test.ts` — drop the 200-character minimum.
- `tests/verification-value-policy.test.ts` — new: pins policy delivery by identity in the actual rendered prompts (goal, list, metric, metricless, project increment, drafter instructions) and exercises the structural branch harness.
- `tests/harness/source-structure.ts` — new: comment-tolerant AST branch extraction used by `postaudit-surface.test.ts` and `verification-value-policy.test.ts`.
- `tests/context-growth-measurement.test.ts` — intentional rebaseline of the per-payload constant by +1,887 chars / +1,889 UTF-8 bytes / +1,896 serialized bytes. Cardinality, linear growth, provider arithmetic, isolation and shape contracts remain. Provider arithmetic, sample counts and growth multiplier assertions are preserved.

## Supporting evidence
- `audit/test-pinning-2026-10-18/cases.json` — frozen eight-case evaluation set with provenance.
- `audit/test-pinning-2026-10-18/rubric.md` — frozen expected-disposition rubric.
- `audit/test-pinning-2026-10-18/baseline-review.md` — bounded baseline-arm dispositions.
- `audit/test-pinning-2026-10-18/revised-review.md` — bounded revised-arm dispositions.
- `audit/test-pinning-2026-10-18/measurements.json` and `measure-receipt.txt` — independent measurement of the rebaselined constant.
- `audit/test-pinning-2026-10-18/surfaces.md` — instruction reach and authority map (no runtime classifier, scoring tool, schema, settings toggle, persisted gate or completion-state transition added).
- `audit/test-pinning-2026-10-18/inventory.md` — discovery manifest and grouped findings from the read-only inventory reconnaissance.
- `audit/test-pinning-2026-10-18/dispositions.md` — per-finding disposition and preserved contracts.
- `audit/test-pinning-2026-10-18/before-after.md` — bounded before/after evaluation and reconciled gates.
- `audit/test-pinning-2026-10-18/scope-inventory.md` — this file.
- `/tmp/glla-pin-verification/*` — receipts for affected-suite run, typecheck, inventory check, focused runs, mutation controls and the report validator. `/tmp/glla-pin-controls-*/` is the disposable scratch the mutation harness uses; its source copy is removed in `finally`.

## Out of scope (per the goal's boundaries)
- External projects. Hegemon and DB Gateway provide read-only evidence only.
- Pi core, provider, other plugins.
- Runtime settings, pause/wake behavior, tags, releases, published artifacts.
- Scheduled-wait presentation, log capture or test-frequency reduction.
- Any reduction target for test counts, runs, tokens or wall-clock time.
- The historical audit directory under `audit/` was not used as a test root.
- Live workflows and external projects were not mutated. Negative controls used disposable copies, not the live trees.

## Honest limits
- The bounded evaluation cannot generalize to all future agent behavior.
- The baseline arm already distinguished all eight cases; the comparative outcome is a tie, not measured judgment improvement.
- The previous summary fragment warned that some prior user/assistant messages were truncated; this run inspected durable evidence and the disk artifacts rather than depending on transcript memory.

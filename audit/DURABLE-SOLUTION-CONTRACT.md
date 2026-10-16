# Durable-solution contract

Status: implementation design; verification is not yet claimed.
Baseline: 6943a00b1e0b84af574dc5902a7e5556a19815f9, package 0.39.34.
Authority: confirmed local-only goal; preserve unrelated existing repairs.

## Policy and evidence boundary

Prefer an in-scope maintainable root-cause correction. Recording a choice is
not implementing it. A blocked durable correction may justify a bounded,
reversible, tested workaround, with the actual obstacle and durable follow-up
retained. A deferral never silently removes an existing obligation. An agent's
rationale, UI selection, ledger marker, repeated recommendation or passing
build does not establish architectural quality or user-visible completion.
Independent verification must inspect actual behavior and the current contract.

Use one shared typed judgment/evidence policy; persist decisions through the
existing state transaction. Keep recommendations separate from authority.
Evidence supplied by an executor must be labelled as an assertion, not a
host attestation. Preserve the distinction between installed source/metadata,
loaded runtime, and observed successful behavior. No generic prose classifier
can prove these semantic claims; the independent verifier must inspect them.

## Integration map

| Mode/path | Existing entry points | Required invariant |
| --- | --- | --- |
| Goal and list planning | goal-loop-core.ts drafting/policy; goal-commands.ts confirmed tweak; loops/goal-tools.ts task proposals | Preserve confirmed scope; no silent objective/contract replacement during completion. |
| Goal and list judgment | loops/goal-tools.ts record_goal_judgment; goal-loop-core.ts recommendation projection | Validate concrete blocked-workaround facts; store target/revision-bound assertions, never implementation proof. |
| Goal and list completion | task-batch.ts collectOpenTasks; loops/goal-tools.ts complete_goal | A deferral note cannot waive pending committed work; audit always checks the confirmed contract. |
| Goal and list recovery | goal-auditor-hooks.ts stored claim/settlement; goal-loop-core.ts durable state | Restart cannot resurrect a removed exemption or bypass admission. Preserve ownership and revision checks. |
| Metric and metricless loop | goal-loop-forever.ts LoopState; goal-loop.ts user finish/refinement | Retain shared judgment through loop persistence; metric movement is not proof of unrelated implementation obligations. Explicit user stop/finish remains a user action, not independent approval. |
| Project/respec loop | respec-builder-runtime.ts tools/settlement; respec-builder-audit.ts goal adapter | Preserve independent per-increment verification, confirmed refinements and requirement/attempt/revision fences. Carry shared policy into audit. |
| Independent verification | goal-loop-auditor.ts prompt; existing mechanical checks and revision-bound settlement | Asserted decisions/markers/install receipts cannot substitute for inspected root-cause and runtime evidence. Reject missing contract behavior, not unrelated repository debt. |
| Continuation | goal-continuation.ts templates; goal-loop-core.ts policy; loop prompts | Durable-first, blocked exceptions with retained follow-up; no repeated cosmetic patching or scope evasion. |

## Compatibility and lifecycle

Existing states remain readable. Legacy deferral stamps remain historical notes,
not authorization to exempt unfinished work. New judgment facts must identify
the target and contract revision; stale facts may remain visible as history but
cannot authorize current outcomes. Preserve append-only journals, state-write
failure refusals, session/branch ownership, explicit holds and confirmed scope
amendments. Preserve ordinary loop bounds/plateau semantics; do not force goal
completion auditing onto user-directed loop termination.

The complete_goal agent-authored newObjective field must not bypass the existing
human-confirmed amendment path. Confirmed amendments invalidate prior revision
proof and allow fresh verification; no silent removal of acceptance clauses.

## Verification plan

Production-hook temporary-journal tests will cover refused unsupported deferrals,
legacy stamps after reload, protected scope changes, positive confirmed changes,
mode-appropriate judgment, write failures and ownership. Shared evidence tests
must distinguish claims/install receipts from inspected runtime behavior without
pretending to cryptographically authenticate arbitrary repository artifacts.
Run bounded dedicated regressions, types, inventory and full release checks.
Record exact evidence in DURABLE-SOLUTION-VERIFICATION.md before claiming results.

## Boundaries

No publication/version bump, upstream repairs, provider/credential mutation,
external project journal writes or other live-session reloads. No architectural
quality keyword heuristics, automatic consent, deferral-count proof or test/type
bypasses. New verification covers GLLA behavior, not fabricated live deployments.

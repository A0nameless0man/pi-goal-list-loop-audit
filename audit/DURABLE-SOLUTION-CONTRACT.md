# Durable-solution contract

Status: shared typed policy implemented; final full release gate passed (exit 0).
Independent completion approval remains required. The first completion claim
was disapproved; no acceptance criterion was removed. See
DURABLE-SOLUTION-VERIFICATION.md and DURABLE-SOLUTION-RELEASE-2026-10-16.md.
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

`extensions/durable-solution.ts` owns typed judgment and explicit outcome-claim
admission. Goal/loop types persist these executor assertions through the existing
state transaction. New records require a named correction and concrete evidence;
deferred corrections need a typed blocker and follow-up, and actual workarounds
also require safety, rollback and reproducible verification. This admits bounded
work under the contract, never final completion or a task exemption. Keep recommendations separate from authority.
Evidence supplied by an executor must be labelled as an assertion, not a
host attestation. Preserve the distinction between installed source/metadata,
loaded runtime, and observed successful behavior. No generic prose classifier
can prove these semantic claims; the independent verifier must inspect them.

## Integration map

| Mode/path | Existing entry points | Required invariant |
| --- | --- | --- |
| Goal and list planning | goal-loop-core.ts drafting/policy; goal-commands.ts confirmed tweak; loops/goal-tools.ts task proposals | Preserve confirmed scope; no silent objective/contract replacement during completion. |
| Goal and list judgment | durable-solution.ts admitSolutionJudgment; loops/goal-tools.ts record_goal_judgment; goal-loop-core.ts state/markdown | Validate blocked-workaround assertions; persist target/revision, evidence and follow-up, never implementation proof. |
| Goal and list completion | task-batch.ts collectOpenTasks; loops/goal-tools.ts complete_goal | A deferral note cannot waive pending committed work; audit always checks the confirmed contract. |
| Goal and list recovery | goal-orchestrator.ts refuseUnfinishedCompletion; goal-auditor-hooks.ts settlement/recovery | Restart cannot resurrect an exemption. Obsolete settling approvals with unfinished work return to rework (retaining explicit holds), not a false archive-I/O wait. |
| Metric and metricless loop | goal-loop-forever.ts LoopState; goal-loop.ts loopPrompt/user finish; goal-tools.ts refinement/judgment | Persist shared judgments and follow-up; require specific scope consent even with draft auto-accept. Metric movement and user-directed stop/finish are not independent implementation approval. |
| Project/respec loop | respec-builder-runtime.ts tools/settlement; respec-builder-audit.ts goal adapter | Preserve independent per-increment verification, confirmed refinements and requirement/attempt/revision fences. Carry shared policy into audit. |
| Independent verification | durable-solution.ts outcomeClaimAdmissible; goal-tools.ts complete_goal; goal-loop-auditor.ts shared goal/project policy | Explicit installation/journal-marker execution claims are refused before audit, even with no open tasks. Admitted observations stay assertions for independent review. Auditors inspect actual root-cause/runtime evidence, not just populated fields. |
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

Production-hook temporary-journal tests cover refused unsupported deferrals,
legacy stamps after reload, protected scope changes, positive confirmed changes,
mode-appropriate judgment, write failures and ownership. Shared evidence tests
must distinguish claims/install receipts from inspected runtime behavior without
pretending to cryptographically authenticate arbitrary repository artifacts.
Dedicated cases also cover supported inline/workaround admission across goal,
list, loop and project, actual session restore, scope consent, failed persistence
and install-only/synthetic-marker refusal without pending tasks. Run types,
inventory and the full release check; record raw results in
DURABLE-SOLUTION-VERIFICATION.md before claiming completion.

Confirmed task-plan amendments are also supported explicitly via
`propose_task_list(replaceExisting=true)`: old/new committed tasks and retained
objective/acceptance are shown, specific consent is mandatory, history is
retained, and revision proof is invalidated. This avoids trapping a legitimate
human-approved replan while preventing silent task removal.

Continuation prefers the auditor's explicit Required fixes section over broad
word-matching in successful-check bullets. A concrete regression reproduces
and rejects the previous '0 fail' / 'No recursive test hazards' TODO poisoning.

## Boundaries

No publication/version bump, upstream repairs, provider/credential mutation,
external project journal writes or other live-session reloads. No architectural
quality keyword heuristics, automatic consent, deferral-count proof or test/type
bypasses. New verification covers GLLA behavior, not fabricated live deployments.

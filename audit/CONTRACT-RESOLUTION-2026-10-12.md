# Truthful, durable contract resolution — 2026-10-12

## Bounded evidence and ownership

The saved [policy audit](INTERRUPTION-POLICY-2026-10-12.md) records Freeport advice `/goal tweak verification contract ...` despite missing player transcripts and Polis advice mixing rejected pipeline syntax with 20 reported failures against a zero-failure criterion. Those are historical agent claims, not independently rerun external tests. No external journal/goal is amended, resumed, or treated as verified. Missing transcripts cannot be supplied by GLLA.

Public `/goal tweak` (and paused `/list tweak`) replaces objective text plus an optional `Done when:` clause: supplied criteria replace, omitted criteria preserve, a bare marker clears after confirmation. There is no standalone `verification contract` subcommand/flag. `/goal verify` starts/manages an actual completion audit; it neither changes criteria nor proves missing human evidence. The previous enforcement item removed the historical-revision manual verify detour without weakening captured-revision settlement fences.

## Root causes being corrected

The prior textual amendment promotion built an Accept option but only steered its text to the executor and resumed. It did not persist the advertised contract amendment. Extraction could promote a nonexistent numbered item and replace an entire command-containing criterion, discarding the required exit predicate. Command-safe syntax was labeled safe without distinguishing changed coverage from a syntax-only repair. Generic slash options misleadingly said `Accept and run` though they only requested executor follow-through.

## Implemented boundaries

- A concrete amendment proposal is stored with its base contract/revision on the decision hold. The actual picker intercepts explicit acceptance, checks the base, writes the new contract plus one revision bump transactionally, and only then reports persistence and resumes. Objective, task checkpoints and other criteria are preserved. Stale/no-op/failed writes report explicit no-change and do not resume. Decline retains original criteria. Restart retains the proposal, not agent-memory instructions.
- A single backticked command is replaced in-place, preserving predicates/thresholds and surrounding wording. Missing items and identical replacements never offer acceptance. Syntax-only correction is conservative equivalence of quoted literal arguments; changed command coverage (such as removing a test filter) is explicitly a substantive amendment, not proof that the original criterion passed. The decision displays old/new item text. Syntax-safe commands are not automatically authorized waivers.
- Unattended defaults decline and continue against original criteria; no amendment is applied, no human evidence invented. Existing material exceptions stay held regardless of budgets/run-to-done.
- Slash suggestions now say `Request agent to run`, distinguishing instruction delivery from durable command success. Unsupported contract-edit flags, contract-only tweak arguments and verify-with-edit arguments cannot be extracted as executable suggestions. Public tweak rejects misleading standalone contract-edit advice before changing the objective. Identical objective/contract text reports no amendment and does not bump revision.

## Correct repair guidance

For syntax-only rejected shell redirection/pipeline, execute an authorized literal command through the supported verifier and inspect its direct result; do not waive zero failures because a pipeline was rejected. For a substantive conflict, keep the original requirement until the user explicitly confirms a full replacement contract, e.g. `/goal tweak "<existing objective> Done when: <complete revised criteria>"`. Include all criteria to retain, and explain precisely which human evidence/failure threshold changes. A reply of 'amended' alone is not durable state evidence. The new host-managed numbered-command amendment path persists the exact displayed change on actual selection; otherwise report no change. Re-audit revised criteria independently.

## Gates (in progress)

Executable coverage is in `tests/contract-resolution-runtime.test.ts`: goal/list acceptance with preserved work/predicates; decline; restart; real transaction-write failure; stale proposal after independent tweak; unsupported guidance and public no-op tweak; safe unattended decline; syntax-vs-substantive classification. Existing blocked-resolution and suggestion tests are being updated to truthful semantics, not replaced by source-only assertions. Final bounded gate results and independent review will be recorded here before claiming completion.

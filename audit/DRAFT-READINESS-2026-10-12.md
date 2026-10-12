# Draft readiness — 2026-10-12

## Scope and rationale

The confirmed list item targets the audited AI-auto-video, Endless-TD and Hegemon/Hellhunter draft shapes. It does not authorize changing any existing external goal or silently strengthening its acceptance criteria. Before confirmation, GLLA can request correction of supported omissions; after confirmation, arbitrary prose is not proof of missing consent or a semantic contradiction.

The active item's displayed objective itself was truncated at `bookkeeping-only`: the old inline `extractVerificationContract` alternative matched ordinary `verification ...` prose through the later `Done when:` colon. The new explicit-heading grammar preserves that intent while retaining actual inline/line-start contract markers and bare-marker clear semantics. The current active goal was not rewritten by this implementation.

## Implementation

- `extensions/draft-readiness.ts`: typed bounded diagnostics for three narrow, observed shapes. No external action, state mutation or command execution.
  - Direct upload/publish/release/deploy request with empty criteria: request authorized inventory, destination, visibility/publication boundaries and observable evidence. Existing conversation answers should be reused, not redundantly asked for.
  - Exact procedural review objective with implementation-style gates: recover authorized deliverable/provenance or propose genuinely review-only criteria.
  - Exact generated `Fix audit finding:` bookkeeping template: request a finding-specific behavioral/source-integrity gate and appropriate tests/types.
- `extensions/loops/goal-tools.ts`: evaluate before confirmation/auto-accept and before conflict/carryover resolution. Batch assessment completes before any item enqueue/activation. Readiness refusal retains drafting mode so the agent can submit a clarified proposal; existing active/paused work and criteria remain untouched.
- `extensions/goal-loop-core.ts`: tighten both populated and bare inline verification-heading alternatives; ordinary verification prose cannot swallow intent. Decorated `Done when` marker gap is bounded to the established 60 characters.

## Limits

Diagnostics are pattern-based readiness checks, not semantic verification, proof of consent, or a blanket mandatory-contract policy. Ordinary short tasks, implementation of upload functionality, legitimate review deliverables, and administrative commit tasks remain valid. An explicit contract does not prove external authorization; readiness merely avoids the observed entirely empty-criteria request. Text over 64 KiB is outside the diagnostic patterns and makes no claim of semantic readiness. Adding a test word is not proof the eventual implementation passes; independent completion checks remain authoritative.

The checks apply to confirmed drafting proposals, single and batch, not retroactive mutation of existing goals or every direct command/list-add import surface. Expanding admission surfaces and execution interruption enforcement is a separate scope. No failed test waived, external objective resumed, release published, or provider modified.

## Verification

`tests/draft-readiness.test.ts` covers the four named project shapes and valid counterexamples, ordinary verification prose, explicit inline headings and bare markers. Runtime additions in `tests/confirm-draft.test.ts` verify pre-confirmation refusal with preserved existing objective/criteria, revised proposal while still drafting, atomic batch refusal, and auto-accept refusal followed by activation only after a stronger user-visible proposal.

`timeout 120 npm test -- tests/draft-readiness.test.ts tests/confirm-draft.test.ts tests/contract-text-semantics.test.ts tests/suspicious-draft-contract.test.ts tests/goal-loop-core.test.ts tests/drafting-questionnaire.test.ts`: 92 pass, zero failures (`/tmp/glla-readiness-tests.log`).

`timeout 120 npm run check`: exit 0, captured in `/tmp/glla-readiness-types.log`. Runtime inventory regenerated; `timeout 30 npm run check:inventory`: exit 0. `git diff --check`: exit 0.

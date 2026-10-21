# Ten independent Designer and Drafter fallback slots

## Root cause and correction

Both role resolvers capped the combined primary-plus-fallback chain at ten, despite
settings allowing ten alternatives independently. With an unavailable primary and nine
unavailable alternatives, an eligible tenth alternative was discarded and the session
was selected instead (finding 6 in `audit/glla-command-review-2026-10-21/README.md`).

`extensions/designer-model.ts` and `extensions/drafter-model.ts` now cap the fallback
setting before prepending the independent primary. Combined refs retain first-seen
spelling/order and case-insensitive deduplication. No persisted setting limit increased.

Drafter candidate construction additionally deduplicates resolved provider/model
identities (bare-name aliases are not independent attempts), checks forbidden resolved
identities as well as input refs, and does not append a duplicate session route.
Designer already checked both raw and resolved policy refs and selects only its first
eligible model; that behavior is retained.

## Reviewer finding corrected

The independent review found an existing order defect relevant to this contract:
Drafter's shared selector skipped the current session ref even when it appeared
explicitly among configured fallbacks. That behavior is appropriate for main-model
failure recovery, not a drafting lease. The Drafter now walks configured refs without
excluding the current ref. The primary lease shortcut remains; an explicit session
fallback retains its configured position and thinking policy instead of being moved
to the automatic tail. New tests assert both roles select it in order and Drafter
produces `[session, second]` without duplication.

The same reviewer inspected the correction and found no remaining issues
(`review-initial.md`, `review-final.md`). Both reviews are static-only; execution below
was performed by the main agent.

## Requirement-to-behavior mapping

New parameterized tests in `tests/designer-drafter-policy.test.ts`, for both roles:

- Primary plus first nine unavailable alternatives selects the eligible tenth, not
  the session. The complete configured chain retains explicit order.
- An eleventh input alternative is rejected by the independently bounded setting.
- A forbidden tenth alternative falls through to the permitted session; forbidding
  both produces no selection.
- Bare alias and canonical identity resolve to the same model; forbidden canonical
  identity cannot be bypassed using the alias. First eligible ref follows operator
  order rather than registry enumeration order.
- Case duplicates and aliases do not produce duplicate Drafter candidates.
- A configured alias of the session is not appended again as an automatic route.
- Explicit session-model fallback retains its configured position.

Sensitivity/tolerance checks ran in a disposable copy, not live inputs:
restoring the combined cap of ten fails exactly the two tenth-alternative tests
(16 passed, 2 failed); restoring the fix and reordering registry enumeration with an
additional unrelated model leaves the policy suite passing (18 passed, 0 failed).

## Verification

Bounded final checks, after the reviewer-requested ordering correction:

- `timeout 240 bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/designer-settings.test.ts tests/designer-drafter-policy.test.ts tests/auditor-fallback-unification.test.ts`
  — **71 passed, 0 failed**, exit 0 (`required-tests.log`).
- `timeout 240 npm run check` — exit 0, no diagnostics (`typecheck.log`).
- `timeout 240 bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/list-bare-draft.test.ts tests/settings-menu-complete.test.ts`
  — **64 passed, 0 failed**, exit 0 (`adjacent-tests.log`).
- Runtime inventory regenerated; `timeout 30 npm run check:inventory` and
  `git diff --check` passed.

Verified source hashes:

```
b6f27f3ab39d06ba597ffa38a83b68a312f4f4131d50b36969642bdc7f1dd7b8  extensions/designer-model.ts
071bb1a259de78fcfb1430b1d014677ed0e26fdadd8febdddea36876758455d0  extensions/drafter-model.ts
4f47d58457eb1af5cd6a2f4d83a4eb3544123ecb227d23ccf5a50bbf6b5ce943  tests/designer-drafter-policy.test.ts
```

No publication, live session reload or provider requests were performed. Full-suite
execution is not claimed; the queued release-preparation item owns release gates.

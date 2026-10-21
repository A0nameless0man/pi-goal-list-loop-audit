## Review
- Correct: Both roles cap the fallback setting at ten **before** combining it with the independent primary (`extensions/designer-model.ts:54–57`, `extensions/drafter-model.ts:63–66`).
- Correct: Designer checks forbidden input and resolved identity; Drafter does likewise through the selector and resolver (`designer-model.ts:61–64`, `drafter-model.ts:70–78`).
- Correct: Drafter deduplicates resolved model identities and avoids appending an existing or forbidden session candidate (`drafter-model.ts:113–131`).
- Correct: New tests exercise tenth-slot selection, overflow rejection, policy checks, alias deduplication, and session deduplication (`tests/designer-drafter-policy.test.ts:28–92`).

- Finding: **P1 — Explicit Drafter order is not preserved when a fallback equals the session reference.** At `extensions/drafter-model.ts:110`, the selector receives `currentRef`; `extensions/main-model-recovery.ts:359–363` therefore skips that reference. Only a matching **primary** receives special handling (`drafter-model.ts:97–107`).
  - Static repro: primary `test/missing`, fallbacks `["test/session", "test/second"]`, session `test/session`, both models permitted and available.
  - Actual candidates: `[second, session]`; configured order requires `[session, second]`.
  - Smallest fix: walk configured Drafter refs without excluding the current reference, retaining the existing primary lease shortcut and identity deduplication. Add this regression case beside the new order tests.

- Verification: **Static-only**; no shell tool available, so neither requested command was run. Current sources were inspected; the committed delta against `1a8bc89e6` was unavailable, so this finding is not claimed as a newly introduced regression.
- Merge verdict: **BLOCK** against the stated order-preservation contract.

## BLOCKERS
- Preserve an explicitly configured session-model fallback’s position in the Drafter chain.
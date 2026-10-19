# Improvement tasks — project review, 19 October 2026

Audit: [scope, evidence and verification](audit/PROJECT-REVIEW-2026-10-19.md).
All six tasks are implemented. [Implementation and verification](audit/TASKLIST-IMPLEMENTATION-2026-10-19.md)
records the results. Problem descriptions below retain the original audit
baseline and acceptance criteria; they do not describe unresolved current defects.
No GLLA queue was activated or live runtime state changed by editing this list.

## Confirmed defects

- [x] **R2 · P1 · Fence asynchronous update-cache writes against root changes.**
  `extensions/glla-update-check.ts:88–94` resolves the destination again when
  npm closes, without rechecking root readiness. Starting in `sessionDir` mode,
  then losing that session directory before success, creates a fallback
  `cwd/.pi-glla/update-check.json`. Capture the admitted root/session identity
  and decline stale or unresolved completion writes; publish the cache
  atomically. Acceptance: delayed success after a root change, session rebind,
  unreadable selector or unresolved session creates no fallback or cross-session
  cache; a stable root still receives a valid cache. This is a cache-boundary
  defect, not evidence that the goal journal itself moved or lost data.

- [x] **R1 · P2 · Coalesce update refreshes and back off failures.**
  `extensions/glla-update-check.ts:69–85` throttles only on a successful saved
  cache. Five immediate contacts with no cache produce five concurrent children;
  a failed refresh permits another on the very next contact. Track an in-flight
  refresh per admitted root and a bounded retry deadline. Acceptance: repeated
  contacts start one child; thrown spawn, emitted error, nonzero exit and timeout
  release the in-flight obligation while preserving retry backoff; independent
  roots do not suppress one another. Keep prior usable cache contents on failure.

- [x] **R3 · P2 · Check links in every shipped documentation page.**
  `tests/release-contract.test.ts:28` validates links in only five selected
  documents. Four links in other shipped pages target the unshipped `audit/`
  tree (listed in the audit). Replace these with repository permalinks or ship
  selected evidence deliberately, and scan every shipped Markdown document.
  Acceptance: a packed-document link check catches these four cases and a newly
  introduced broken link in another shipped page, while accepting external URLs,
  fragments and packaged directories.

- [x] **R4 · P3 · Make the audit index distinguish current and historical reports.**
  `audit/INDEX.md:10` calls 0.38.106 the current release and later calls September
  entries “Most recent”; the audited manifest is 0.39.39. Link the October 19
  audits and this review near the top, and label old snapshots historically.
  Acceptance: the landing page leads to recent evidence without presenting a
  historical publication as current; avoid claiming registry publication from
  the local manifest alone.

## Maintainability proposals

- [x] **R5 · P2 · Add a registered-runtime durability regression for resume and carryover.**
  Keep the useful focused tests in `tests/resume-admission-failure.test.ts` and
  `tests/carryover-admission-failure.test.ts`; supplement their extracted-function,
  injected-contract checks with a MockPi lifecycle case using real persistence
  and journal reload after a write refusal. Acceptance: refused resume emits no
  success or audit retry, refused clear admits no replacement, and restart/retry
  preserves the committed predecessor archive. This adds integration confidence;
  the existing focused tests do execute production method bodies.

- [x] **R6 · P3 · Retire one coherent group of ambient runtime dependencies.**
  The generated inventory records 179 bridge names; callable bridge slots still
  use `(...args: any[]) => any` in `goal-runtime-globals.ts:205`. Start with one
  subsystem such as update/delivery contact handling or queue admission, pass a
  typed dependency interface, and remove its corresponding ambient slots.
  Acceptance: inventory shows fewer names, removed slots have no remaining users,
  typecheck catches mismatched dependency calls, and relevant lifecycle plus
  Node/jiti singleton checks pass. Keep this incremental; module length alone
  does not justify a broad rewrite.

The next meaningful note section, “suspicious goal”, is also implemented and
verified in the linked report.

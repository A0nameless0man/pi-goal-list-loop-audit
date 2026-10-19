# Task-list implementation and suspicious-goal correction

Scope: all six items in [TASKLIST.md](../TASKLIST.md) plus the next meaningful
section of the transient [note](../note.md), “suspicious goal”, referencing
`/home/dracon/Pictures/Screenshots/Screenshot_20261019_203231.png`.
The note screenshot matches the earlier attached image. Changes belong to
GLLA; the pictured repositories and sync daemon were not repair targets.

## Implementation

| Item | Change | Acceptance evidence |
| --- | --- | --- |
| R2 | Admission captures a root/binding identity; completion rechecks it under a selector snapshot. Cache publication uses complete-temp-file atomic replacement. Session rebinds invalidate work even when the directory is unchanged. | `update-check-lifecycle.test.ts`: unresolved session, different/same-directory rebind, selector change, malformed selector, stable session root and clean publication. Existing owner-protocol tests exercise the atomic writer. |
| R1 | One checker owns a bounded map of pending attempts/backoff per admitted root. Throw, error, nonzero exit, bad output and watchdog timeout retain previous cache and impose a 60-second retry delay. Timeout kills the child and ignores late success. | Same file: five contacts coalesce, independent roots proceed, all four failure paths back off and later retry successfully; stale successes cannot write. |
| R3 | The release contract validates all shipped Markdown pages, with code examples ignored and reference-style links supported. Four omitted audit targets now link to pinned repository evidence. | `packaged-markdown-links.test.ts` and actual npm dry-run validation in `release-contract.test.ts`; restored broken targets fail the negative control. |
| R4 | Audit navigation starts with October 19 reports and labels older snapshots historically. Local version and registry publication authority are explicitly separate. | Read current `audit/INDEX.md`; historical reports themselves remain intact. |
| R5 | New registered-runtime regressions drive real transaction and journal write refusals, disk recovery, fresh session admission and retry. No production persistence contracts are stubbed. | `durable-admission-runtime.test.ts`: refused resume with/without stored claim, preserved journal pause, successful no-claim retry; predecessor archived before a real final-write refusal, queue/held-loop preserved, reload then retry without changing the predecessor archive. |
| R6 | Queue/consume/discard handoff functions now travel through `PendingListOperationsBoundary`; registration and command wiring use the typed object. All three ambient registrations/declarations are removed. Inventory baseline moves from 179 to 176 with rationale. | `runtime-globals-contract.test.ts`: removed names absent, actual functions present, compile-time negative calls rejected; session RPC/restart fixtures and Node/jiti loader remain gates. |
| Note | `Clear` is recognized as an actionable imperative, so failure-count vocabulary in the pictured cleanup objective no longer becomes a verification fragment. Explicit reviewer/evidence/test-result tails remain guarded. | `suspicious-clear-goal.test.ts`: classifier counterexamples and real interviewed auto-accepted draft stays active without a queued repair. Removing only `Clear` makes both tests fail. |

The note entry is drained; durable rationale lives in `docs/DESIGN.md` and
the regression fixture. Its objective excerpt reproduces the screenshot's
visible lead and failure vocabulary; it does not pretend to recover the
truncated remainder of that session's full objective. Existing fragment,
verbatim-user-seed and report-tail rules remain in force. This corrects future
classification; no already-running external Pi session or stored goal was
silently rewritten or resumed.

R5's stored-claim case imposes an explicit supervisor freeze after the refused
write and before reload, keeping the hermetic fixture from launching a real
completion auditor after storage is repaired. The no-claim case exercises
successful real retry. Existing focused admission tests retain their broader
goal/list and partial/committed contract matrix. The carryover fixture creates
a directory at the journal path only after observing an actual terminal commit
through the public repaint callback, restores the saved journal, and checks
replay; the production archive function and filesystem writers remain real.

## Verification

- Focused implementation checks: **95 passed, zero failures across 10 files**.
- Typed handoff adjacent checks: **13 passed, zero failures across four files**
  before adding the additional compile-time boundary assertions.
- `npm run check`: passed, including `@ts-expect-error` negative calls that would
  silently typecheck through the old ambient `any` function signature.
- Four independent negative controls in a disposable copy: coalescing removal
  fails five cases, root-fence removal fails five cases, `Clear` removal fails
  both classifier and draft activation, and restored unshipped links fail the
  actual release contract. These mutations never touched live source.
- Two further admission controls bypass only the resume or carryover durability
  check. Each makes its registered-runtime filesystem-refusal test fail.
- Full `npm run release:check`: running; final result will replace this entry.

Evidence is retained under [tasklist-implementation-2026-10-19/](tasklist-implementation-2026-10-19/).
The source/test/document hash snapshot taken before the full gate
allows detecting intervening changes; tracked audit evidence and task status
are separate from ignored machine-local GLLA runtime state. No release,
dependency upgrade or history rewrite is part of this work.

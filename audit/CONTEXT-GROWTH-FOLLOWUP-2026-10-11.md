# Context-growth follow-up — 2026-10-11

## Scope and new evidence

This supplements `audit/CONTEXT-GROWTH-DIAGNOSTICS.md`; its earlier bounded inspection established 316213 tokens, not a 400k case. This follow-up read two latest Freeport ledger segments and the current active journal, each below 10 MiB (approximately 17 MiB total), plus the 78-byte boundary marker. No external file was modified. Only allowlisted event metadata and collapsed lifecycle projections were copied into `audit/context-growth/freeport-metadata.json`; private objectives, prompts, reports, provider payloads and credentials were excluded. That artifact includes source basenames, byte lengths and SHA-256 fingerprints at inspection time. It is a selected projection, not an entire journal.

Native visual inspection of Screenshot_20261010_195442.png showed Freeport, installed 0.39.24, and a 15.8%/1M footer after approval. It does not show 400k. Screenshot_20261010_125409.png named in historical context is no longer present; no visual claim is made for it. Persisted records below provide stronger timestamped overshoot evidence than those screenshots.

## Confirmed timeline (UTC)

| Time | Observation | Lifecycle/ownership evidence |
|---|---|---|
| Oct 10 05:37:22.754 | Preventive compaction fires at 252717, target 200000 | Actual firing record, not merely a size-based recommendation |
| 05:40:13.388 | Preventive compaction completes | Subsequent usage 64301 establishes a smaller context |
| 12:48–15:00 | 261793, then 305709 tokens | Samples have null goal ownership; no inference of supervised eligibility |
| 16:12:12–16:13:44 | Pressure recovery queues, starts and succeeds at a 344507 sample | Goal 20261010155146-13u7g9; matching session_compact record |
| 17:14:10.017 | 156593 tokens | Smaller context after successful pressure compaction |
| 19:42–23:00 | 215767 through 316213, later 253069 | New goal 20261010191351-v37uto alternates active retries and paused provider waits; recovery remains present in many projections |
| Oct 11 00:31:20.852 | 391031 tokens | State immediately afterward is paused/wait with model recovery |
| 01:02:02.301 | **401044 tokens** | State immediately afterward is paused/wait with model recovery |
| 01:29:18.792 | **430173 tokens** | State immediately before is auditing, with recovery still present |
| 01:35:16.396 | Preventive compaction fires at **430173**, target 200000 | Goal became active immediately before firing; completed marker and firing record agree |
| 01:35:31.359–.373 | session_compact and preventive completion | Durable lastCompactionAt advances |
| 01:37:40.799 | **81796 tokens** | Smaller context after actual compaction |

The new evidence confirms a real 400k-plus Freeport observation and later successful automatic compaction. It does NOT prove that every prior turn offered a safe idle boundary. A durable status of active during retries is not an idle-host observation, and the journal has no matching per-contact idle/pending/API/marker/budget snapshot for every earlier boundary. Reading today's marker cannot establish yesterday's marker state.

## Admission and root-cause disposition

Production admission is `extensions/goal-compactor.ts::maybeCompactTranscriptAtBoundary`: require supervision, no audit/pause/excluded pressure owner, no competing builder audit or claimed failed-request pressure budget, idle host, no pending messages, finite usage, and an available compact API. Boundary failures are one-shot; proven successes rearm after the existing grace/hysteresis checks. Recovery compact-first admission separately honors failure-family exclusions and per-work budgets.

The 200k value is an opportunistic trigger, not a hard transcript or provider-request cap. Auditing and parked provider recovery cannot be interrupted solely to enforce it. Some high samples correspond directly to those lifecycle holds. Unsponsored/null-goal samples also cannot be treated as supervised opportunities. The 430173 firing and subsequent 81796 observation prove that automatic compaction eventually worked in this recorded case.

No NEW GLLA-owned lifecycle defect was demonstrated. We did not weaken ownership guards, compact during audits/pauses, replace unknown usage with guesses, or invent a hard 200k ceiling. Unexplained earlier active contacts remain explicitly unproven because safe-boundary metadata and exact loaded implementation are absent. Installed 0.39.24 shown by a historical screenshot does not prove which version was loaded at every subsequent event.

Previously confirmed defects remain distinguished from this new disposition:

- Failed recovery prompt accumulation: `audit/FAILED-RECOVERY-CONTEXT-2026-10-06.md` documents paired obsolete dispatch/error projection repair. It reduces outgoing provider context without rewriting persisted history; raw host transcript usage may remain high until real compaction.
- Compaction diagnostic selected-owner mismatch: the earlier diagnostics report links the repaired active-loop/paused-goal status projection regression. That was a diagnostic defect, not proof of suppressed compaction dispatch.

## Reproduction and verification

Added `Freeport 401k/430k field samples defer unsafe contacts, then compact at an eligible boundary` in `tests/between-tasks-compaction.test.ts`. It executes production admission with the observed counts: paused/auditing/busy/pending contacts refuse without spending the boundary marker; a later observed-safe contact fires once, completes, and 81796 tokens rearm through hysteresis. This reproduces the gate invariants, not the exact live session or a fabricated historical idle observation.

`timeout 300 npm test -- tests/*compaction*.test.ts tests/*compactor*.test.ts tests/*context-pressure*.test.ts tests/*recovery*.test.ts tests/pressure-budget-late-success.test.ts tests/quota-context-pressure-exclusion.test.ts` exited zero: **390 pass, 0 fail across 34 files**. `/tmp/glla-context-field-regressions.log` retains raw output. Existing success rearming, failed-attempt budgets, provider quota exclusions, settled contacts, pause/cancel and owner-generation cases remain covered.

`timeout 120 npm run check` exited zero (`/tmp/glla-gap-types.log`). No tests were removed, retry/timeouts loosened, or type errors suppressed.

## Remaining and scope compliance

Earlier unexplained eligible-contact hypotheses and other missing 400k screenshots remain unproven, not silently declared fixed. Reproduce those with timestamped owner/generation and boundary admission evidence before assigning a cause; current read-only compaction diagnostics already expose those observations without starting compaction.

External projects, sessions, upstream plugins/providers and OS configuration were read-only/unmodified. No live session reload or history rewrite was performed. Investigation is complete under the confirmed diagnose/fix-or-document contract, not an exhaustive claim about every historical session.

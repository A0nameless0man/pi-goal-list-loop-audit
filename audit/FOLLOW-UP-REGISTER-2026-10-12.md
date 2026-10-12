# Note/history follow-up register — 2026-10-12

## Authority and boundaries

This register reconciles `note.md` with approved local completion records and tracked evidence. It is not a queue and does not activate work. Approval establishes the scoped GLLA fix, not the present liveness or completion of an external project's worker. Historical `Next:` prose is not durable queue state. Completion archives remain unchanged under ignored `.pi-glla/archive/`; reviewable reasoning remains in the tracked evidence links below.

## Every current note report

| Report / original screenshot basename | Disposition | Tracked evidence | Approved completion archive |
| --- | --- | --- | --- |
| Audit not completing / useful progress: `Screenshot_20261012_110726.png` (capture-anime-girls) | GLLA progress presentation addressed. External claim completion remains unconfirmed; historical observation is not a present liveness assertion. | [Audit progress evidence](AUDIT-PROGRESS-EVIDENCE-2026-10-12.md) | `.pi-glla/archive/20261012103036-zh52l9.md` |
| Audit not completing / useful progress: `Screenshot_20261012_110723.png` (junk-runner) | GLLA progress presentation addressed. Evidence observed an active goal without a pending completion claim; no current external outcome inferred. | [Audit progress evidence](AUDIT-PROGRESS-EVIDENCE-2026-10-12.md) | `.pi-glla/archive/20261012103036-zh52l9.md` |
| Audit not completing / useful progress: `Screenshot_20261012_110721.png` (polis) | GLLA progress presentation addressed. Original user observation “polis did clear up” preserved; not an independently verified current external outcome. | [Audit progress evidence](AUDIT-PROGRESS-EVIDENCE-2026-10-12.md) | `.pi-glla/archive/20261012103036-zh52l9.md` |
| Apparently dead auditor / continued waiting: `Screenshot_20261012_110844.png` | GLLA stale-settlement fences and truthful settlement messages addressed; do not infer worker death from inactivity. | [Stale audit settlement](STALE-AUDIT-SETTLEMENT-2026-10-12.md) | `.pi-glla/archive/20261012105405-5wptqd.md` |
| Apparently dead auditor / continued waiting: `Screenshot_20261012_111046.png` | Same approved settlement/recovery scope addressed; obsolete callback activity must not reopen settled work. | [Stale audit settlement](STALE-AUDIT-SETTLEMENT-2026-10-12.md) | `.pi-glla/archive/20261012105405-5wptqd.md` |
| Unclear blocked resolution / suggested question: `Screenshot_20261012_111955.png` | GLLA resolution choices and intentional-pause retry fencing addressed. Vague “could imply other issues” is not evidence of another defect. | [Blocked resolution](BLOCKED-RESOLUTION-2026-10-12.md) | `.pi-glla/archive/20261012115253-bq9m09.md` |
| Suspicious-objective detection: `Screenshot_20261012_130230.png` | GLLA contract-heading false positive and contradictory activation response addressed; genuine review-fragment rejection preserved. | [Suspicious draft](SUSPICIOUS-DRAFT-2026-10-12.md) | `.pi-glla/archive/20261012142459-5g6358.md` |

All seven original absolute screenshot paths are preserved in `note.md`. Every archive above was inspected for `Status: complete` and an approved audit stop reason during this reconciliation.

## Stale history resolved, not reopened

- Audit-progress completion's “next apparent-dead-auditor” and “other two items remain” predate the settlement and blocked-resolution approvals above.
- Settlement completion's “next apparent-dead-auditor” names the scope that completion itself delivered; it is not a new obligation.
- Blocked-resolution completion's “next already-settled goal not retiring cleanly” points back to the earlier approved settlement item.
- Suspicious-draft completion's next step is this reconciliation, not a request to reopen the fix.
- Historical archives are immutable evidence here; their old prose is superseded by this register, not rewritten.

## Separately scoped follow-up candidates — not queued

### F1 — Two audit-widget regression expectations (observed, unfinished)

Current verification from the preceding approved item reproduced two failures in `tests/behavioral-orchestrator.test.ts`: the detached-auditor repaint expects `detached worker` (around line 3872), and cold-start recovery expects `completion audit: parked — no review recorded` (around line 4364). These same assertions fail in a clean pre-fix `git archive 7b703b75` snapshot; they were not introduced by the suspicious-draft fix. Source/evidence: [Suspicious draft verification](SUSPICIOUS-DRAFT-2026-10-12.md), `/tmp/glla-suspicious-extra.log` (197 pass, 2 fail) and `/tmp/glla-suspicious-baseline.log` (154 pass, 2 fail). Logs are machine-local supporting evidence, not the only durable record.

Proposed bounded follow-up: diagnose those two widget expectations against the intended status semantics; fix production rendering if incorrect, or update obsolete expectations with equally strong lifecycle assertions. Do not weaken tests merely to turn them green. Acceptance: the two regressions and affected status tests pass, types pass, and preserved semantic assertions are documented. No implementation or enqueueing in this reconciliation.

### F2 — Aggregate validation / release status (unconfirmed)

Conversation history records a full-suite timeout, not a pass or a test failure. Historical references to “unrelated full-release failures” do not identify a currently verified complete failure inventory. The known F1 failures are explicit; no other current aggregate failures are asserted. A prior post-release record, [Project audit post-release](PROJECT-AUDIT-POST-RELEASE-2026-10-11.md), records a successful release gate at that earlier revision; it does not prove the present tree or npm publication.

Proposed separate verification follow-up: run bounded aggregate validation at a recorded revision, enumerate actual failures or timeout evidence, and inspect workflow/npm evidence only if release verification is authorized. Do not tag, publish, reinstall packages, or claim release readiness as part of this documentation item. Acceptance: a tracked revision-bound report gives commands, raw outcomes, and explicitly distinguishes repository gates from publication/installation evidence.

### F3 — External audit outcomes (unconfirmed, outside this repository's implementation scope)

The original note questioned whether old audits eventually cleared. Approved GLLA UI/recovery work does not prove all original external claims completed. The progress evidence explicitly left capture-anime-girls completion unestablished and observed no pending claim for junk-runner/polis at that time. No fresh external lifecycle inspection was performed in this reconciliation.

If still needed, authorize a separate bounded read-only outcome check of those saved external artifacts. Acceptance: timestamped archive/claim evidence or an explicit unknown disposition for each; no resume, restart, or journal edits. This is a report candidate, not an asserted active incident.

## Reconciliation verification

- Seven screenshot references mapped individually, with four approved archives and four existing tracked evidence records.
- `note.md` separates addressed reports from remaining verification candidates and preserves original paths/observations.
- No source code, external project, archive, runtime journal, release tag, or list entry changed by this documentation reconciliation.
- `git diff --check`: passed (exit 0).
- A bounded Python reference check passed: exactly seven unique absolute screenshot references in `note.md`, each mapped once in the register; all relative Markdown evidence links resolve; all four local completion archives contain `Status: complete` and an approved stop reason. This checks document integrity rather than asserting the original external outcomes.
- Independent fresh-context reviewer `a7551267-3e74-4e71-a3bd-7cf432c1063e` inspected both documents, evidence and all four archives: no findings, contract met, BLOCKERS: none. Review corroborated historical results rather than rerunning aggregate tests; it did not verify publication or external audit outcomes.

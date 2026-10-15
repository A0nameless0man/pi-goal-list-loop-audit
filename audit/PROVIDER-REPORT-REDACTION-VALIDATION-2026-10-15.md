# Provider report redaction validation — 2026-10-15

## Scope and behavioral contract

Preserve substantive completion-audit findings (including requests for user authorization) and ordinary structured test evidence. Keep actual authorization credentials, request IDs and provider payloads private, including multiline and late-in-report cases. Do not weaken short provider-error privacy policy. Other projects are read-only; publication is a later queued item.

## Repair

`extensions/quota-retry.ts`, `sanitizeProviderAuditReport`:

- Report-specific authorization matching recognizes credential assignment/header syntax and Bearer/Basic values, rather than treating the ordinary word authorization as a secret. The short provider-error marker/projection is unchanged.
- Structured keys such as status/message/reason cannot initiate provider redaction without a provider context. Ordinary host/test JSON stays readable.
- A complete-JSON prepass scans exact unquoted delimiter columns before line projection, including transport-labeled payloads and closing delimiters followed by prose. It protects fields preceding the first marker. An immediately preceding provider marker can identify an otherwise unmarked JSON body.
- Split authorization/API-key/request-ID assignments protect the following value; a standalone Bearer/Basic scheme retains ownership of the actual value on the next line. Confirmed payload lines, credential continuation and direct markers remain private regardless of earlier redaction volume.
- Nested JSON candidates recover an independent valid payload after an incomplete earlier excerpt. Provider-prefix context expires after two blank/fence separator lines, so unrelated ordinary JSON evidence is not swallowed.
- Terminal/control-byte sanitization remains in place. Identified malformed/truncated provider-body continuations remain private until a closing delimiter or report heading/fence/numbered-severity-finding boundary. Ordinary structured keys cannot initiate this ownership. A global line-count budget no longer releases secrets from an identified payload; the old exported budget constants remain compatibility/preservation baselines only.

## Regression sensitivity and gates

`tests/provider-report-redaction-budget.test.ts` adds preservation/credential checks plus three hardening cases: leading fields and long JSON, a new multiline payload late in the report, and split authorization values. The three hardening tests were run before the hardening delta: **10 pass / 3 fail** (`/tmp/glla-report-hardening-before.log`); after: **13 pass / 0 fail** within the focused suite.

```sh
timeout 60s node scripts/run-tests.mjs tests/provider-report-redaction-budget.test.ts tests/quota-retry.test.ts tests/audit-history-copy.test.ts tests/audit-evidence-continuation-isolation.test.ts
```

Result: **47 pass, 0 fail**, 4 files, exit 0 (`/tmp/glla-report-validation.log`). Includes provider headers, request IDs, multiline JSON, late credentials, ordinary findings, bounded short provider display, and audit-history/continuation isolation assertions.

`timeout 90s npm run check`: exit 0 (`/tmp/glla-report-types.log`). `git diff --check`: exit 0. After follow-up review, reran the same four-file command: **47 pass, 0 fail**, exit 0 (`/tmp/glla-report-validation-final.log`), and typecheck again exited 0 (`/tmp/glla-report-types-final.log`).

## Historical read-only replay

Read `/home/dracon/Dev/db-gateway/.pi-glla/audits.jsonl`, selected the record at **2026-10-14T20:45:14.504Z**, applied the production sanitizer, and compared all numbered HIGH required-fix lines byte-for-byte. The source project was not changed, reloaded or resumed. No provider call was made.

Safe replay receipt (no raw payload or finding text copied):

- Source report SHA-256: `21f8e9796d45b4b6fd119c7163834bb50ee536ff058673e32080599f48c9d8d7`.
- Numbered HIGH required fixes: **3**.
- All three preserved exactly: **true**.
- Whole report preserved: **true**.
- Initial receipt: `/tmp/glla-report-historical-replay.json`; final post-review-repair replay and synthetic probes: `/tmp/glla-report-final-replay.jsonl`.

Reproduction: import `sanitizeProviderAuditReport` from `extensions/quota-retry.ts` in a bounded Bun invocation; parse complete JSONL records read-only, select the timestamp above, and assert that the arrays of lines matching `/^\d+\. \*\*\[HIGH\]/` before/after are equal and have length three. Emit only count/hash/equality metadata, not the report text.

## Independent rehearsal

Fresh read-only reviewer run `8e1f4b32-7a3a-4539-b903-91a79aca0832` found two valid blockers: split scheme/request-ID values could escape, and an unmatched preceding JSON excerpt could conceal a subsequent complete payload's leading fields. It also identified unbounded blank-line provider-prefix retention. Accepted and fixed all three findings; regression tests cover each, with split values tested both before and after earlier redaction-budget exhaustion. The two initial reviewer-probe tests failed before those repairs (**13 pass / 2 fail**, `/tmp/glla-report-review-findings-before.log`).

The reviewer had no execution tool, so the parent ran its requested bounded commands and synthetic probes and returned raw synthetic outcomes through the supervisor channel. Original rehearsal: 39 focused tests pass, tsc exit 0; the probes confirmed the findings. Final post-repair suite: 47 pass, tsc exit 0. Follow-up read-only review `0ba8ef72-cba6-47b5-b6c4-1abf4273e54e` completed 2026-10-15T09:28:03Z: all accepted findings fixed, historical replay artifacts inspected, no issues found, BLOCKERS: none. The reviewer inspected supplied execution logs but could not independently execute commands; this is independent source review, not a claim of independent test execution. Saved result: `/tmp/pi-subagents-uid-1000/async-subagent-runs/0ba8ef72-cba6-47b5-b6c4-1abf4273e54e/subagent-log-0ba8ef72-cba6-47b5-b6c4-1abf4273e54e.md`.

## Detached auditor objection and durable correction

The detached audit at 2026-10-15T09:31:56Z correctly disapproved a remaining case: after 40 earlier provider lines, a labeled `HTTP 429 response: {` body leaked its continuation because the prepass only recognized line-start delimiters and the fallback budget had expired. The preservation replay and typecheck were already passing; those facts did not establish privacy completeness.

Added regressions covering three transport labels, optional trailing prose, and malformed/truncated labeled bodies. The labeled test failed before its fix (**16 pass / 1 fail**, `/tmp/glla-report-labeled-before.log`); the additional malformed/truncated case failed before replacing budget expiration (**17 pass / 1 fail**, `/tmp/glla-report-truncated-before.log`).

Durable correction: exact-column delimiter scanning replaces line-start candidate recognition. Explicit provider-body/field ownership replaces the global release-after-budget fallback. Scoped bodies remain private to their delimiter/report boundary, while status/reason/message keys alone cannot swallow findings. The short provider-error projection is unchanged.

Initial post-correction checks: **49 pass / 0 fail**, same four-file command (`/tmp/glla-report-owned-payload-tests.log`); `timeout 90s npm run check` exit 0 (`/tmp/glla-report-owned-payload-types.log`); `git diff --check` exit 0. Read-only historical replay still preserves all three HIGH findings and the entire source report. Metadata-only receipt `/tmp/glla-report-auditor-objection-replay.jsonl` also shows accountLeaked=false, organizationLeaked=false and findingPreserved=true for both the auditor's labeled payload shape and its truncated variant.

The follow-up reviewer confirmed the original privacy repro was closed but found a preservation blocker: a completed body followed by an unmatched annotation `[` caused whole-line fallback depth to swallow a following numbered HIGH finding without a heading. A new regression reproduced this (**18 pass / 1 fail**, `/tmp/glla-report-annotation-before.log`).

The final architectural correction resolves ownership only once, in the exact-delimiter prepass. Known provider bodies (including malformed/truncated ones) are marked through their closer or report boundary; complete unmarked JSON can acquire ownership from a later sensitive field. The line projector no longer maintains a competing JSON-depth machine. Consumed markers cannot reopen a trailing annotation or claim an unrelated subsequent example. Regressions include single/multiline bodies, a last-field provider marker, an earlier incomplete excerpt, and a bare provider line immediately before a numbered finding; none insert a heading that could hide the defect.

Post-boundary checks: **50 pass / 0 fail** across the same four files (`/tmp/glla-report-exact-boundaries-tests.log`); `timeout 90s npm run check` exit 0 (`/tmp/glla-report-exact-boundaries-types.log`); `git diff --check` exit 0. Read-only replay `/tmp/glla-report-exact-boundaries-replay.jsonl` confirms 3/3 HIGH findings preserved and whole-report equality, with metadata only. Follow-up review confirmed the annotation blocker closed, then found a further prefix-handoff defect: a next-line `response: {` did not inherit the pending provider marker. This was reproduced before repair (**19 pass / 1 fail**, `/tmp/glla-report-prefix-label-before.log`). The ownership handoff now accepts an anchored syntactic key/value label (including multiword transport labels) only when a provider prefix already exists; labels cannot initiate ownership independently. Explicit numbered severity findings also terminate truncated ownership/pending fields, just as report headings do.

Added a preservation/privacy matrix for six labels, complete/truncated bodies, direct and blank/fenced handoffs, and unmarked controls. Post-handoff checks: **51 pass / 0 fail** (`/tmp/glla-report-label-handoff-tests.log`), `timeout 90s npm run check` exit 0 (`/tmp/glla-report-label-handoff-types.log`), `git diff --check` exit 0. Metadata-only historical replay `/tmp/glla-report-label-handoff-replay.jsonl` still confirms whole-report equality and all three HIGH fixes preserved. Final follow-up read-only review `0fef9822-dc64-4a3e-8486-07445aad459c` completed 2026-10-15T09:48:05Z: all accepted blockers closed, no issues found, BLOCKERS:none. It inspected current source, matrix and supplied logs/replay metadata, without independent command execution. Saved result: `/tmp/pi-subagents-uid-1000/async-subagent-runs/0fef9822-dc64-4a3e-8486-07445aad459c/subagent-log-0fef9822-dc64-4a3e-8486-07445aad459c.md`.

## Falsification round — internal truncation and canonical MED findings

The detached audit at 2026-10-15T09:52:10Z independently passed the prior labeled-body repro and verification gates, but its falsification round correctly found two additional defects: an unclosed JSON object with an internal status marker did not acquire ownership, leaking account/organization fields; and a numbered `[MED]` finding was consumed because the boundary only recognized `[MEDIUM]`.

Both regressions were added before repair and failed (**20 pass / 2 fail**, `/tmp/glla-report-falsification-before.log`). The first correction promoted open candidates on an internal marker after supplying missing container delimiters (and omitting a comma awaiting another field); this was subsequently superseded by the prefix grammar below. This establishes privacy before closing delimiters arrive and protects fields before and after the marker. Invalid earlier prose candidates do not pass validation. The boundary includes canonical HIGH/MED/LOW severities as well as the previously supported MEDIUM/P0–P3 aliases.

Regression matrices cover object/array/nested candidates, earlier incomplete excerpts, internal status 429/503 and nested error markers, EOF/report-heading termination, and every severity with plain/bold finding syntax following a truncated body or pending credential. Intermediate gates: **53 pass / 0 fail** across four files (`/tmp/glla-report-falsification-fixed-tests.log`); `timeout 90s npm run check` exit 0 (`/tmp/glla-report-falsification-fixed-types.log`); `git diff --check` exit 0. Metadata-only read-only replay `/tmp/glla-report-falsification-fixed-replay.jsonl` again confirms all three historical HIGH findings and the entire source report preserved. Follow-up review confirmed these two repros closed, but correctly found that container-only completion still rejected a legitimate prefix truncated inside its marker-bearing string. That repro was added before repair and failed (**22 pass / 1 fail**, `/tmp/glla-report-string-prefix-before.log`).

Rather than guessing more suffixes, `extensions/json-container-prefix.ts` now implements an iterative JSON-prefix grammar, accepting unfinished strings/escapes (including partial Unicode escapes), keys, literals, numbers and containers while rejecting invalid tokens, prose and trailing content. Ownership promotion uses this recognizer; it never emits payload content. `tests/json-container-prefix.test.ts` checks every truncation of representative valid JSON and explicit invalid/prose cases. The integration regression checks leading-field privacy for unfinished strings/escapes at EOF and before headings.

Final grammar gates: **57 pass / 0 fail**, five files, via `timeout 70s node scripts/run-tests.mjs tests/json-container-prefix.test.ts tests/provider-report-redaction-budget.test.ts tests/quota-retry.test.ts tests/audit-history-copy.test.ts tests/audit-evidence-continuation-isolation.test.ts` (`/tmp/glla-report-prefix-grammar-tests.log`); `timeout 90s npm run check` exit 0 (`/tmp/glla-report-prefix-grammar-types.log`); `git diff --check` exit 0. Metadata-only replay `/tmp/glla-report-prefix-grammar-replay.jsonl` again preserves all three historical HIGH findings and whole-report equality. Final read-only review `1d2a4e1d-df5e-49c5-9975-77fe9b6b150f` completed 2026-10-15T10:02:19Z: all accepted blockers closed, grammar and integration coverage inspected, no issues found, BLOCKERS:none. It reviewed supplied execution/replay logs without independent command execution. Saved result: `/tmp/pi-subagents-uid-1000/async-subagent-runs/1d2a4e1d-df5e-49c5-9975-77fe9b6b150f/subagent-log-1d2a4e1d-df5e-49c5-9975-77fe9b6b150f.md`.

## Boundaries

No external project state changed. No release performed. This item does not alter provider retry cadence or waive semantic audit objections; it makes those objections inspectable without exposing provider credentials.

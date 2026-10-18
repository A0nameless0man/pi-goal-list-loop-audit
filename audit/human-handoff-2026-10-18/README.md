# Human-facing handoffs — 18 October 2026

## User outcome

Completion messages should explain the result. A pause should explain what is preventing progress and what the person must do. A wait should explain the condition and next progress check, without promising completion. Investigation history belongs in supporting detail, not a repeated wall in the card, notification and footer.

The three supplied screenshots motivated this change. Read-only samples from Football Forever (2,577-character pause reason), DB Gateway (198-character reason plus verbose scheduler copy) and GLLA's completion archive established that both authoring and rendering needed correction. No external project files were changed. Football Forever's contradictory human-score instructions/verifier remain that project's separate issue.

## Implementation and boundaries

- `extensions/human-handoff.ts` supplies the shared authoring policy, safe marked previews, explicit UTC time formatting and compact summary projection.
- `complete_goal` and `pause_goal` registrations carry the policy. The continuation prompt distinguishes a human explanation from proof and gives concrete pause handoff guidance.
- Completion chat/transcript preserve useful supplied fields from incomplete recaps rather than replacing the human explanation with telemetry. Previously persisted system fallback templates are recognized on replay. A genuinely missing result is named as missing, not inferred from the objective, file writes or approval.
- `Evidence` remains in the durable archive, not the default change story. Tests/gates remain archive-only unless explicitly requested. Independent review and the strict six-label durable resolver are unchanged.
- The terminal summary renderer shows a small set of primary changes and a short structured-result preview. Expansion retains the complete saved message. User actions and Remaining are not clipped by this projection. Canonical review qualifications, challenge/count trailers, record links and following extras survive even a Summary-only body.
- Pause cards preview legacy long reasons; expansion retains the reason and diagnostics. Exact concrete actions and consent-sensitive tweak questions remain intact. Generic resume-only historical actions do not become invented prerequisites.
- Pause emits one canonical transcript card instead of also echoing the whole reason in a notification. The intentional-abort notice points to that card. External notifications retain the required action using the framed presentation, not an unframed command.
- Compact footers bound repeated reason prose and prioritize the action. Detailed status retains a larger view and the same inspection path. Next-check dates are readable UTC; live automatic checking still requires fresh, exact-owner heartbeat evidence. No scheduler, pause admission, provider sanitizer, audit gate or recovery state transition was changed.

These are previews and writing instructions, not an automatic natural-language paraphraser. A legacy report whose first clause is technical is not magically rewritten; omissions are marked and detail is accessible. This avoids inventing outcomes or silently interpreting permissions. Existing privacy sanitization can still generalize a provider-sensitive reason; it was not weakened to make a test read better.

## Evidence

- `capture.ts` exercises the production reminder and summary renderers at 100 columns, using Pi's real dark theme. `rendered-examples.txt` contains default and expanded representative messages. These are executed renderer fixtures, **not** a live project-session acceptance run.
- `initial-review.md` is the fresh-context read-only review. Its two accepted findings were fixed: Summary-only bodies cannot swallow receipt trailers; external blocked notifications retain the concrete action. The reviewer was capability-restricted and inspected parent-supplied diffs/logs rather than running shell commands itself.
- `tests/summary-renderer.test.ts` builds a real structured Summary-only completion receipt and renders it collapsed/expanded, checking the no-review qualification, record link and trailing inspection pointer.
- `tests/human-handoff.test.ts` executes the registered pause tool, verifies one canonical card, full saved action/state and external notification action. It also covers long legacy reports, persisted fallbacks, missing results, footer projection, policy registration, safe text and code-fence handling.
- `negative-controls.log`: in a disposable copy only, removing the trailer fence and removing the external action causes the two dedicated integration tests to fail (exit 1, two failures). Main source was not mutated for these controls.

## Verification

- `final-tests.log`: 344 passed, 0 failed across 25 affected/adjacent files; bounded runner exit 0. Includes pause/abort identity fences, liveness/owner evidence, archive/outbox delivery, latest-claim ownership, durable judgment, loops and context measurements.
- `typecheck.log`: `timeout 120 npm run check`, exit 0.
- `inventory.log`: `timeout 60 npm run check:inventory`, exit 0 after regenerating the runtime inventory for the new helper.
- `context-measurements.json` records the actual continuation payload and 0/1/5/12/25-message measurements. The handoff prompt adds 788 characters, 784 UTF-8 bytes and 788 serialized bytes to each payload. Exact snapshots were deliberately refreshed; cardinality, linear growth, checkpoint flatness and provider arithmetic checks remain.
- `baseline-context-tests.log`: an isolated `09be4350` tree already failed the checkpoint-byte snapshot (31,547 actual vs 29,651 expected), while its growth fixture passed. The missing 1,896-byte prior-policy refresh was separate from this change's 788-byte delta. Current projected size is 32,335 for all three history sizes, retaining the same four-message/two-GLLA-message bounded shape.

No npm release, package installation, existing terminal archive rewrite or live-session reload was performed. The running sessions need to reload GLLA to pick up the changed renderer and tool guidance. Human readability is supported by the concrete rendered examples and retained evidence—not claimed as a measured production-agent improvement.

## Review

- Correct: Completion fallback handling separates human prose from recorded telemetry without changing the durable resolver (`extensions/completion-summary.ts:1322–1349`). Partial recaps retain useful supplied fields; missing outcomes receive an honest explanation.
- Correct: Pause reasons and diagnostics remain available in details and expanded rendering; concrete actions and tweak-consent questions remain separate (`extensions/action-reminder.ts:166–205, 258–280, 309–323`).
- Correct: Scheduled-wait status still requires fresh, owner-matched heartbeat evidence before claiming automatic checking (`extensions/ui-status.ts:176–194`). The supplied diff does not change scheduler dispatch or independent-audit admission.

### Finding: P1 — Compact Summary can swallow approval and saved-record trailers

**Location:** `extensions/human-handoff.ts:50–55`; invoked by `extensions/summary-renderer.ts:86`.

The Summary branch consumes every subsequent nonempty line until another recognized section heading appears. After two content lines, it discards everything—including canonical approval, audit-count/disclosure, and record-pointer trailers.

This is reachable when a structured Outcome has no Changed, Remaining, Verification, or Next section. The composer permits that shape (`extensions/completion-summary.ts:1088–1118`), then appends trailers without a new section heading (`:1395–1408`).

**Bounded repro:** Pass this string to `compactHumanSummary`:

```text
## Done — Updated labels

Summary
Readable labels.
**Details**
First supporting paragraph.
Second supporting paragraph.

• completed without a recorded completion review.
• record: saved.md
```

Both trailer lines are omitted by the Summary counter. Expanded rendering retains them, but the default card conceals the review qualification and direct saved-record link.

**Smallest fix:** End Summary compaction before canonical receipt trailers, preferably by compacting structured body sections before appending trailers. Add a real-builder/renderer regression with structured Outcome and all other recap fields `none`.

### Finding: P2 — External blocked notifications no longer include the next action

**Location:** `extensions/loops/goal-tools.ts:3103–3104`.

The replacement external notification includes only heading and reason, whereas the previous notification included `safePauseAction`. This removes useful instructions even when both fields are short; there is no expansion or status pointer in the external payload.

**Bounded repro:** Pause with reason `Browser authorization is missing.` and suggested action `Run /chrome authorize, then reply here.` The external notification is only:

```text
Your help is needed: Browser authorization is missing.
```

The exact authorization action disappears from that surface.

**Smallest fix:** Include `reminder.presentation.next` after the short reason, or provide an explicit instruction to open the session’s action card. Preserve question framing for consent-sensitive suggestions.

### Verification

- Reviewed parent-supplied `/tmp/glla-human-handoff/review.diff`, representing the requested comparison against `09be4350`, including working-tree changes. Captured HEAD: `8f5be643a208845598c93fe864d559c9ee35a690`.
- Parent-provided execution evidence: requested bounded five-file test command exited 0; **44 passed, 0 failed**. Log inspected at `/tmp/glla-human-handoff/reviewer-requested-tests.log`.
- Tests were not executed directly by this read-only reviewer. The two cases above lack coverage in the inspected suite.
- No files edited.

**Merge verdict: BLOCK**

**BLOCKERS: Compact Summary can hide canonical review qualifications and saved-record trailers.**
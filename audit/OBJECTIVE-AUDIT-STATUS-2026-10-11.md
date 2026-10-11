# Objective type, audit progress, and color consistency

## Screenshot-to-source investigation

- `Screenshot_20261011_165932.png`: project-building loop is labelled `Project · Auditing`; neither heading nor footer makes the containing Loop explicit. An in-budget bash audit tool is visible, while the footer says EXECUTION UNCONFIRMED. Host admission and detached audit progress are distinct observations; presenting either without its owner confuses the two.
- `Screenshot_20261011_193429.png`: explicit warnings say goal persistence was incomplete and the auditor recovery cursor could not be saved. The agent nevertheless narrates a settling detached audit. The visible card says parked/no review. This is a persistence-stop report, not evidence of unavailable provider quota or a running auditor. Preserve the storage safety hold; fix presentation precedence, not retry around the failure.
- `Screenshot_20261011_214907.png`: running audit header is green, compact audit description is purple, and structural branches vary between green, plain and gray. These are separate renderer decisions about the same state.

## Owned source paths

- `extensions/ui-status.ts`: pure workflow/host evidence projection. Persistence holds take precedence, but detached audit evidence is not part of this projection.
- `extensions/goal-loop-display.ts`: heading uses `uiStatusTone`; compact audit row hardcodes accent; full audit uses `auditorPhaseTone`; footer independently derives another phase color. `buildStatusText` routes a live audit object to the legacy audit footer before the shared status footer, potentially hiding shared persistence/hold precedence.
- `extensions/respec-builder-ui.ts`: detached project-audit observation registry and in-budget tool wait telemetry. Project builders are a kind of Loop, not a separate execution owner.
- `extensions/loops/goal-ui.ts`: supplies scoped runtime observations and registers the responsive production renderer.

## Implementation invariants

1. Always name Goal, List item, or Loop; a project builder is labelled Loop / Project.
2. Host liveness is not detached auditor liveness. An audit state uses attributed worker evidence and durable lifecycle, not recent parent activity alone.
3. Persistence stops and explicit holds outrank running claims, even with a cached progress object. Do not bypass dispatch safety or invent storage repair.
4. One semantic audit tone across heading, activity label and footer. Structural branches and ancillary facts are neutral; color is accompanied by state text.
5. Retain elapsed time, activity age, tool budget and inspection/action within bounded cards. No progress percentage based on unknown work volume.
6. Regression tests must cover live, tool-wait, stale/stalled, workerless, and persistence-stopped states, plus narrow/wide production captures.

## Implementation progress

- Persistence/explicit blocked projections now outrank cached audit and background renderers on both card and footer. Regression exercises fresh cached worker progress alongside a persistence hold without mutating the saved claim.
- `projectDisplayStatus` keeps detached audit liveness separate from busy parent-host activity. Goal and project audit heading/phase/footer now share running, tool-wait, quiet, stalled and unconfirmed semantics.
- Project observation and legacy status use `respecAuditObservation`, including future-timestamp rejection and in-budget tool-wait handling. Project elapsed and activity facts have separate rows so they survive narrow layouts.
- Project builders are explicitly `Loop / Project`; plain legacy loops also show `LOOP`. Structural tree prefixes are neutral; semantic labels retain phase colors.
- New tests: `audit-persistence-status-precedence.test.ts`, `audit-status-color-consistency.test.ts`, `project-audit-status-consistency.test.ts`.
- Independent fresh-context reviewer identified two blockers: the narrow project timeout was clipped, and stale worker snapshots retained an automatic-review action. Both were accepted and fixed: short dedicated tool budget row, prioritized audit facts, and explicit unconfirmed inspection action/footer.
- Follow-up reviewer (`1fe62873-6f08-4f37-97d1-0cd1e0d866d3`) returned OK with notes, BLOCKERS none. It independently inspected current source, concrete regression assertions and regenerated 40/120 PNGs. Reviewer ran no commands; test evidence is parent-executed.
- Closed-host admission also remains authoritative over cached live progress. Explicit project stops preserve inspection/new-project actions rather than offering unavailable resume, and the shared audit label explicitly says AUDIT STOPPED.
- Reproducible captures: `timeout 30 bun scripts/audit-status-capture.ts` and `timeout 90 python3 scripts/capture-ui-status.py --audit-status`. Native visual inspection of both widths confirmed semantic tones, neutral branches, visible clocks and the full 677s / 900s project tool budget. Fixtures rasterize production builders in private xterm; they are not full live Pi screenshots.
- Recovered native verification of the original `Screenshot_20261011_165932.png` via a small bottom crop: old card says Project / Auditing with a 677s / 900s bash wait and 11m17s activity, while footer says execution unconfirmed. This independently confirms the project identity and card/footer contradiction; the original screenshot was not modified.
- Final regression evidence: 178 tests, zero failures across eleven files in `/tmp/glla-audit-claim-tests.log`; final typecheck passed (`/tmp/glla-audit-claim-types.log`), capture generation/rasterization passed, and runtime inventory regeneration/check passed. This includes the final explicit stopped label assertion. No release or whole-repository test-suite claim is made.

## Detailed-layout falsification repair

The isolated audit initially approved the compact rendering but its challenge correctly rejected `compactAuditCard: false`: 40-second-old worker activity still displayed thinking/detached-worker text and an automatic-review action, and the heading lacked Goal identity. This was a production path gap, not an auditor false positive.

- Extracted `uiStatusCardHead` for shared owner/status headings in both layouts. Detailed Goal and List item cards use the same evidence projection as compact cards; the objective remains on its own row.
- Detailed phase, next action and closing line explicitly identify unconfirmed worker execution. They retain the completion claim, point to `/goal status` or `/list show`, and do not promise automatic review. The footer likewise suppresses unsupported fine-grained thinking and places the state and inspection command before host decoration.
- Detailed audit clocks have short elapsed/activity rows. In-budget tool timing precedes optional target/model detail, preserving the complete elapsed/budget pair at 40 columns.
- New matrix assertions cover both owners at 40/120 columns with `compactAuditCard: false`, stale worker plus busy parent, inspection commands, absence of automatic-review/live-worker claims, and tool budget. Existing legacy assertions were updated to verify truthful unknown state and actual terminal-cell bounds rather than obsolete inline headings or live-worker wording.
- Final bounded validation: 180 pass, zero failures across eleven files (`/tmp/glla-audit-detailed-final-tests.log`), typecheck pass (`/tmp/glla-audit-detailed-final-types.log`), inventory check pass. Same focused test command as the earlier claim, plus the two new detailed matrix tests.
- Capture commands above now produce compact and detailed `{40,120}[-detailed].{ansi,json,png}`. Native inspection at both widths confirms explicit owners, unknown inspection actions, visible clocks/budgets and phase-leading footers. These remain production fixtures, not live Pi/provider-session evidence.
- Fresh-context read-only reviewer `df1d16db-c447-453b-9291-493dac29fe1a` inspected shared heading/evidence code, assertions and all four PNGs; verdict OK, BLOCKERS none. It executed no commands. A final small footer refinement also suppresses stale thinking text and prioritizes inspection commands, covered by the final matrix rerun.

## Compact stale-worker challenge repair

The latest audit correctly identified one remaining contradiction: compact stale-worker phase expansion still appended `thinking… · detached worker` despite an unconfirmed heading/footer. The earlier detailed repair is retained; the compact unknown branch now directly reuses the evidence-gated detailed phase row instead of independently expanding stale metadata.

- The owner/width matrix now covers both compact booleans, Goal and List policies, and 40/120 widths. It rejects unsupported thinking/reading-source, detached-worker and automatic-review terms across the entire card/footer, while requiring unconfirmed status, inspection commands and timing facts.
- Compact captures now include stale-worker Goal and List cases (40-second-old worker activity plus a busy parent), previously absent. Native inspection of both compact PNGs confirms unconfirmed amber phase rows with no thinking/detached-worker suffix, retained clocks and owner-specific inspection commands.
- Focused reviewer follow-up `cb141e31-b7ea-4884-9f4d-9c95600b64b7` inspected both compact call sites, footer suppression, the complete layout/owner/width matrix, saved logs and both compact PNGs. Verdict OK, BLOCKERS none; no reviewer commands executed.
- Final bounded tests: 180 pass, zero fail across eleven files (`/tmp/glla-audit-compact-final-tests.log`); typecheck passed (`/tmp/glla-audit-compact-final-types.log`); four fixture captures and inventory check passed. Fixture limitations remain unchanged: no live provider-session claim.

## Scope

Only GLLA presentation and its public observation adapters are implementation targets. This item does not alter Pi core, repair the operating system, or implement the separately queued quota retry and manual-model-resume goals.

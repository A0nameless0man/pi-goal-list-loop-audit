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

## Scope

Only GLLA presentation and its public observation adapters are implementation targets. This item does not alter Pi core, repair the operating system, or implement the separately queued quota retry and manual-model-resume goals.

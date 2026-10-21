# Thinking display / dispatch parity

## Requirement and root cause

Finding 5 of `audit/glla-command-review-2026-10-21/README.md`: the menu used the
highest supported level when a requested level was unsupported. Dispatch instead
walked downward. For a model supporting max but not xhigh, the menu advertised max
while the auditor/Designer dispatched high.

## Correction

- `extensions/auditor-thinking.ts` exposes a shared supported-level resolver with
  canonical downward ordering. Runtime resolution retains its existing capability
  rules, including non-reasoning → off and explicitly advertised xhigh/max.
- `extensions/settings-menu.ts` uses that resolver for capability-aware role and
  fallback rows, including the Designer effective row. Session-category rows use
  the actual session model's capabilities without presenting inheritance as a pin.
- `extensions/loops/goal-settings-ui.ts` includes the current session model in the
  capability map even when registry enumeration omits an extension-provided model.
- Explicit thinking remains distinct from inherited thinking; no settings write or
  candidate-selection policy was changed. Unknown-capability headless auditor output
  remains pending.

## Behavioral proof

`tests/settings-menu-complete.test.ts` compares real production row output to
`resolveCandidateThinkingLevel` and `resolveDesignerModel`, independently checking
expected high/max/off. Fixtures cover configured xhigh versus inherited max on a
model supporting max but not xhigh, a non-reasoning model, inherited role categories,
and stale role dials that must not shadow session inheritance. Capability arrays are
intentionally unordered and an unrelated model is included.

`tests/auditor-thinking-display.test.ts` additionally drives the real headless `/glla`
command and compares its effective level to runtime resolution for unsupported xhigh
and non-reasoning models. Existing tests retain unknown-capability pending output,
fallback-only auditor handling, explicit session tombstones, and live session thinking.

Sensitivity checks used a disposable copy, not live inputs:
- Restoring the old highest-supported substitution fails the new parity test
  (37 passed, 1 failed; expected mutation failure).
- Reordering the capability list harmlessly leaves all 38 menu tests passing.

An executor-run exhaustive comparison of the pre-change runtime algorithm with the
extracted implementation covered all 3^7 capability maps (missing/null/present), both
reasoning flags, seven valid requested levels plus an invalid request: **34,992 cases
passed**. This supports dispatch-policy preservation, independently of the reviewer's
static assessment.

## Verification

All commands bounded; no live reload, provider request, publication or upstream edit.

- `timeout 240 bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/settings-menu-complete.test.ts tests/model-picker.test.ts tests/auditor-thinking.test.ts tests/auditor-thinking-display.test.ts tests/designer-settings.test.ts`
  — **85 passed, 0 failed**, exit 0, 17.92 seconds (`required-tests.log`).
- `timeout 240 npm run check` — exit 0, no diagnostics (`typecheck.log`).
- `timeout 30 npm run check:inventory` — exit 0 after regeneration.
- `git diff --check` — exit 0.
- Independent reviewer found no issues; static-only because its role lacked shell
  access (`review.md`). It reviewed the main correction before the final canonical
  constant cleanup and additional headless test; the executor ran the final gates.

Source checkpoint: `714874e27`; later documentation-only commits do not alter the
verified sources. Full-suite or loaded-live-session execution is not claimed.

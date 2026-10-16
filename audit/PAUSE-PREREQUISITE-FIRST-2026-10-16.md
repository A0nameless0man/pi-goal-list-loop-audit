# Pause cards: prerequisite before retry — 2026-10-16

## Observed issue and ownership

Native inspection of `/home/dracon/Pictures/Screenshots/Screenshot_20261016_090537.png`
shows a GLLA manual-action card saying `Next: /list resume` while the dimmed
`Why` contains the actual prerequisite: complete a $0 checkout and confirm the
receipt. The lower widget already says retry does not resolve the blocker;
the custom transcript card contradicts that hierarchy. This is GLLA-owned
presentation, not a Pi abort-renderer or checkout implementation repair.
The screenshot reports loaded v0.39.32; local changes are unreleased.

The agent's claim that it cannot inspect the inbox is not verified here.
No browser/inbox/checkout operation or external session modification was made.

## Correction

- `extensions/action-reminder.ts`: keep the full reason in normal foreground,
  not `dim`. A missing or resume-only blocked action now says to resolve the
  prerequisite above and report the result. Preserve supplied concrete actions
  and tweak questions verbatim. Show `After the prerequisite is resolved:
  <resume command> retries the work; it does not resolve the blocker.`
- Transcript content and rendered blocked cards use the same presentation.
  Legacy saved details are re-rendered without rewriting stored state.
  Decision, redirect, error and automatic wait admission/recovery remain intact;
  wait cards do not acquire a manual resume action.
- `extensions/loops/goal-tools.ts`: pause guidance asks for the unmet prerequisite
  first, a concrete human action rather than bare resume, and inspection of
  available authorized tools before claiming a page/inbox cannot be read.
  No access, payment permission or new auto-resume authority is inferred.
- `docs/RECOVERY.md`, `CHANGELOG.md`, generated runtime inventory updated.

No sentence extraction from arbitrary agent prose, checkout-specific hardcoding,
new schema for saved pauses, or policy bypass was introduced. Missing actions
point to the recorded reason instead of inventing a new prerequisite. Routine
work should continue under existing pause-admission policy.

## Verification

Five new regression cases failed against unchanged production source:
15 pass / 5 fail in `tests/action-reminder.test.ts`
(`/tmp/glla-pause-prerequisite-before.log`). These cover omitted/bare/quoted
resume actions, readable prerequisite text, conditional retry and preservation
of a concrete human action. A sixth case covers legacy saved-card replay and
checks that rendering does not mutate details.

Final bounded regression command:

```sh
timeout 180 node scripts/run-tests.mjs tests/action-reminder.test.ts tests/pause-informativeness.test.ts tests/pause-message-content.test.ts tests/pause-redirect.test.ts tests/pause-decision-interrupt.test.ts tests/pause-admission-failure.test.ts tests/paused-status-action-first.test.ts tests/display.test.ts tests/blocked-pause-autoclear.test.ts
```

**172 pass / 0 fail across 9 files**, exit 0
(`/tmp/glla-pause-prerequisite-regressions.log`). Coverage includes the real
custom-message renderer, transcript content, theme dim-call assertions,
existing terminal control/width bounds, decisions, redirects, scheduled waits,
pause admission and automatic recovery.

`timeout 120 npm run check`: pass (`tsc --noEmit`).
`node scripts/generate-inventory.mjs --check`: pass.
`git diff --check`: pass.

No full release gate, publication or live-session reload performed. Renderer
output is exercised in the offline harness; no new live terminal screenshot
or external capability verification is claimed.

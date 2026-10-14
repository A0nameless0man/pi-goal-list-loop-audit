# Tweak suggestions posed as questions — 2026-10-14

## Operator note

`note.md` ("Later"): "for tweak suggestions we should pose them as
questions" — `Screenshot_20261014_154118.png` (hellhunter project).

## What the screenshot showed

A paused list item whose agent-authored `suggestedAction` was
`Run '/goal tweak "5. ..."'` rendered verbatim in the pause card as
`Next: Run '/goal tweak "5. ..."'` — an imperative order to rewrite the
operator's contract. A tweak changes the objective/contract, which is a
material decision requiring operator confirmation, so the card should ask,
not decree.

## GLLA-owned fix

- `extensions/action-reminder.ts` — new exported `frameTweakSuggestion`
  helper: returns a `Question: should this tweak be applied? ...` framing
  for any action containing a `/goal tweak` or `/list tweak` command,
  preserving the exact command verbatim for copy-paste; returns `undefined`
  otherwise. Applied at all three action-bearing `next:` sites in
  `buildPausePresentation` (redirect, decision, default blocked/error), so
  both the transcript `content` and the rendered card ask the question.
  Non-tweak actions keep the existing imperative `Next:` line.
- `extensions/loops/goal-tools.ts` — one steering sentence in the
  `pause_goal` tool description: tweak suggestions rewrite the
  objective/contract and must be phrased as questions; the card frames
  them automatically.

## Tests

`tests/action-reminder.test.ts` — three new tests, 15 pass / 0 fail:

- `tweak suggestions are posed as questions, never imperative orders`
- `frameTweakSuggestion only fires on tweak commands`
- `non-tweak blocked reminders keep the imperative Next line`

`npm run check` (tsc --noEmit): 0 errors. `git diff --check`: clean.
No live project sessions touched; no provider calls; no publication.

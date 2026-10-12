# Manual resume adopts the retry model — 2026-10-12

Note: `when we resume an objective manually we should update to the model
i am retrying with` (`Screenshot_20261011_192005.png`: the user is on
`(minimax) MiniMax-M3.1-Flash`, but the card reads `model: primary
opencode-go/muse-spark-1.3-contributor · inherited from session` with
`handled turn: minimax/MiniMax-M3.1-Flash`).

## Cause

A persisted `mainModelRecovery` cursor names the episode-creation model as
`primary`, and the status `model:` line renders `recovery?.primary ??
sessionRef`. The normal paused-resume path in `cmdResume` never touched the
cursor, so the card kept reporting the obsolete ref while the resumed turn
ran on the user's selection. Worse, a committed-but-unreconciled
`pendingModelSwitch` survived the resume and could re-drive `setModel` at
the next probe, silently overriding the fresh selection.

## Fix (`extensions/goal-commands.ts`: `reanchorRecoveryToCurrentModel`,
called from `cmdResume` before any recovery branch, skipped in stale
sessions)

On manual resume the explicit current selection wins:

- `primary`/`active` re-anchor to `modelRef(ctx.model)`; the obsolete
  `pendingModelSwitch` is dropped (ledgered as `clearedSwitch`);
- `attempted` keeps every known-dead predecessor and records the new anchor
  (the resumed supervised turn IS its health check — same convention as the
  probe's same-model branch); `skipped` is kept;
- `sameModelRetries`/`modelFailureSteps` reset and `primaryThinkingLevel`
  cleared so the new anchor earns a fresh budget instead of inheriting the
  old episode's counters or thinking level;
- armed schedules (`retryAt`, failback probes) are left in place, so the
  existing probe-then-release path still validates the resumed attempt;
- a forbidden current selection is never adopted (`manual_resume_model_kept`).

`state.lastModelRef` is deliberately untouched: the turn-boundary observer
(`observeTurnBoundaryModel`) owns that signal and ledgers the genuine drift
there. The `recovery:`/`model:` status lines derive from the cursor, so the
re-anchor makes them honest with no renderer change.

## Verification

- `tests/manual-resume-model.test.ts` (5 tests): changed-model re-anchor
  (cursor, ledger from/to, no `setModel`, single resume, status projection
  names the retry model first), unchanged-model no-op, interrupted stale
  switch dropped and never driven with exactly one probe release, forbidden
  selection declined but resume proceeds, pending-claim resume adopts the
  model with exactly one `manual-audit` dispatch and no agent turn.

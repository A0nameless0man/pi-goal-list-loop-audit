# Suggestion acceptance and execution autonomy

## Screenshot evidence

- `Screenshot_20261011_175739.png`: the agent parks the goal as blocked with
  `suggestedAction: Run /goal tweak "Restore the original selective automatic
  Git LFS implementation …"`. The card renders the suggestion as prose, but no
  decision picker appears — the user must hand-copy a ~400-character quoted
  command to act on it. That is the "can have an option to accept suggestion"
  gap: an implicit question with no accept path.
- `note.md #later` (same screenshot thread): "we seem to be asking too many
  qs after we are running … we only ask qs if we really need to otherwise we
  just exec" — long-running unsupervised objectives must not be interrogated
  mid-run over reversible choices.

## Owned paths

- `extensions/loops/goal-tools.ts` (`pause_goal`): owns pause admission,
  the options-without-kind promotion, the mid-run decision budget, and the
  decision picker popup. This is where the suggestion becomes (or fails to
  become) a question.
- `extensions/goal-loop-core.ts`: pure helpers (`extractSuggestedCommand`,
  `suggestionAcceptancePromotion`) plus `ACTIVE_EXECUTION_QUESTION_GUIDANCE`,
  the prompt text that governs mid-run questions.
- `extensions/goal-loop-display.ts`: decision cards already render numbered
  options with the recommended one flagged — no render change needed.

## Judgment

Durable fix, implemented inline: promote command-carrying blocked/error pauses
to Accept-first decisions, reusing the existing decision card, picker popup,
and mid-run decision budget. Alternatives rejected: a new `/goal accept
suggestion` command (new surface for what the picker already does), and
display-only "accept:" prose (still requires hand-copying the command).

## Behavior

When an agent pauses with kind blocked/error (or unset) and `suggestedAction`
contains a concrete `/goal`, `/list`, `/loop`, or `/glla` command:

1. The pause lands as `kind="decision"` with options
   `Accept and run <command>` (recommended first),
   `Continue without it (<resume verb>)`, `Cancel (<cancel verb>)`.
2. The decision picker pops; the card shows the numbered options.
3. The promotion is ledgered as `pause_suggestion_promoted_to_decision` and
   counts against `midRunDecisionCount`, so repeated suggestions auto-default
   under a `decisionPauseBudget` instead of asking every turn.
4. The exact command stays in `pauseSuggestedAction`, so the card keeps the
   full text even where options truncate.

Untouched: quota-rerouted waits, explicit waits, agent-authored decisions,
and vague prose with no extractable command (stays a plain pause).
`extractSuggestedCommand` is conservative — a bare verb, a quoteless `tweak`
(its replacement text is mandatory), or ambiguous prose yields nothing rather
than a half-command. The extraction is quote-aware: trailing explanation
after the closing quote is not glued onto the command.

## Question discipline

`pause_goal`'s description and `ACTIVE_EXECUTION_QUESTION_GUIDANCE` now tell
agents: a concrete fix command belongs in `suggestedAction` (it becomes an
Accept-first decision) — never a second prose question about the same fix.
Mid-run questions remain reserved for missing essentials, genuine blockers,
consequential scope changes, and required consent; the existing decision
budget (`decisionPauseBudget`, `runToDone` auto-default) is the structural
backstop, and promoted suggestions count toward it.

## Verification

- `tests/suggestion-acceptance.test.ts` (8 tests): pure extraction (including
  the screenshot-shaped tweak), policy-correct promotion shape, tool-level
  blocked→decision promotion for goal and list policies, vague prose
  untouched, explicit genuine-blocker decisions untouched, and budget
  auto-default of a promoted suggestion.
- Existing `tests/decision-budget.test.ts` and pause suites guard the budget
  and admission behavior the promotion rides on.
- Interaction contract for the user: a paused card whose first option reads
  `Accept and run …` is an agent suggestion awaiting one-key consent —
  picking it runs the named command; resuming continues without it.

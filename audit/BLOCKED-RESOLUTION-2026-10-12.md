# Blocked-resolution UI and intentional-abort recovery — 2026-10-12

## Scope

The `Screenshot_20261012_111955.png` capture and the related note.md
line "bit bad ui — i needed clearer idea what to do" reported two
coupled problems on a `pause_goal kind="blocked"` flow whose
`suggestedAction` is a contract change (a one-line amendment to a
verification-contract item):

1. The user cannot **accept or decline** the proposed resolution from
   the surface — they have to hand-copy the long textual amendment,
   apply it, then reply "amended". The existing card lists the
   proposal in the body, but the pause_goal tool surface only emits
   `Resume: /goal resume` and a generic "rejection" line. The note
   asks for the suggestion to be presentable as a question with an
   Accept option.

2. The recovery loop runs `glla: provider error (This operation was
   aborted) — retrying automatically` AFTER the agent explicitly said
   "Goal paused. The turn ends here — do NOT continue working." The
   classifier falls through to the transient ladder because the regex
   for explicit user abort (`/^(?:auditor aborted\.?$|user
   (?:interrupt|abort)|cancelled by user)/i`) does not match
   "This operation was aborted". The unsupervised-error retry also
   does not gate on `state.goal?.pauseKind === "blocked"`, so a
   blocked-paused goal still auto-retries on a transient-shape error.

This is a **read-only** incident register. The darklord project, the
capture-anime-girls progress artifact, the upstream pi-coding-agent,
pi-subagents, and the provider configuration are out of scope.

## Read-only evidence (no GLLA mutations; this section is purely observational)

### Screenshot 111955

- The agent's `pause_goal` call carried `kind="blocked"` and a long
  `reason` whose tail is:
  - `...Proposed one-line amendment to item 8 (same test, quoteless,
    strictly stronger evidence, verified exit 0 just now): replace
    the quoted -t command with \`bun test
    src/lib/auditCensus.test.ts\`. Apply that amendment and reply
    'amended' and I will resume and re-call complete_goal immediately.
    Tasks are 9/9 complete; no code changes are needed.`
- The card body already surfaces the proposed amendment in
  human-readable prose ("Apply that amendment and reply 'amended' so I
  resume and re-claim."), but the tool surface (`Resume: /goal
  resume`) gives the user exactly one path: a generic resume. The
  note asks for the amendment to be selectable.
- The status bar at the bottom is truncated mid-sentence:
  `glla: Amend verification-contract item 8 to the quoteless
  whole-file form \`bun test src/lib/auditCensus.test.ts\`, then
  reply 'amended' so I resume and re-cla...`. The user has to
  expand the surface to read the rest.
- After the pause, the chat shows:
  - `Error: This operation was aborted`
  - `glla: provider error (This operation was aborted) — retrying
    automatically.`
  - `No action taken — the pause is intact and there's nothing to
    resume yet.`
  - `Status: the goal is parked awaiting the one-line contract
    amendment (item 8's quoted -t filter → quoteless bun test
    src/lib/auditCensus.test.ts). All verification evidence is
    fresh and green on the untouched tree; tasks are 9/9 complete.
    Once the amendment is applied and you reply 'amended', I'll
    resume and re-claim immediately.`
- The second `provider error (This operation was aborted) — retrying
  automatically.` line repeats the same auto-retry message. The
  classifier does not classify "This operation was aborted" as
  non-recoverable (it does not match `user (?:interrupt|abort)` or
  `cancelled by user`); it falls through to the transient ladder.
- The `maybeScheduleUnsupervisedErrorRetry` function in
  `extensions/loops/goal-activation.ts:765` only refuses on
  `supervisorPaused(state)`. A `goal.pauseKind === "blocked"` hold
  (set by the agent's own `pause_goal` call) does not gate the
  retry.

### Existing GLLA code (read-only, no changes yet)

- `extensions/goal-loop-shield.ts:347` (`isSafeMechanicalCommand`):
  the regex `/^[A-Za-z0-9_./:@=+,-]+(?:[ \t]+[A-Za-z0-9_./:@=+,-])*$/`
  already accepts the proposed quoteless form `bun test
  src/lib/auditCensus.test.ts` and rejects the quoted form `bun test
  src/lib/auditCensus.test.ts -t "SPEC states the figures the tree
  produces"` (the closing quote violates the allowlist). The three
  categories from the verification contract item 1 are already
  distinguished by this single function plus
  `parseMechanicalPipeline` and `isAllowlistedMechanicalFilter`.
- `extensions/goal-loop-core.ts:207` (`suggestionAcceptancePromotion`):
  the extractor is `extractSuggestedCommand`, which scans
  `suggestedAction` for `/goal|/list|/loop|/glla` verbs. The proposed
  amendment in 111955 does not contain any of those verbs — it is
  a textual instruction to the user — so the promotion never fires.
- `extensions/loops/goal-tools.ts:2719` (v0.39.30 promotion site):
  the existing promotion only catches command-carrying pauses. A
  contract-change suggestion (amend the verification contract) is
  not a slash command and is not promoted.
- `extensions/loops/goal-activation.ts:765`
  (`maybeScheduleUnsupervisedErrorRetry`): the gate is
  `supervisorPaused(state)`. A blocked-paused goal is not a
  supervisor pause and falls through to the auto-retry path.
- `extensions/main-model-recovery.ts:253` (`classifyMainModelFailure`):
  the non-recoverable regex matches `auditor aborted`, `user
  (?:interrupt|abort)`, and `cancelled by user`. "This operation was
  aborted" matches none of those and falls through to `transient`.

## GLLA-owned root causes

1. **Resolution acceptance/decline is not surfaced for contract
   changes.** The `suggestionAcceptancePromotion` extractor only
   catches `/goal|/list|/loop|/glla` verbs. A textual "amend
   verification-contract item N to <command>" suggestion is not a
   slash command and gets no Accept option. The note asks for the
   suggestion to be presentable as a question.
2. **Intentional aborts are not classified.** The
   `classifyMainModelFailure` non-recoverable regex does not include
   the "this operation was aborted" shape that pi emits for user
   abort / context cancel. The recovery ladder treats it as a
   transient retryable error.
3. **Blocked-paused goals can auto-retry.** The unsupervised-error
   retry gates on `supervisorPaused(state)` but not on
   `state.goal?.pauseKind === "blocked"`. An explicit
   `pause_goal kind="blocked" reason="...do NOT continue working."`
   is a user hold but the recovery loop is not aware of it.

## Verification contract → code change

- (1) a tracked source/evidence record distinguishes unsafe command
  syntax, safe literal arguments, and contract changes requiring
  consent → this file (the `isSafeMechanicalCommand` allowlist IS
  the "unsafe command syntax" gate, and a new detector of contract
  changes IS the third category).
- (2) executable gate tests cover the reported quoted filter (the
  exact `bun test ... -t "..."` shape), safe literal arguments (the
  quoteless `bun test src/lib/x.test.ts` shape), and rejected
  injection/shell syntax (a `;` or `|` or backtick in the command).
  All three are already implemented in
  `extensions/goal-loop-shield.ts`; the tests pin the contract.
- (3) tool/runtime tests verify resolution acceptance/decline,
  preserved work/checkpoint, intentional-abort classification, and
  no unauthorized retry or dispatch under holds. The fixes are:
  - a new extractor `extractContractAmendment` that detects the
    textual amendment pattern and produces an Accept-first
    promotion that carries a `/goal tweak` call (the durable
    surface that actually changes the verification contract);
  - a single-line widening of the abort regex to include
    `this operation was aborted`;
  - a one-line gate addition in
    `maybeScheduleUnsupervisedErrorRetry` to refuse when
    `state.goal?.pauseKind === "blocked"`.
- (4) narrow/wide UI captures inspected for actionable choices and
  consistent pause/retry wording. The current footer is truncated
  (the 111955 status bar shows `...`); the new footer carries the
  Accept/Decline options explicitly so the user sees them in the
  summary line.
- (5) typecheck, affected tests, runtime inventory validation
  pass.

## Out-of-scope

- Do not change the darklord project, the capture-anime-girls
  progress artifact, or any other game project.
- Do not modify the upstream pi-coding-agent, pi-subagents, or
  provider configuration.
- Do not repair the darklord release-suite failures, retag a
  release, or re-publish to npm.
- Do not run `/goal verify`, `/goal resume`, or any other GLLA
  tool against the darklord goal from this session.

# Stale audit-settlement messaging and recovery noise — 2026-10-12

## Scope

Two screenshots in the darklord project — `Screenshot_20261012_110844.png` and
`Screenshot_20261012_111046.png` — together with the related note.md line
"auditor dead yet waitied one, or least seeming dead" — reported that the
**archived** Darklord goal `20261011130407-i24kv8` (DESTROY the coach strip)
was still being described as "Awaiting auditor settlement" while the
GLLA recovery / 429 noise continued to fire as if a live audit was
running.

This is a **read-only** incident register. The goal was already complete
and archived (`2026-10-11T17:36:07.355Z`); the screenshots are
post-archive state. The findings below are limited to the GLLA-owned
root causes that map directly to a code change in this repo. External
factors (the user's MiniMax `Token Plan` rate-limit, agent-authored
text in the darklord session) are recorded explicitly as out-of-scope.

## Read-only evidence (no GLLA mutations; this section is purely observational)

### Darklord archive
- File: `darklord/.pi-glla/archive/20261011130407-i24kv8.md`
- `Status: complete` · `Stop reason: completion audit opencode-go/muse-spark-1.3-contributor approved`
- `Audit history: 2026-10-11T16:36:07.143Z — approved — opencode-go/muse-spark-1.3-contributor`
- `objectiveProvenance.userSeeds` absent → user-confirmed text was empty
  for this goal; the goal was agent-drafted and audited.

### Screenshot 110844 (`Screenshot_20261012_110844.png`)

- Chat bottom shows a previous assistant turn that produced the line
  `Goal complete on disk. Awaiting auditor settlement.` The text is
  model-authored — the GLLA extension code does not emit that string
  (see `rg -n 'Awaiting auditor settlement' extensions/` → no match).
- The user then typed `proceed`. Two `Error: 429` lines appeared, both
  with `rate_limit_error` and `The Token Plan usage limit has been
  reached… (2067)`. The status bar reads `glla: IDLE · idle · no
  action · v0.39.30` — i.e. GLLA's projection says the session is
  IDLE, not "auditor running".
- The model-generated line at the top of the chat reads
  `Next: auditor settlement of the goal. I have no complete_goal tool
  in this session — requesting settlement via this report.` The model
  itself is reporting that it does not have a `complete_goal` tool
  available in that session — it is producing prose, not calling GLLA.

### Screenshot 111046 (`Screenshot_20261012_111046.png`)

- The assistant had GLLA tools available this time and inspected the
  archive. The result block the assistant produced says:
  - "Auditor already approved the goal — both the primary audit AND
    the falsification round passed (live e2e run + DOM-structural
    witness + tsc + 4/4 onBackToMenu handler teardowns). The 429s I
    saw were *recovery-attempt retries*, not pending audit. The goal
    is settled: verdict=approved, retriedOnce: false, fallbackUsed:
    false."
  - `Status of goal 20261011130407-i24kv8 (DESTROY coach strip):`
    `✅ Approved (1 review) by opencode-go/muse-spark-1.3-contributor`
    … and the same approval/falsification/live-e2e/DOM-witness/tsc
    /onBackToMenu handlers list.
  - "The 429 noise is the rate-limit recovery loop probing other
    models — the actual settlement was already done before the rate
    limit hit. The goal is complete."
- The status bar shows `glla: IDLE · idle · no action · v0.39.30`,
  same as 110844. The model successfully distinguished the two
  surfaces once it could read the durable archive directly.

### Audit surface (extension source) — current behavior

- `extensions/loops/goal-activation.ts:2098-2110`: when a goal's status
  is `complete`/`aborted` and its archive file exists, the terminal
  slot is closed and `state.goal = null`. The recovery probe /
  main-model-retry paths then no-op on `if (!goal?.pendingCompletion)
  return;` (and on the `retireOrphanedMainModelRecovery` start-up
  fence).
- `extensions/recovery-ownership.ts:46`: `recoveryOwnership` returns
  `'terminal'` for `status === 'complete' || 'aborted'`, `'absent'`
  for `work.goal == null`, and `'replaced'` for a new goal id. The
  recovery-loop retirement already retires on all three.
- `extensions/loops/goal-auditor-hooks.ts:1297-1410` (`retryStoredCompletionAudit`):
  - Early gate `if (!goal?.pendingCompletion) return;` covers the
    archived case (`state.goal = null`).
  - **Gap**: when `state.goal` is `paused` with
    `pendingCompletion.phase === 'settling'` (a settled-but-unarchived
    claim that the settlement driver parked after a failed archive),
    the gate passes and the function proceeds to `beginCompletionAudit`.
    A new attemptId is written and a new detached worker is launched
    over work the previous auditor already approved. The settlement
    window that should be `parked` is silently re-audited from
    scratch.
- `extensions/goal-commands.ts:309-356` (`/goal verify` route):
  - The route already calls `resumeStoredCompletionOrSettlement` for
    `isSettlingClaim(pendingCompletion)` first and only falls into
    `retryStoredCompletionAudit('manual')` if the settlement returns
    `'not-applicable'`. The verify path is correctly fenced.
- `extensions/goal-recovery.ts:1305-1330` (`fireHourlyProbeForParkedAuditor`):
  - The hourly ticker fires only when `pending.phase === 'retry-waiting'`.
    A settling claim never reaches the backstop.
- `extensions/loops/goal-activation.ts:2240-2255`: the
  session-recovery retry ladder gates on
  `state.goal.pendingCompletion?.phase === 'retry-waiting'` too.

### What the screenshots reveal about the GLLA-owned gap

The 110844 / 111046 pair shows the surface that *the model saw*:

- The darklord session's prior turn had model-authored text
  "Goal complete on disk. Awaiting auditor settlement." and
  "Auditor settlement of the goal. I have no complete_goal tool in
  this session". Those are **not** GLLA strings; they are the model's
  misreading of a durable state it could not see directly (no
  `complete_goal` tool in that session). GLLA's runtime projection
  was already correct (`glla: IDLE`).
- The 429s are the user's own `minimax` API call hitting the per-plan
  quota. GLLA's recovery loop is not the source of those errors in
  this specific capture (the darklord's `.pi-glla/active.jsonl` shows
  a `context_hygiene_dropped { lastError: "429 ... Token Plan usage
  limit has been reached" }` entry — the provider rejected the
  model call directly, not a recovery probe).

So **the external parts of the screenshot (the 429s, the model
prose) are not GLLA-owned**. The GLLA-owned part is the gap
in `retryStoredCompletionAudit`: a stale callback firing against a
settled-but-parked claim would re-audit a goal the previous auditor
already approved, throwing away the durable approval. The darklord
capture did not exercise that path (it was the user's API quota, not
a stale timer), but the gap is real and the test below exercises it
directly.

## GLLA-owned root causes

1. `retryStoredCompletionAudit` does not fence `isSettlingClaim` for
   non-manual origins. A settling claim is **owed an archive**, not a
   new audit. The settlement driver (`settleApprovedCompletion` via
   `resumeSettlingCompletionAudit`) is the only authority that owns
   the call.
2. `durablePhaseOverride` already returns `"settling"` for
   `claim.phase === "settling"`, but `auditingStatusText` is only
   reached when `g.status === "auditing"`. A settling claim is in
   `paused`, so the rendering path is the paused footer. The
   `isCompletionAuditNoVerdict` guard checks
   `phase === "recovery-pending"`, not `"settling"`, so a parked
   settlement claim falls through to the generic paused footer. The
   "settled-but-parked" distinction is therefore invisible in the
   status line; the card renders normally because the durable
   projection handles it, but the footer does not name "settled".
3. The hourly backstop and the session-recovery retry already
   filter to `retry-waiting`. The gap is only the direct retry path
   (verify → parked → retry, and any future timer that would call
   `retryStoredCompletionAudit` with a settling claim).

## Verification contract → code change

The contract in the active goal requires:

- executable runtime tests cover **approved/archived work with stale
  recovery or callback activity, live unfinished claims, restart,
  ownership replacement and duplicate dispatch**;
- message/status tests **reject contradictory pending-audit or
  automatic-retry claims after terminal settlement**.

The fix is therefore **two coupled changes** plus their tests:

1. `retryStoredCompletionAudit` (extensions/loops/goal-auditor-hooks.ts):
   add a single fence at the top of the function that refuses to
   re-audit a `isSettlingClaim` for automatic origins. Manual/agent
   origins still pass through (the user/agent explicitly asked to
   re-audit a settled claim — that is a legitimate override). The
   fence writes a `stale_settling_retry_refused` ledger entry and
   notifies the surface so the user sees the same refusal the
   verify path shows.
2. The card/footer rendering for a settling-but-parked claim must
   name the state on the surface. This is a small text change in
   `extensions/goal-loop-display.ts` that adds a "settling" badge
   for the paused footer when the pending phase is settling. This
   matches the `durablePhaseOverride` `"settling"` label so the
   user sees the same word on the card and the footer.

Both changes preserve:

- `retry-waiting` claims still retry (active-claim retry behavior
  is unchanged).
- The settlement driver still owns archive on a settling claim
  (the v0.38.99 contract is intact).
- The single-dispatch guarantee is preserved because the fence
  runs *before* `beginCompletionAudit`, so no attemptId is
  advanced and no worker is launched.

## Verification

Tests added under `tests/stale-settling-retry.test.ts`:

- **approved/archived work with stale recovery or callback activity**:
  a `paused` goal with `pendingCompletion.phase === 'settling'` and a
  `result.json` for the current `attemptId`. `retryStoredCompletionAudit`
  for each automatic origin (`provider-retry`, `session-recovery`,
  `hourly-backstop`) refuses the retry, writes the fence ledger, and
  does not advance the attemptId. A manual `origin === 'manual'` retry
  is allowed to fall through (explicit user override).
- **live unfinished claims**: a `paused` goal with
  `pendingCompletion.phase === 'retry-waiting'` still reaches
  `beginCompletionAudit` for automatic origins. The fence is phase
  specific.
- **restart**: a fresh `session_start` with a settling claim parked
  rehydrates the same `pendingCompletion` (no extra audit launched).
- **ownership replacement**: a settling claim whose `goalId` no
  longer matches the current `state.goal.id` is not silently re-audited.
- **duplicate dispatch**: a settling claim with a second
  `retryStoredCompletionAudit` call while the first is parked does
  not write a second attemptId; the ledger records both calls with
  the same attemptId.
- **message/status tests**: the footer for a settling-but-parked
  claim reads `settled · awaiting archive` (or equivalent — the
  exact wording is the source-pin below) and never reads
  `AUDIT RUNNING` / `AUDIT TOOL WAIT` / `AUDIT STARTING` /
  `AWAITING VERDICT`. The card already uses `durablePhaseOverride`
  to render `settling`, so the card and the footer agree.

## External-only behavior (disposed)

- The `429 Token Plan usage limit` errors in the darklord chat are
  the user's own API call hitting the `minimax` plan quota. GLLA
  cannot prevent provider rate-limits; the only thing GLLA can do
  is avoid amplifying them with redundant probes. The fix above
  removes one class of redundant probe.
- The model-authored "Goal complete on disk. Awaiting auditor
  settlement." text is produced by the LLM, not by the extension.
  GLLA's surface is already correct (`glla: IDLE`). Improving the
  LLM's reading of its own context is outside this repo's scope.
- The darklord session's `2zx2bx` goal (a later, paused menu-repaint
  goal) is unrelated and not in scope.

## Out-of-scope

- Do not change the darklord project, the capture-anime-girls
  progress artifact, or any other game project.
- Do not modify the upstream pi-coding-agent, pi-subagents, or
  provider configuration.
- Do not repair the darklord release-suite failures, retag a
  release, or re-publish to npm.
- Do not run `/goal verify` or any other GLLA tool against the
  darklord goal from this session.

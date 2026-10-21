# Rework round scope and transient provider failures — 21 October 2026

Scope: the final (goal-completion) audit in the four projects that carried
on-disk evidence of struggle:
`browser-extensions-shared/extensions/standalones/clean-web`, `eve`,
`browser-extensions-shared/extensions/standalones/youtube-filter` and
`dracon-platform`.

## What was observed

| Project | Symptom | Evidence |
| --- | --- | --- |
| clean-web | Goal stuck in `status=auditing`, `phase=running`; the auditor re-ran the project's browser-test harness round after round | `.pi-glla/active.jsonl`: `audit_tier_decided tier="full" reasons=["rework history (2 prior disapprovals)"]` → `audit_started` → `audit_prior_worker_cancelled` → `audit_recovery_started`; `.pi-glla/audits.jsonl`: `Provider returned an empty response` ×3, `Streaming response failed: [451] …` ×8, `429 … Rate limit` ×1, `Provider finish_reason: content_filter` ×1 |
| eve | Goal stuck in `status=auditing`, `phase=running`; the same single-model chain | `.pi-glla/audits.jsonl`: `Provider returned an empty response` ×3, `Auditor stalled — tool bash exceeded its 5m timeout during the challenge round` ×1, `… 10m timeout …` ×1, `auditor produced no verdict marker` ×1 |
| youtube-filter | Claim parked (`status=paused`, `phase=recovery-pending`) with 13 leftover audit-job scratch directories; one retention sweep reaped 12 at once | `.pi-glla/active.jsonl`: `audit_recovery_pending` (reason `session_shutdown:quit`) → `audit_worker_cancelled` (reason `quit`); `audit_jobs_retention_sweep reaped=12` |
| dracon-platform | Chain exhaustion; its last audit record is a settlement, and no goal was active when the investigation ran | `.pi-glla/active.jsonl`: `auditor_candidate_exhausted`, `auditor_fallback_exhausted`, then `audit_settlement_completed` at 2026-10-20T15:32:49 — the goal that struggled SETTLED, and no goal was active in that project afterwards. `.pi-glla/audits.jsonl`: `Provider returned an empty response` ×7, `Auditor stalled — tool bash exceeded its 5m timeout` ×4, `Auditor approved, but verification is incomplete — a tool call was cancelled at its time budget` ×8, `regression_shield: approved but report's evidence does not address` ×3 |

Three of the four carried the same signature: **`Provider returned an empty
response`**, counted in the durable verdict log (3 × clean-web, 3 × eve,
7 × dracon-platform). That is a provider-side blip, not a verdict.

The host effect was the operator's own observation: clean-web and
youtube-filter were "spamming tests, choking the system and itself". The
mechanism is visible in the process tree — the audit's verification tool call
IS the project's test suite:

```
bash -c cd .../clean-web && timeout 400 npx vitest run test/content-flow.test.ts   (29s old)
  └─ pi                                     (the auditor's own pi child)
      └─ node .../pi-goal-list-loop-audit/scripts/goal-auditor-worker.mjs
          └─ pi                              (the operator's session, blocked in complete_goal)
```

so each audit round ran the project's tests, and the round's result was then
discarded by a transient blip.

## Root cause

Two independent defects, one loop.

**1. The auditor lane had no rule for an empty provider response.**
`failedResultClass()` in `extensions/goal-loop-auditor-process.ts` classified
`Provider returned an empty response` as **`no-verdict`**: the string carries
no HTTP status, is not an account failure, and matches none of the
no-verdict branch's own patterns.

`no-verdict` is the **only** auditor failure class with no identical-failure
brake. The no-verdict branch in `extensions/loops/goal-auditor-hooks.ts` parks
the claim and re-dispatches a **fresh full audit round** immediately, and it
never passes through `trackAuditorIdenticalFailure()`. The provider branch
does, and it also takes the bounded retry ladder. So a transient provider blip
was routed to the one path that re-pays the whole cost of a round, at once.

The main lane has known this since v0.38.104, in the source comment:

> Field 2026-09-27 (darklord): `Provider returned an empty response` matched
> no quota signal and no deterministic-client marker, so it fell to the blind
> ladder — 15m, then 30m, then 60m. The goal sat at 0/29 tasks with "last
> host activity 49m 21s ago" and looked completely unretried … 7 empty
> responses parked our own repo goal 300m.

The auditor lane never got that rule.

**2. A rework round had no scope bound.** The rework brief tells the auditor
its primary question is whether the PRIOR objections are closed, but nothing
forbids re-running the project's whole verification to answer it. The
observed rework round did exactly that — the round's own output reads *"Now
I have the prior round-2 objections. Let me verify each is closed, starting
with the blocking one (scan-marker single-file mode)"* — and its tool calls
were `scripts/browser-test/launch.mjs` and
`scripts/browser-test/sweep-pol-pages.mjs`. Each round therefore cost the
project's full browser-test harness. The tier escalated to `full`
(`rework history (2 prior disapprovals)`), which adds the falsification
pass; v0.38.103 already skips that pass once a goal has been reworked twice
"because against an already-iterated goal it MANUFACTURES a fresh objection
every round by construction", so the amplifier was bounded — but the round
itself still re-verified the whole change.

Together: an expensive round, re-run each time, destroyed by a blip that the
lane could not recognise as transient. The loop saturated the host, which made
the next blip more likely, which made the next round slower. The auditor also
left four scratch test files behind in clean-web (`test/zz-empty.test.ts`,
`test/zz-empty-node.test.ts`, `test/zz-probe-memory.test.ts`,
`test/zz-probe-leak.test.ts`).

## The fix

### An empty provider response is a transient provider failure (auditor lane)

`failedResultClass()` now recognises it, reusing the main lane's existing
`isEmptyProviderResponse()` — one shared rule, not a second invented one:

```ts
return isAuditorAccountFailure(error) || isEmptyProviderResponse(error) || /…HTTP…/.test(error ?? "")
  ? "provider"
  : "no-verdict";
```

A provider-class failure takes the bounded retry ladder **and** the
identical-failure park, so a transient blip no longer re-dispatches a whole
audit. Local failures keep the no-verdict treatment unchanged: a dead worker,
a malformed result and a missing marker are not provider blips
(`tests/rework-round-scope.test.ts`).

### A rework round verifies the open objections, not the whole change

The rework brief now carries a scope bound (shared with the falsification
pass, so both briefs say the same thing):

> VERIFY THE OPEN OBJECTIONS, NOT THE WHOLE CHANGE. Do not re-run the
> project's full verification suite, its whole test run, or its end-to-end
> harness … Check each open objection with the narrowest command that
> produces evidence for it.

A rework round's falsification pass is scoped the same way, and the bound
does **not** narrow what may block: a new defect inside the changed paths
still blocks, because the CHANGE SCOPE contract in the original brief still
applies. The tier decision is unchanged — the scrutiny level is the same, only
the verification *scope* is bounded.

### The briefs are a testable contract, and the two branches cannot drift

Both round briefs — the falsification pass and the continuation after a
cancelled tool call — moved into `scripts/auditor-round-prompts.mjs`, pure
and exported. The contract they carry (a cancelled tool call still ends the
round with a verdict; a rework round does not re-verify everything) was
previously invisible to the suite: the worker built those briefs inline and
nothing could assert them.

The rework-round flag is derived from **one** shared predicate,
`isReworkRound()`, used by both parallel dispatch paths
(`extensions/loops/goal-auditor-hooks.ts` and `extensions/loops/goal-tools.ts`),
so the complete_goal path and the stored-claim retry path cannot disagree
about what a rework round is. The flag is present on the request only for
rework dispatches, so every other request keeps its byte-identical hash.

### What stopped the live churn

The two projects that were actively looping had their sessions stopped
gracefully; GLLA's `session_shutdown` handling parked the claim durably and
cancelled the detached worker (`audit_recovery_pending` → `audit_worker_cancelled`,
reason `quit` in both ledgers). Three orphaned auditor workers from a deleted
scratch directory (`/tmp/envprobe`, ~79h old) were reaped; they were burning
CPU with no session left to own them.

## Observed behaviour under the fix

The parked claims were re-audited under the fixed code, and the rounds look
different in the durable evidence.

**clean-web** — the re-audit round (attempt `audit-mvhgobbj-c6t1vl-mvhgobc5-10fe4f8d`)
made **64 tool calls, of which exactly ONE launched a test run**, and that one
was a single test file with its own timeout:

```
bash: cd .../clean-web && timeout 300 bunx vitest run test/page-styles.test.ts 2>&1 | tail -20
```

The other 63 calls were narrow reads and greps of the files the objection
named (`sed -n '124,140p' scripts/browser-test/audit-behavior.mjs`,
`grep -n "createElement" src/content/ui.ts`, `head -40 …/REPORT.md`, …). The
round's own opening line was *"I have the full audit history. The last
disapproving round raised 4 items (1 MED + 3 LOW). Let me verify each
narrowly."*

Before the fix, the same project's rounds launched the whole browser-test
harness (`scripts/browser-test/launch.mjs`,
`scripts/browser-test/sweep-pol-pages.mjs`) — the full suite, as one bash
call, which then hit the five-minute per-tool budget. The complete tool-call
profile of the post-fix round is kept in
`audit/rework-round-scope-2026-10-21/post-fix-round-tool-calls.txt`.

**eve** — the re-audit exhausted its chain on **provider** failures, and the
claim settled on the provider path rather than the no-verdict path:

```
auditor_candidate_exhausted   failureClass=provider
auditor_fallback_exhausted    failureClass=provider
goal_paused                   phase=retry-waiting
```

with the durable verdict log showing the underlying cause plainly:
`429: {"message":"Provider returned error","code":429,…}` and
`xingchen-agi/xing4.0-29b-a4b:free is temporarily rate-limited`. The claim is
now on the bounded retry ladder, not in a loop that re-dispatches a whole
audit.

**The empty-response classification, in the durable record.** The pre-fix
verdict log for clean-web shows the same transient blip destroying round after
round — `Provider returned an empty response` at 18:52, 22:21 and 01:08 on
20–21 October — each one a full round that had already run the project's
whole harness, thrown away. After the fix the same string is classified
`provider` (the rule the main lane has used since v0.38.104), so it takes
the bounded ladder and the identical-failure park instead.

## The auditor's dial on the session route — recorded from the field

The operator's report alongside the audit-stall investigation: *"the auditor
should inherit session model with its thinking as the default option or last
option unless we specify something else in which case we would try that but
if not working then we fall back and use session right at the thinking I use
for the session — so i have max on the session now but auditor is set
xhigh."*

The MODEL half of that was already true and is unchanged:

- With nothing configured the auditor runs the session model
  (`resolveAuditorModel` → `via: "session"`).
- With a configured chain the session model is appended LAST as the
  `session-fallback` — "The session model is still the final last resort"
  (`extensions/goal-settings.ts`).

The DIAL half was not. Every candidate resolved one requested level:

```ts
const requestedThinking = settings.auditorThinkingLevel ?? liveCtx.thinkingLevel ?? "max";
```

so with `auditorThinkingLevel: "xhigh"` the session-model fallback — the
route that has to carry the decision when everything else failed — ran at
`xhigh` instead of the session's `max`. `resolveAuditorThinkingLevel` then
resolves DOWNWARD if the model does not advertise that level, so the session
route could end up a further notch below the level the operator chose for
it.

The fix splits the two decisions. `auditorThinkingLevel` is a choice about
the CONFIGURED auditor models, so those keep it. The session model is not one
of them — it is the session's own model, reached as the auditor's default or
its last resort — so it runs at the session's own dial. With nothing
configured, every candidate still inherits the live session dial, exactly as
before.

The rule is one shared function (`resolveCandidateThinkingLevel` in
`extensions/auditor-thinking.ts`) used by all three dispatch branches — the
completion path, the stored-claim retry path and the project (respec) path —
so they cannot drift, and the read-only `/glla status` line shows the dial
that will actually be used.

## A note on the state of the four projects

The four states at the end of the work:

| Project | State | Why |
| --- | --- | --- |
| clean-web | `paused` / `recovery-pending` | The claim was parked durably when the churn was stopped (`audit_recovery_pending` → `audit_worker_cancelled`, reason `quit`), and the re-audit under the fixed code was stopped once it had demonstrated the new scope. |
| eve | no active goal | The re-audit under the fixed code exhausted its chain on **provider** failures and the claim settled on the bounded retry ladder; the goal has since completed. |
| youtube-filter | `active` | Its parked claim was re-audited and the goal is active again — it is no longer a parked, looping claim. |
| dracon-platform | new work in flight | The goal that struggled SETTLED (`audit_settlement_completed`, 2026-10-20T15:32:49) and no goal was active in that project afterwards. The goal now auditing there (`20261021032356-omjo1j`, created 2026-10-21T03:23) is NEW operator work — "we are getting 500 on ai hub" — started after this investigation, and it was deliberately left alone. |

The audit workers of the two projects that were actively looping were
stopped with their sessions, so their claims parked durably; the re-audits
under the fixed code were then started with a tool-restricted, headless
session (`pi --continue --tools resume_goal`) that could only resume the
claim — it could not touch a file in either project.

## The stall watchdog no longer kills a slow run

The release gate was terminated by its own stall watchdog while a legitimate
slow test file was running: 218 seconds of silence against a 195-second
limit, on a host running at load 30-45. A silent suite is not automatically a
HUNG suite — the suite's whale takes over a minute standalone and minutes
under load — so the watchdog now measures how slow the host is right now and
extends the window when the host is measurably contended, instead of
reporting a busy machine as a broken suite. The extension is bounded
(at most three extensions, capped at 15 minutes), so a genuinely wedged
suite still dies in minutes; the field cases the bound exists for were 37
minutes of silence and a 26-hour orphan.

The decision is a pure function (`stallDecision` in `scripts/run-tests.mjs`),
pinned by a unit test.

## What GLLA does not own — recorded, not fixed

- **The configuration gap.** The global settings carry
  `defaultProvider: openrouter` and `defaultModel: minimax/minimax-m3.1-flash:free`
  — a free-tier route — and `auditorModelFallbacks` is unset, so the auditor's
  candidate chain resolves to exactly **one** model,
  `openrouter/minimax/minimax-m3.1-flash:free`, in all four projects
  (`pendingCompletion.auditorCandidateRefs`). Paid routes are enabled and
  unused by the auditor (`opencode-go/deepseek-v4-flash:max`, `*luna*:max`).
  GLLA already has the setting to widen the chain
  (`auditorModelFallbacks`); the fix is a deployment choice, not a product
  defect, and it is out of this goal's scope.
- **The provider walls.** `429 … Rate limit`, `Streaming response failed:
  [451] …` and `Provider finish_reason: content_filter` are upstream
  responses. The v0.39.42 fix already makes the auditor fall through to the
  permitted session model on an account wall; a free-tier route that returns
  empty or filtered content is a provider-side condition.
- **The auditor reaching for tools it does not have.** youtube-filter's log
  shows `Auditor attempted unsupported tool: command` (×1) and `… : write`
  (×3). The tool floor refuses them correctly (the attempt becomes a
  no-verdict infrastructure failure), but a model that keeps reaching for
  `write` in a read-only audit is a prompt-level observation worth a separate
  look.

## Known open items

- `tests/behavioral-orchestrator.test.ts` (the suite's whale) and
  `tests/respec-builder-audit-runtime.test.ts` remain intermittently
  load-sensitive: they assert a durable effect that lands a moment after the
  read. The fix pattern is established and applied at several sites (capture
  the scenario values once; wait for the effect the assertion is about), but
  it is not complete in those two files.
- The two scratch test files the auditor left in clean-web
  (`test/zz-empty.test.ts`, `test/zz-empty-node.test.ts`, plus
  `test/zz-probe-memory.test.ts`, `test/zz-probe-leak.test.ts`) are the
  auditor's own probes, untracked in that repository. They are not GLLA's to
  delete, and they must be removed before that project's suite runs clean.

## Evidence

| Artifact | What it shows |
| --- | --- |
| `extensions/goal-loop-auditor-process.ts` | `failedResultClass` now recognises an empty provider response; the rework-round flag on the request. |
| `extensions/goal-loop-auditor.ts` | The rework brief's scope bound, and the shared `isReworkRound()` predicate. |
| `scripts/auditor-round-prompts.mjs` | Both round briefs, now pure and exported. |
| `scripts/goal-auditor-worker.mjs` | Uses the shared briefs; passes the rework flag to the falsification pass. |
| `extensions/loops/goal-auditor-hooks.ts`, `extensions/loops/goal-tools.ts` | Both dispatch paths pass the shared rework-round flag. |
| `tests/rework-round-scope.test.ts` | 9 tests: the rework scope bound, the falsification-pass scope, the cancelled-tool verdict demand, the empty-response classification, the class-gated no-verdict branch, the two-branch agreement, and the request flag. |
| `.pi-glla/audits.jsonl` (each project) | The durable verdict log: the error signatures quoted above. |
| `.pi-glla/active.jsonl` (each project) | The dispatch/park/recovery trail quoted above. |

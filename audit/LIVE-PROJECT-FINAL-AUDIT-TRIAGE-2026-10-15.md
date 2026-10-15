# Live-project final-audit triage — 2026-10-15

## Scope and method

The current item rechecks only hellhunter and dracon-platform; its timestamped findings are immediately below. The older fleet investigation is retained explicitly as historical context, not a claim that its parked states remain current.

Historical method: the operator requested investigation of db-gateway's screenshot and other live projects, not just a version comparison. Read-only scan under `/home/dracon/Dev`, excluding dependency/build/git trees. A live owner required an extant PID whose command was Pi; all 25 matched their recorded project working directory. Parsed durable journal snapshots, recent lifecycle events, detached-job progress/results and session message metadata. No provider calls, external project edits, reloads, resumes, journal rewrites or changes to operator holds were performed. Runtime data continued changing while sampled; this is not a claim of atomic fleet state or global discovery beyond this directory.

## Current two-project recheck — 2026-10-15T10:05:53Z–10:08:46Z

This section supersedes the older parked-state descriptions below. Read-only inspection covered each project's `active.jsonl`, the six most recent `ledger-segments/*.jsonl`, matching detached-job request/progress/result metadata, owner records and `/proc` identity. Files changed concurrently under their existing owners; this is a timestamped observation, not an atomic snapshot or proof of future health. No live recovery was performed by this investigation.

Project roots:

- hellhunter: `/home/dracon/Dev/dracon-platform/web/games/wip/hellhunter` (not the obsolete `web/games/games/hellhunter` path).
- dracon-platform: `/home/dracon/Dev/dracon-platform` (not its nested same-named directory).

### Current observations

| Project | Final observed durable state | Matching activity / holds |
| --- | --- | --- |
| hellhunter | Snapshot **10:08:14.969Z**: list-policy goal `auditing`, claim submitted **10:08:08.049Z**, phase `running`; no pause kind. At the earlier **10:06:58Z** read it was active with **no pending completion**, following main-model recovery; it then submitted a new claim externally. | Job `audit-mv9dlboy-ffdl9h-mv9dlbsv-d1add285`: progress `running`, activity **10:08:43.483Z**, completed tool metadata, no result file at sample. Lock PID **3027115** exists with matching project cwd. Main Pi owner PID **2107284** exists with matching cwd. No saved supervisor/load hold. Main-model recovery record remains at **79 recovery steps**, with no retry deadline or pending model switch; it does not establish an active exhaustion wall during the new audit. Last observed GLLA receipt reports **0.39.30**, not proof that the cursor fix is loaded. |
| dracon-platform | Snapshot **10:08:28.474Z**: list-policy goal `auditing`, claim submitted **09:57:38.464Z**, phase `running`; no pause kind. | Job `audit-mv9d7twj-hbiv30-mv9d7tz3-2c3b785c`: progress `running`, activity **10:08:44.662Z**, completed tool metadata, no result file at sample. Lock PID **2840861** exists with matching cwd. Main Pi owner PID **1500988** exists with matching cwd. No saved supervisor/load hold or main-model recovery. Last observed GLLA receipt reports **0.39.32**; a version string alone does not prove a particular source revision is loaded. |

The main Pi processes, request/logical-attempt correspondence, lock PID cwd and fresh progress strengthen the activity observation beyond process existence alone. Neither current claim is approved by these observations. This investigation did not initiate either audit, consume either result, or assess either project's semantic correctness.

### Disposition of the formerly parked claims

Both earlier claims were retained through recovery, not silently discarded. The ledger records **manual-origin** audit starts outside this investigation, followed by real disapproved verdicts. Manual origin identifies the recovery route; it does not establish who issued the command or independently prove their authorization.

| Project | Prior claim and cursor warning | Retention and subsequent disposition |
| --- | --- | --- |
| hellhunter | Claim time **2026-10-14T21:07:40.675Z**; cursor refusal event **21:49:07.932Z** for logical attempt `audit-mv8mrok4-i9h70q`. | Manual retry **2026-10-15T08:37:00.345Z**, logical attempt `audit-mv9ac4r7-pcd23l`, retained the same claim time and content fingerprint. Worker result `ok=true`, `<disapproved/>`; durable audit history records **08:50:59.518Z**, approved=false. The old pending claim was consumed into rejection/repair work, not approved or lost; a newer claim now runs. |
| dracon-platform | Claim time **2026-10-14T21:24:04.221Z**; cursor refusal event **23:12:25.226Z** for logical attempt `audit-mv8pqqm6-o3o7aj`. | Manual retry **2026-10-15T08:38:29.425Z**, logical attempt `audit-mv9ae1ik-2e1bdc`, retained the same claim time and content fingerprint. Worker result `ok=true`, `<disapproved/>`; durable audit history records **08:56:37.191Z**, approved=false. The old pending claim was consumed into rejection/repair work; the current claim is a later submission, not a timer still attached to the old cursor pause. |

Retention comparison used SHA-256 of `completionSummary + "\n" + verificationSummary`, without copying either body into evidence:

- hellhunter: `dd7a66cb9c911e1f4ab7928b161b9da7d83399f4f134d274e56f472cbb418164`, summary 3015 characters, equal before/after manual retry.
- dracon-platform: `2cd606a7e53f719e88fa1ac36c4d6484ac84f8bc6c9d24fdfee19cfae783fc5d`, summary 741 characters, equal before/after manual retry.

Sources are the roots above plus `.pi-glla/ledger-segments/*.jsonl`, `.pi-glla/active.jsonl`, and the named `.pi-glla/audit-jobs/<attempt>/request.json`, `progress.json`, `result.json` and `lock`. New jobs had no result at the final sample. No raw provider error, worker prompt, report or credential is reproduced here.

### Supported recovery actions — recommendations only, not executed

**hellhunter, now:** inspect `/list show`, `/goal status` or `/glla status` in its owning conversation and let the observed audit settle. Do **not** resume/recreate the earlier claim, force verification, or reload solely because the old warning existed: a new audit is already active. If it disapproves, address the actual saved required fixes under the existing contract. If it later returns to provider recovery, distinguish its saved deadline/hold from auditor progress; inspect status rather than interpret the old 79-step count as current continuous failure. A reported 0.39.30 load warrants checking `/glla version` and update provenance before any later cursor-recovery attempt, not a claim that this inspection updated it.

**dracon-platform, now:** inspect `/list show`, `/goal status` or `/glla status` in the root conversation and allow the current matched audit to settle. Do **not** launch another auditor or resume the superseded parked claim. The earlier disapproval is a semantic repair outcome, not a cursor failure. Provider availability improved enough to produce later verdict/activity, but this is not a guarantee that the next request will succeed.

**If either project later genuinely parks again, only with separate operator authorization:**

1. Inspect the *current* claim, holds and persistence health with `/glla status`, `/goal status` and `/list show`. These are both list-policy goals: the project-specific resume command is **`/list resume`**, not a new goal, direct journal edit, forced approval or contract amendment.
2. For a cursor-safety hold, ensure the corrected GLLA code is actually installed/loaded in that owning session. Use a release known to contain the fix or an authorized corrected-source installation via the documented path (`INSTALL.md`); do not assume today's npm `@latest` contains this unreleased change. When safe and authorized, use `/reload`, then `/glla version`. Do not interrupt a live auditor to follow an obsolete recommendation. A source fix/publication/version string does not itself release saved holds or prove code provenance.
3. Treat actual journal/markdown/transaction write or readback refusals as storage/ownership failures until investigated. Repair the identified cause through authorized means; do not remove journals or falsify cursor success. Readability, later successful writes and the local clock regression do not disprove a historical ENOSPC/EACCES/ownership failure. Public resume rechecks its guarded persistence path; if refusal remains, stop and preserve the diagnostic rather than repeatedly dispatch.
4. A recorded 429/Token Plan failure is a provider condition, distinct from the cursor gate. Corrected markdown does not repair access. An operator may choose an already permitted usable provider through supported settings/model controls; this inspection neither tests it nor guesses a reset time. Preserve any pacing and permission gates.
5. Only once eligible, **`/list resume` in the owning project** preserves the stored claim. The supported path first reconciles saved completed/approved evidence and settlement; only an unfinished claim needs a detached retry. Do not manufacture a fresh claim or request a second verdict for already-approved settlement. With no pending claim after disapproval, continue the actual repair work instead.
6. A deliberate user pause, supervisor/load hold, decision or permission boundary is **not** cursor recovery authorization. None was recorded in the final sampled snapshots, but that is not permission to bypass a later hold. `/glla resume` is the broad explicit hold-release entry; `/list resume` handles the list item/load admission path. Only the operator may authorize release of a real hold, and a substantive decision still needs its actual answer. Neither route changes acceptance criteria or makes unfinished work approved.

Supported-path references: `docs/RECOVERY.md` (resume matrix, protected holds, updating sessions); `extensions/goal-commands.ts` (`cmdResume`, stored-claim branch, already-running guard); `extensions/loops/goal-auditor-hooks.ts:1200` (completed-result/settlement-first recovery). These are source/document inspections, not commands issued to either live process.

### Causal confidence and non-intervention

- **Verified local regression:** wall-clock-dependent durable audit markdown could fail its own write/readback equality check. The isolated before-fix log has 0 pass/5 fail; the subsequent cursor validation log has 101 pass/0 fail across eight files, including persistence/fallback safety. Current `extensions/goal-loop-core.ts:3677–3680` anchors projection to saved timestamps; `extensions/loops/goal-orchestrator.ts:914` retains exact readback checks. These are local proof, not a replay of either historical failing write.
- **Verified historical observations:** both old workers returned `ok=false` with recorded 429/Token Plan diagnostics, then their parents logged cursor-persistence refusal with failureClass=transport. Both claims subsequently survived manual retries and received semantic disapprovals. These event sequences do not identify the precise failed storage operation.
- **Inferred, not proven:** the local clock race is a plausible explanation for those historical cursor warnings. No contemporaneous byte-level write/readback pair or decisive IO trace was recovered. Genuine historical storage or generation-ownership failures remain possible. The earlier categorical causal wording below is narrowed accordingly.
- **Current classification:** new auditing activity, not the old no-deadline cursor parks; recent provider recovery is historical/current-record context, not proof of an unusable current provider. No deliberate operator hold is observed in the sampled snapshots. No broad writable-disk or provider-access test was performed.
- **No live recovery performed:** no external project file/journal/contract was changed; no reload, resume, hold release, model selection, audit launch or provider request was sent to either project. Only this repository's triage document is changed by this recheck. Local existing evidence was read; tests were not rerun. No extra reviewer/provider call was launched for this read-only investigation. Required completion review of this report is separate from either live project's auditors.

## Historical fleet sample — superseded by the two-project recheck

Sample started 2026-10-15T08:32:22Z and finished around 08:32:42Z (UTC).

| Projects | Observed disposition |
| --- | --- |
| db-gateway, eve, endless-td, darklord, freeport, web/studio | Active goal; recent session tool-use/tool-result evidence. Not classified as hung final auditors. |
| hellhunter | Paused since 2026-10-14T21:49:07Z; stored completion phase recovery-pending; reason auditor-cursor-persistence-failed. |
| dracon-platform (root) | Same parked-cursor reason since 2026-10-14T23:12:25Z. |
| neonbreak | Paused by unproductive-turn guard (3 turns). No pending completion. Requires separate assessment, not automatic audit retry. |
| polis | Explicit operator design decision hold. No pending completion. Do not bypass. |
| hegemon, outpost-eden | Builder phase complete; loop inactive. Historical provider errors do not make them unfinished audits. |
| Remaining 13 live Pi owners | No active goal or builder recorded in sampled state. Process existence alone is not work progress. |

During the investigation eve moved from a running second audit round to active work. db-gateway moved from disapproved/compaction, through a contract-amendment decision hold, to active work. web/studio also changed from its recorded daemon dependency to active work in a new Pi process. These transitions happened externally; this session did not trigger them.

## Finding 1: verified local cursor regression; historical attribution unproven

At the earlier sample, hellhunter and dracon-platform retained stored completions and readable journals after detached workers ended with provider 429 (Token Plan usage limit) diagnostics. Their parents then recorded `auditor recovery cursor persistence failed` and parked without an automatic deadline. That sequence is observed; it does not prove that the cursor warning was false or that storage was healthy at the failing operation. A concrete GLLA-owned false-failure mechanism independently reproduces locally:

1. `persistDetachedAuditorCursor` delegates to `updateGoal`.
2. `updateGoal` writes goal markdown, persists the state journal, then checks `goalMarkdownLanded` by comparing the file with a second `renderGoalMarkdown` call.
3. Markdown rendered `auditLifecycleProjection` with its default **Date.now()** clock. Worker ages, stale status and retry countdowns could change between write and verification, even with completely healthy storage.
4. A false comparison refusal propagates to the fallback ladder as a cursor-persistence failure, which deliberately stops automatic retries.

Fix: durable markdown now anchors lifecycle projection to `goal.updatedAt`, with deterministic fallback to creation/claim time or epoch for malformed legacy timestamps. The live UI projection remains current-time based. Actual persistence refusals and generation-ownership fences are unchanged.

Regression: `tests/audit-markdown-determinism.test.ts` writes actual temporary markdown and repeats the readback render across second, stale-threshold and retry-deadline boundaries for all five persisted audit phases. Before the fix: **0 pass / 5 fail**. After: **5 pass / 0 fail**. No external project state was used as a test destination.

## Finding 2: substantive audit findings falsely redacted

Replaying db-gateway's stored report through the existing sanitizer erased two HIGH required fixes containing **user authorization**, plus normal host-audit JSON (`status: pass`) and command-output status fields. The private raw report remains on disk; no provider payload is copied into this tracked report.

Two GLLA-owned causes:

- The provider-sensitive marker treated bare `authorization` in report prose as a credential.
- A structured field named `status`, `reason`, `message` etc. could start payload redaction without any provider marker.

Fix: report-only authorization matching requires a credential assignment/header or Bearer/Basic value. Structured field names only continue an already identified provider payload. Explicit HTTP-error statuses, request IDs, actual authorization headers/values and direct markers beyond the cascade budget still redact. Short provider-error display policy is unchanged.

Added regressions preserve all three contract-finding lines and ordinary host JSON/test evidence; credential/header cases still redact before and after the cascade budget. These two new tests failed against the old sanitizer. Existing provider-payload and multiline secret tests remain green.

## Disposition of other suspected causes

- Provider rate limits are real external conditions, not GLLA-owned service defects. No account settings, keys, plans or upstream code were changed.
- db-gateway's main-provider failback/429 sequence was observed but is not proven to be a separate policy defect; no speculative probing-policy patch was applied.
- db-gateway's incomplete compaction was followed by an acknowledged continuation, and later by active tool use. This capture does not prove it is stranded in compaction.
- Semantic disapprovals are not infrastructure failures. Contract amendments and operator decisions remain consent-gated.
- If a cursor claim remains parked without a timer, a source fix alone does **not** unpause an already loaded session; loading corrected code and eligible explicit resume may be required. This was the earlier situation, not the final two-project sample: both old claims have since received verdicts externally, and newer audits are running. This investigation does not claim to have performed that recovery or a new npm release.

## Verification of the earlier implementation investigation

These are retained local regression results, not newly executed tests or proof of historical live-project causes. The current item performed only read-only evidence/source inspection and a report-content/whitespace check.

- Focused production/core/fallback/sanitizer/project-status/continuation isolation suite: **106 pass, 0 fail**, 7 files, `/tmp/glla-live-repairs-tests.log`.
- Broader lifecycle, standstill, persistence, settlement, history and feedback checks: **53 pass, 0 fail**, 8 files, `/tmp/glla-live-repairs-broader.log`.
- `npm run check`: passes, `/tmp/glla-live-check.log`.
- Full release gate not run for this bounded investigation; no publication requested or performed.

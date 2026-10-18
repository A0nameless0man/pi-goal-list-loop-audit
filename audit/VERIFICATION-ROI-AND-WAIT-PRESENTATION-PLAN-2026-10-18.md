# Repair plan: verification value and scheduled-wait presentation

Date: 2026-10-18
Status: PLAN ONLY — proposed repairs below are not implemented or authorized by this document.
Baseline inspected: `54f52ca666835fd93a252a04463e0c63b03946ba`.

## Objective and boundaries

Reduce verification activity that consumes effort without protecting useful behavior, and make intentional scheduled waits understandable without weakening their lifecycle guarantees.

This is a GLLA repair plan, not a test deletion campaign or a cross-project repair. Preserve independent goal/list completion audits, project verification, release gates, saved contracts, and pause/wake/ownership semantics. Do not optimize by hiding failures or declaring success without evidence. No Pi core, provider, other plugin, or external-project edits; no releases, tags, runtime configuration changes, or implementation changes in this planning batch. Normal host-managed goal journal updates are control-plane bookkeeping, not implementation changes.

## Evidence and limits

Evidence below separates direct observations from possible causes. Local session references are inspection pointers, not portable fixtures; future tests should use synthetic minimal fixtures, not entire private transcripts or credentials. The screenshot was read natively. No test suites were run for this documentation task.

### E1. Repeated execution to recover discarded diagnostics (confirmed)

Local session: `~/.pi/agent/sessions/--home-dracon-Dev-pi-plugins-pi-goal-list-loop-audit--/2026-10-12T19-28-02-169Z_01a13196-1679-73cd-a87e-81b9a19c669f.jsonl`.

On 2026-10-18:

| Time UTC | Observed command pattern | Assessment |
| --- | --- | --- |
| 01:34:39 | Multi-file settings suite, output piped to `tail -4` | Failure detail omitted from displayed output. |
| 01:34:52 | Same suite, now piped to `grep '(fail)'` | Execution repeated just to discover failed test names. |
| 01:37:25 | Multi-file settings suite piped to `tail -4` | Same diagnostic-loss pattern. |
| 01:37:31 | Same suite piped to `grep '(fail)'` | Another diagnostic-only rerun. |
| 01:37:36 | Single failing file piped to `grep -B2 -A10 AssertionError` | Narrower, but still execution to recover already-produced output. |

A scan found 53 tool invocations containing `run-tests.mjs` between 01:00 and 02:14. This is NOT 53 proven wasteful runs: some invocations run multiple commands; others are justified regressions or mutation controls. The matched pairs above, not the aggregate, establish avoidable repetition. No measured token/cost savings are claimed.

`scripts/run-tests.mjs:130-239` already forwards output, retains a bounded diagnostic tail on failure, reports a failure-artifact path, and preserves the child exit status. The executor did not inspect that evidence before rerunning. Do not build a duplicate runner merely because the executor used it poorly. Pipelines ending in `tail` can also mask failure status unless the shell propagates it.

### E2. Incidental facts promoted into contracts (confirmed; external ownership)

Read-only external example: `web/games/wip/hegemon/src/lib/game/section-13-5-no-external-cdn.test.ts:146-170` (under `/home/dracon/Dev/dracon-platform/`). It asserts favicon SVG size renders as `94.8`, PNG size is `103` bytes, font count is four, and the spec repeats corresponding facts. Nearby tests also require the spec to enumerate static-directory siblings.

The intended no-external-CDN property is distinct from exact byte sizes or prose wording. Harmless asset optimization can break those incidental assertions without introducing a CDN dependency. The same file has useful local-font and asset-origin checks: retaining those is not the problem. Whether a particular inventory count is intentional must be checked against the user's contract before replacing it.

This is a candidate example of low-value coupling, not proof that all asset checks are wasteful. It is outside GLLA's edit boundary. Record a downstream recommendation only; do not rewrite Hegemon in this work.

### E3. Source-string assertions fail on explanations (confirmed; GLLA-owned)

`tests/ci-workflow-concurrency.test.ts:67-72` rejects phrases in workflow comments. In this session at 02:03–02:04, the correction comment itself quoted obsolete wording, so the check failed despite unchanged workflow behavior; the executor reworded the explanation to pass.

Similarly, the recent settings work had call-shape assertions fail when a builder gained another legitimate argument and when per-role output replaced a whole-map formatter. The later behavioral headless test in `tests/subagent-fallback-provenance.test.ts` is stronger evidence of output behavior than grepping for a function name.

Do not infer all static checks are wrong. Declarative workflows, package manifests, import boundaries, and security fences may need static checks. They should inspect the relevant configuration/structure rather than incidental comments, whitespace, or unrelated text, and state what risk they protect.

### E4. Loop incentives lack a value threshold (observed wording; causality unproven)

`prompts/goal-loop-forever-metricless.md:45-60` names “a test added” as an example of real progress and also prohibits cosmetic churn and instructs the agent not to invent work after exhaustion. The latter safeguards exist, but there is no explicit requirement that a new test protect a named, meaningful behavior or previously uncovered risk.

Hypothesis: an indefinitely supplied work loop can favor easy assertions over higher-value product work. The evidence does not establish that this wording caused the external favicon test. Updating guidance is a preventive proposal, not a demonstrated automatic cure for executor judgment.

### E5. Screenshot wait: intentional abort and duplicate explanation (confirmed)

Screenshot: `/home/dracon/Pictures/Screenshots/Screenshot_20261017_224104.png`.
Local session: `~/.pi/agent/sessions/--home-dracon-Dev-db-gateway--/2026-10-16T18-26-56-424Z_01a145f7-9727-71ee-916a-507216c9a5ab.jsonl`.

Observed timeline on 2026-10-17, UTC:
- 21:39:20.453: `pause_goal(kind="wait", resumeAt="2026-10-17T22:30:00Z")`.
- 21:39:20.492: assistant stop is `error`, error text `This operation was aborted`.
- 22:31:47.646: resumed executor checks backup attempts.
- 22:33:11.425: executor submits `complete_goal`.

The contract required observing an hourly backup; the wait itself was not evidence of needless testing. The observed resumed work contradicts a claim that this particular wake failed. It does not prove every scheduled wake is reliable or that the saved deadline guarantees an exact execution time.

The screenshot repeats the reason/deadline in tool output, notification, persistent card, and footer. Source: `extensions/loops/goal-tools.ts:3080-3145` sends the card, emits a scheduled-wait notification, marks the pause, invokes `ctx.abort()`, and returns a verbose tool result. `extensions/action-reminder.ts` builds the card/intentional-abort notice and fences abort observations by owner, goal, turn, and pause identity.

Important mismatch to investigate before any presentation repair: `extensions/loops/goal-activation.ts:1738-1762` attempts an assistant rewrite only for `stopReason === "aborted"`; this captured provider stop used `error`. The fallback in `maybeScheduleUnsupervisedErrorRetry` distinguishes expected paused aborts and avoids retrying them. Whether the real Pi hook can alter an already rendered transport error is not established here. Existing tests in `tests/scheduled-wait-presentation.test.ts` cover markers and mock-hook behavior, not proof that Pi's red transport line disappears.

## Proposed prioritized repairs

Order expresses dependency and risk, not a claim that all items must ship together. Each row can become a separately approved short implementation item; P3 needs lifecycle review before changing code.

| ID / priority | GLLA-owned change and target | Acceptance evidence for a future implementation | Preserved invariant / risk |
| --- | --- | --- | --- |
| P1 / high | Add evidence-efficient execution guidance to goal, loop and project-builder surfaces that actually reach agents. Inventory `prompts/goal-loop-continuation.md`, `prompts/goal-loop-forever*.md`, `prompts/goal-loop-respec-builder.md`, plus any generated/shared instructions before choosing one canonical source. Require capture once, inspect first, justify reruns. | A captured failed-run fixture can be diagnosed from its log without re-execution; documented bounded shell recipe returns the actual failure status through output capture. Tests cover any executable helper ONLY if an existing runner cannot supply this. Review the final rendered instruction surfaces for contradictions. | Never reuse a pre-change pass as evidence for changed code. No runner rewrite by default; no weakening required gates. Instruction compliance cannot be proven by string presence alone. |
| P2 / high | Introduce a verification-value rule: new tests or test-only loop iterations must name the meaningful behavior/risk and missing coverage; separate user requirements from incidental observed facts. Apply to metricless guidance and relevant review prompts, retaining legitimate test-only fixes. | A small reviewed example set distinguishes an uncovered fallback behavior from favicon byte-size/prose locks; existing explicit artifact requirements and security/static-boundary checks remain eligible. Loop guidance no longer treats test addition alone as sufficient progress. | Do not ban test-first work, file-existence checks, exact protocol assertions, or regression tests categorically. No automatic scoring by number of tests, commits, changed lines, or tests deleted. |
| P2a / medium, after P2 | Repair the demonstrated GLLA comment-text test coupling in `tests/ci-workflow-concurrency.test.ts`; inspect related changed settings assertions only where concrete evidence warrants it. Prefer parsed workflow config or tightly scoped structural checks; do not introduce an evaluator for all GitHub expressions. | Rewording comments/formatting leaves the relevant check green; deliberately removing release separation, changing release cancellation protection, or dropping release gates fails. Mixed-source headless output remains behaviorally verified. | Preserve release/OIDC/tag/provenance gates. Source regex can remain where proportionate and load-bearing; parser dependencies and expression semantics need deliberate handling. No broad test-suite cleanup. |
| P3 / medium | Consolidate GLLA wait messaging around the persistent card. Short tool acknowledgement for the model; footer remains a compact status, full explanation once; avoid a second full notification where the card is visible. Targets: `goal-tools.ts`, `action-reminder.ts`, relevant display/status modules. | Behavioral harness verifies one full human reason/deadline explanation, a bounded acknowledgement, and compact persistent status. With no card/UI capability, a readable fallback still explains the wait. Existing decision/blocked/redirect cases and external notification needs remain covered. | Do not remove `ctx.abort()` merely to remove red text; doing so can allow unauthorized continued work. Preserve wake ownership, deadline wording, explicit holds, journals, and external/headless notice fallback. |
| P3a / medium, alongside P3 | Reproduce expected abort variants (`aborted` vs `error` with abort text) through GLLA's actual public hook path. Consider narrow error-stop presentation handling only when the exact pause/owner/turn marker matches and the host supports it. Targets: `goal-activation.ts`, `action-reminder.ts`, wait-presentation tests. | Synthetic matched abort/error-stop cases do not schedule retries or duplicate warnings; unmarked errors, new turns, changed goals, and foreign owners remain visible. A bounded real-host receipt documents whether transport rendering is affected; lack of suppression is explicitly reported, not treated as a failed pause. | Pi core transport rendering is external. Do not mutate all errors into success, broaden suppression by text alone, or claim the red line is fixable from GLLA without evidence. Real-host testing must use disposable state, not a live infrastructure goal. |

### External dispositions

- Hegemon favicon sizes, prose inventory locks, and comparable other-project cases: evidence only. Suggest downstream removal of unnecessary exact prose/size claims and replacement with intended behavior checks only under that project's authorization.
- Pi's raw abort renderer: external-only if the public hook cannot affect it. GLLA can explain an intentional turn stop concisely and suppress its own redundant diagnostics; a proposed upstream fix belongs in an external proposal, not edits to Pi.
- This plan does not retroactively change any confirmed goal, contract, or archived verdict.

## Risk-based verification policy to implement later

1. **Capture before trimming.** Run a bounded command once with complete output saved and a concise summary displayed. Preserve the command, exit status, relevant revision/change fingerprint, selected files, environment facts needed for interpretation, and artifact path. Private paths and credentials are not public evidence.
2. **Preserve exit status.** Example for bash: `set -o pipefail; timeout 180 node scripts/run-tests.mjs <focused-files> 2>&1 | tee "$log"; status=${PIPESTATUS[0]}; exit "$status"`. Use a fresh writable log location. This recipe is illustrative, not executed by this plan. Inspect retained runner failure evidence before requesting another execution; the runner tail is bounded and not a full-log replacement.
3. **Rerun for a reason.** Valid reasons: relevant implementation/fixture/dependency/environment change; a missing required coverage path; testing a specific flake or isolation hypothesis; recovering from truncated/missing evidence; a narrowly targeted negative control; an explicitly required final gate. Not valid: obtaining a different `grep` view of already captured output. If an existing log is unavailable, one bounded rerun is recovery, not a rule violation.
4. **Match scope to risk.** First check the changed behavior and the smallest consumer set; broaden once for shared state/lifecycle, environment, security or package-boundary changes. Pure planning documents do not justify runtime suites. Declarative CI edits need configuration isolation/gate checks; local unit tests alone do not prove GitHub executed the workflow. Packed-runtime changes require an actual packed smoke, not just source-string matches.
5. **Require current final evidence.** Reuse diagnostic output freely to investigate the same run; reuse passing results only for unchanged relevant inputs. If a required broad release gate is due, execute it. Unrun or failing gates remain unverified. Do not reduce a confirmed contract under the label of efficiency.
6. **Prove value, not volume.** A useful test catches a meaningful regression that plausible harmless changes do not trigger. Suitable examples: wrong fallback chain/source, cross-owner suppression, changed protocol, lost release isolation. Poor defaults: exact explanatory wording, arbitrary SVG byte count, forcing a document to list every incidental directory. Explicit user requirements can make exact artifacts legitimate.
7. **Bound negative controls.** Use focused synthetic fixtures or safe mutations with guaranteed restoration; never mutate a live workflow watched by an auto-pushing daemon just to demonstrate a failing check. Prefer temporary fixtures/isolated copies and include both valid and invalid cases. Do not run a full suite for every guard independently.
8. **Keep completion authority.** Independent completion audit remains mandatory for goal/list. Project verification stays separate. Ordinary loop bounds remain ordinary stopping conditions. A passing plan/prose test is not proof that model behavior changed in production.

## Suggested implementation batches and sequence

1. P1 + P2: a coherent GLLA guidance change with small classification examples and an output-capture recipe; no new framework unless a demonstrated executable gap requires it.
2. P2a: focused replacement of the evidenced comment/call-shape coupling, with behavior/structural invalid cases. External test inventories are not a dependency.
3. P3 + P3a: wait presentation/lifecycle batch. Start with an isolated error-stop reproduction, then reduce duplicate surfaces while preserving fallbacks. Finish with a disposable real-host observation, recording any upstream limitation honestly.

Ship none of these under the planning goal. Each needs its own confirmation and concrete checks appropriate to the resulting implementation. Do not schedule manual user questions halfway through a batch; settle any material host-access decision before authorizing it.

## Planning acceptance checklist

- [x] All four issue classes mapped to observed evidence with source/session references and limits.
- [x] Prioritized GLLA-owned repairs list targets, dependencies, acceptance checks, and preserved invariants.
- [x] Capture/reuse, rerun conditions, focused/broad selection, and incidental-assertion criteria specified without weakening release or completion authority.
- [x] Wait proposal traces intentional aborts, duplicate surfaces and error-stop mismatch; ownership/wake semantics and upstream boundary are explicit.
- [x] Final batch inventory verified as documentation-only (receipt below).

## Review and verification record

- Read-only reviewer completed 2026-10-18 at 10:28:59 UTC: no issues or blockers; source references, bounded acceptance checks, preserved safeguards, and the abort/error mismatch were corroborated. The reviewer did not independently reread external transcripts/screenshot or inspect committed ranges; those remain executor evidence, not reviewer attestations.
- Executor inventory receipt: `git diff --name-status 54f52ca666835fd93a252a04463e0c63b03946ba` lists only this added plan; `git diff --check` against that baseline reports no whitespace errors. Normal host-owned goal bookkeeping is outside the implementation inventory.
- Runtime suites, builds, and typechecks intentionally not run: this is a documentation-only deliverable, not an implementation claim. No test deletion, runtime-setting edit, external-project edit, tag change, or publication action was performed.
- All planning acceptance items above are covered by the evidence, repair table, verification policy, and boundary sections. They do not claim the proposed repairs have shipped or that production agent behavior has changed.

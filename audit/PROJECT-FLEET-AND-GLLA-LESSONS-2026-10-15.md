# Project fleet and /glla lessons — 2026-10-15

## Authority and method

Operator chose **inspect, then fix**: read live project evidence and `/glla` behavior; implement/test proven GLLA-owned defects. No reload/resume, live recovery, external project changes or release publication authorized. This investigation made none. Source changes are unreleased on main; package remains 0.39.33.

Bounded `/proc` discovery identified **24 extant owner PIDs with matching project cwd/owner records** under `/home/dracon/Dev` at **16:24:18Z**. Read their default working-directory `.pi-glla/active.jsonl` projections; sampled active/held checkpoints again through **16:28:07.742Z** and inspected matching detached-job metadata. This is not atomic/global project discovery; opt-in sessionDir roots and projects without such owners are outside the sample. File/PID existence or old saved `active` status alone is not progress proof. External owners continued changing state during inspection.

Only metadata and necessary recorded hold explanations were inspected; no provider probes, SSH commands or live `/glla` mutations were sent to those processes. `/glla` UI behavior was checked through the pure row builder and actual command dispatcher in the isolated MockPi harness, not by claiming a live terminal interaction.

## Timestamped project lessons

| Project / group | Observed evidence and interpretation |
| --- | --- |
| web/studio | Auditing at 16:27:51Z; matching job `audit-mv9r0b3x-zxu5xv-mv9r0b72-cc5738ac`, worker PID 431499 existed, `thinking` with activity around 16:28:05Z, no result at sample. Fresh activity, not a hung-auditor finding. |
| deathrun | Changed from active checkpoint to auditing by 16:27:52Z; matching job `audit-mv9r2nak-7lzi2s-mv9r2ne1-18f47c8c`, worker PID 455595 existed, `producing_report` with activity around 16:28:06Z, no result at sample. No verdict inferred. |
| freeport, polis | Both moved from running completion audits to active checkpoints during the sample, outside this investigation. Do not duplicate their audits or assume the earlier phase is current. |
| capture-anime-girls, eve, outpost-eden, neonbreak, hellhunter | Active saved checkpoints; freshness varies. In particular outpost-eden and neonbreak have older saved state than the sample. No matching current main-agent tool evidence was established here, so execution is **unconfirmed**, not declared healthy or stuck. Hellhunter retains main-model recovery history without a saved deadline in the sampled state; the counter alone is not continuous-failure proof. |
| doomtap | A system wait with a near-term provider retry at the first read, active by the second. This illustrates why a saved retry wait must not be presented as a permanent manual blocker. |
| junk-runner | Active metric loop with provider-recovery history (179 recovery steps at first read). Provider diagnostics identify StepFun upstream/account TPM limiting through another provider wrapper. This is a recorded external condition, not permission to change accounts, quota controls or loop state. No per-step continuous failure assumption. |
| darklord | Last observed GLLA receipt 0.39.30, saved completion `recovery-pending`, cursor-persistence hold at 15:49:10Z, no retry deadline. Consistent with an old loaded version still needing explicit supported recovery after corrected code is loaded. This does not prove the historical IO cause or authorize recovery. Version receipt is evidence, not code-provenance proof. |
| hegemon | Saved decision hold concerns a required test command and substantially mismatching test counts; a completed project-builder record also remains. Do not waive the contract or turn a semantic decision into provider retry consent. Old recovery history coexists with the hold but does not outrank it. |
| dracon-platform root | Saved decision hold at 14:50:46Z, generic reason `provider error`, no pending completion. The saved reason is insufficient to diagnose a new code defect or infer release permission; inspect the owning conversation's actual decision before any recovery. |
| db-gateway | Agent error hold records an external host/network outage and remaining live verification requirements. These are recorded assertions, not independently re-probed here. Old provider recovery history (101 steps) does not override that unrelated hold. Its own diagnostics also report credential-exposure cleanup/rotation concerns: do not copy secrets into reports or argv, and leave credential rotation to an authorized operator. |
| endless-td | Initially held for a quiet-host measurement window; active by 16:25:47Z outside this investigation. A shared-host load requirement is a condition-controlled verification issue, not permission to tune the OS or weaken acceptance. |
| Remaining eight owners | No active goal/loop in the first saved projection: tabmon, clean-web, ai-job-apply, youtube-filter, auto-form-filler, ai-auto-video, dracon-utilities and this GLLA repository. Do not call process existence productive work. |

Version receipts span 0.39.30–0.39.33. Installing a new package does not replace code already loaded elsewhere. No blanket reload/resume was attempted. Durable state after this sample may differ.

### What to retain operationally

1. Separate **fresh audit activity**, **saved active checkpoints with unconfirmed execution**, **paced provider recovery**, **old-version persistence holds**, and **semantic/operator/external dependency holds**. None is interchangeable with another.
2. A configured backup equal to the current session is deduplicated, not extra capacity. Different provider wrappers may share upstream account limits. More ref strings do not establish usable independent capacity; no quota/network probing or model policy changes were performed.
3. Honest settings need to distinguish a configured primary from an actual selection. A menu label must not imply session inheritance if the configured backup list is tried first, nor claim its thinking cap is the selected auditor's effective cap.
4. Keep diagnostics narrowly allowlisted; avoid dumping environments, auth files or raw prompts/provider payloads. Recorded security incidents are operator follow-ups, not grounds for automated key/account/OS changes in GLLA.

## Verified GLLA defects and implemented corrections

### 1. Forbidden session and bare alias re-entry

`resolveAuditorModel` filtered configured refs through ModelSelector, but its implicit session tail bypassed that filter. A forbidden session model could therefore re-enter the ladder after allowed configured candidates, or resurrect a completely forbidden/exhausted chain. A bare model ID could also pass a provider-qualified forbidden policy and resolve to the forbidden canonical identity.

Correction in `extensions/loops/goal-settings-ui.ts`: enforce policy for both the configured ref and resolved canonical provider/model at the central candidate insertion boundary, before deduplication. An empty eligible chain now returns an actionable no-eligible-model error rather than silently restoring the forbidden session. Established allowed primary/fallback/session ordering, same-session-swap policy and retry cadence are unchanged. This is source-owned and independently reproduced with synthetic registry doubles; no claim that this unsafe path was exercised by a live project.

### 2. Fallback-only /glla misrepresentation

With no explicit auditor pin and a non-empty fallback list, established resolver behavior is first eligible configured fallback, then session last resort—even with same-model swap off. The menu showed `session model`, and headless effective-thinking output reasoned about the session instead of acknowledging pending model selection.

Correction: menu labels this `fallback chain (first eligible)` and explains order/deduplication. Headless thinking reports requested level and **pending**, with per-model support checked at dispatch, rather than pretending to know selected capabilities. No ledger-writing resolver or provider check is invoked for that display. Explicit-primary and empty-chain displays retain their existing behavior. `docs/SETTINGS.md` and the settings type comment now state the actual policy, including shared-upstream/duplicate capacity limitations.

## Verification

Five new tests first reproduced all defects against unchanged production code:

```sh
timeout 100 node scripts/run-tests.mjs tests/auditor-fallback-unification.test.ts tests/settings-menu-complete.test.ts tests/auditor-thinking-display.test.ts
```

Before: **56 pass / 5 fail**, exit 1 (`/tmp/glla-fleet-settings-before.log`). Covers forbidden session with allowed alternatives, exhausted forbidden session/alias with both swap modes, canonical alias rejection, menu label and real headless dispatcher output.

After correction, the six-file auditor/settings check passed **84 / 0**. Broader final regression command:

```sh
timeout 150 node scripts/run-tests.mjs tests/auditor-fallback-unification.test.ts tests/auditor-thinking-display.test.ts tests/auditor-ladder-discipline.test.ts tests/auditor-picker-parity.test.ts tests/auditor-fallback-thinking.test.ts tests/settings-menu-complete.test.ts tests/settings-editors.test.ts tests/glla-table-menu.test.ts tests/designer-settings.test.ts
```

Result: **163 pass / 0 fail**, 9 files, exit 0 (`/tmp/glla-fleet-settings-regressions.log`). `timeout 120 npm run check`: exit 0 (`/tmp/glla-fleet-settings-types.log`). Runtime inventory regenerated after source edits; inventory freshness and whitespace checked. All tests use isolated fixtures; external project journals were not test destinations.

No full release gate or independent delegated review performed for this normal-chat bounded repair. No additional reviewer/provider call was authorized or launched. This is targeted behavioral/type validation, not publication readiness or a claim of full-suite coverage. The release remains 0.39.33; new notes stay under Unreleased.

## Disposition

Two proven GLLA issues fixed and tested; other findings retained as timestamped operational lessons, not speculative runtime patches. Provider plans, upstream plugins, OS load, actual external storage health, project contracts and deliberate holds remain outside the implementation boundary. Still-parked sessions require separately authorized supported recovery; already-running audits must not be duplicated.

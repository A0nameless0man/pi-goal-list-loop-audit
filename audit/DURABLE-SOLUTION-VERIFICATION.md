# Durable-solution verification — corrected after disapproval

Status: final full release gate PASSED (exit 0); independent completion approval
is still required. Do not treat this file's existence or any previous completion
narrative as proof. Recorded raw final output: DURABLE-SOLUTION-RELEASE-2026-10-16.md.
The original completion claim was disapproved and tasks 2–4 were reopened. The
original objective and all five acceptance criteria remain unchanged.

Baseline: 6943a00b1e0b84af574dc5902a7e5556a19815f9; package 0.39.34.
The prior summary's 285/293 focused-test totals were inconsistent and counted
repeated cases; they are superseded by the exact gate results below.

## Requirement-to-artifact map

| Contract item | Evidence to inspect |
| --- | --- |
| 1 — concrete all-mode policy map | audit/DURABLE-SOLUTION-CONTRACT.md; shared types/admission in extensions/durable-solution.ts; mode-specific entry points listed in the contract |
| 2 — behavioral admission/lifecycle/outcome evidence | tests/durable-solution-authority.test.ts and tests/durable-solution-judgment.test.ts exercise production tools and temporary journals, including real session_start restore; results below |
| 3 — clean types | npm run check; exact log below |
| 4 — full release verification | Final timeout 3600 npm run release:check: exit 0; 3,985 pass, 1 legitimate environment skip, 0 fail; Jiti, types, inventory, offline extension, pack and installed-artifact smoke all pass. Raw excerpts in DURABLE-SOLUTION-RELEASE-2026-10-16.md. |
| 5 — evidence and touched-file review | This corrected report plus DURABLE-SOLUTION-RELEASE-2026-10-16.md; complete touched-file review, raw final smoke/skips results, baseline/version and no-rollout boundary below. |

## Implementation and negative/positive cases

- One typed, target/revision-bound judgment schema spans owned active goal, list,
  ordinary loop and project loop. New decisions require a named correction and
  concrete evidence; a deferral requires durableBlocked=true, a typed genuine
  blocker and follow-up. Actual workarounds additionally require safety,
  rollback and reproducible verification. These are admitted executor assertions
  for independent review, not assertions that those checks actually passed.
- Positive inline and blocked-workaround admission is covered in all four
  execution shapes. Follow-up, safety/rollback/checks and original objective,
  acceptance contract and project requirements survive actual session restore.
- Unsupported judgments, contradictory blocker flags and incomplete workaround
  fields are refused without a state mutation. Failed journal writes grant no
  decision; corrupt persisted data cannot upgrade itself to host verification.
- Explicit install-only/journal-marker execution claims are rejected before
  audit even with no task list; runtime loading alone cannot prove execution.
  Accepted observation kinds remain executor assertions. Omitting the optional
  outcomeClaims field does not weaken independent semantic verification.
- Legacy task deferrals cannot waive work. Initial completion admission and
  the terminal archive share this invariant. Recovered approvals with open
  work return to rework and discard the obsolete settlement, not an invented
  archive-I/O failure; explicit human holds and their reasons remain intact.
- Specific consent protects completion pivots, repair redrafts, loop refinements
  and project refinements even when initial drafts auto-accept. Committed task
  replacement is opt-in, shows old/new tasks and retained acceptance criteria,
  requires consent, records history and invalidates old revision proof.
- A reproduced continuation bug selected successful checks containing '0 fail'
  and 'No recursive test hazards' as objections. Continuation now prefers the
  explicit Required fixes section; legacy fallback remains when absent.

## Exact bounded checks so far

- `timeout 180 npm run check`: PASS, exit 0, tsc --noEmit.
  Log: /tmp/glla-durable-types-final.log.
- Production lifecycle/regression preflight: 152 pass / 0 fail across 13 files,
  exit 0. Log: /tmp/glla-durable-preflight-final.log. Command:

```sh
timeout 600 node scripts/run-tests.mjs tests/durable-solution-*.test.ts \
 tests/revision-bound-audit.test.ts tests/audit-settlement-restart.test.ts \
 tests/respec-builder.test.ts tests/respec-builder-audit-runtime.test.ts \
 tests/refine-spec-rebaseline.test.ts tests/loop-refine-transaction.test.ts \
 tests/loop-measure-probe-exit.test.ts tests/metric-never-moved-resumable.test.ts \
 tests/durable-choice-ledger.test.ts tests/durable-defer-production-ui.test.ts \
 tests/task-atomicity-gate.test.ts
```

### First full release attempt and failure assessment

`timeout 3600 npm run release:check`: FAIL (exit 1). The full suite finished
with 3,977 pass / 1 skip / 6 fail across 423 files in 1,454 seconds. Packaging
and smoke did not run after that failure. Log:
`/tmp/glla-durable-release-check.log`; status `/tmp/glla-durable-release-status.json`.

The six failures were repaired without removing behavioral assertions:
- Three exact context-size snapshots needed independent remeasurement after the
  common policy added 1,179 text/UTF-8 bytes and 1,186 serialized bytes. Retain
  exact snapshots, provider fields, cardinality and flat/linear growth checks.
  The bounded checkpoint still retains one payload: 29,651 serialized bytes
  at all 5/12/25-history probes. Raw independent measurement:
  `/tmp/glla-durable-context-measurements.json`.
- The active-audit redaction fixture's live timestamp happened to end in .403Z,
  matching its forbidden-provider-text assertion. Freeze irrelevant fixture
  time; retain the entire redaction assertion unchanged.
- The project refinement fixture now answers the specific-consent callback,
  not the initial-draft custom dialog. Keep both decline/accept assertions.
- The pause-abort integration fixture still expected the obsolete resume-first
  text from before the earlier prerequisite-first repair. It now positively
  requires the prerequisite and rejects resume as the primary next action.

Failure-focused recheck (the five affected files plus both dedicated files):
229 pass / 0 fail across 7 files, exit 0, in 127 seconds. Log:
`/tmp/glla-durable-full-failure-recheck.log`.

One legitimate skip: `commit survives the auto-committer daemon (item 32,
env-gated watched repo)`. No assertions/skips were disabled for these repairs.
### Second full attempt and stress-harness correction

Second `timeout 3600 npm run release:check`: FAIL (exit 1). The suite's
180-second no-output watchdog killed a run inside the 2,101-cycle provider
stress file after 1,114 seconds overall. It did not reach packaging/smoke.
Log: `/tmp/glla-durable-release-check-2.log`; retained diagnostics:
`/tmp/glla-test-processes-pqCBeR/failure.json`. No passing full-suite total is
inferred from this terminated run, and host load alone is not a proven cause.

The stress test already allowed 300 seconds per test, but emitted nothing
until an entire case finished. It now reports bounded progress only AFTER
real durable failure/probe assertions pass (first cycle, each 250, final).
A genuinely stuck cycle still stops emitting and remains watchdog-bounded.
Add symmetric beforeEach process-state reset, matching existing afterEach,
so the first stress case does not inherit prior fixtures' singleton holds.
No timeout was raised, no heartbeat timer was added, no cycle/assertion removed.

Isolated diagnostic run: 7 pass / 0 fail, 155 seconds, all 2,101 cycles in
each of goal/list/loop actually verified. Log:
`/tmp/glla-durable-provider-isolated.log`.
Cross-file recheck after symmetric reset (behavioral orchestrator, project
wiring, host boundary, stress and both dedicated files): 213 pass / 0 fail
across 6 files, 199 seconds. Log: `/tmp/glla-durable-stress-crossfile.log`.
Dedicated outcome cases now reject both loaded and executed claims from
installation/journal markers, independently of task counts.

### Final full release result (supersedes failed attempts)

`timeout 3600 npm run release:check`: PASS, exit 0, 2026-10-16T14:32:04Z to
15:12:21Z. Main suite: **3,985 pass / 1 environment-gated skip / 0 fail across
423 files**. Separate Jiti regression: **1 pass / 0 fail**. `tsc --noEmit`,
offline auditor-extension resolution, inventory check, npm pack dry-run and
installed-tarball smoke all passed. Packed worker RPC challenge confirmed;
packed glla-delegate skill loaded with zero diagnostics. Manifest stayed
0.39.34. No publication or live-session reload occurred.

Dedicated contract command: `timeout 300 node scripts/run-tests.mjs
tests/durable-solution-*.test.ts`: **40 pass / 0 fail across 2 files**.
Separate `timeout 180 npm run check`: exit 0. These selected tests are included
in the full-suite count, not added to it. Final raw log:
`/tmp/glla-durable-release-check-3.log`; status:
`/tmp/glla-durable-release-status-3.json`; preflight hashes:
`/tmp/glla-durable-release-inputs-3.json`; dedicated/types logs:
`/tmp/glla-durable-final-dedicated.log`, `/tmp/glla-durable-final-types.log`.
Post-run source/input drift check: empty, including added/deleted input paths.
Final touched-file review check: no missing paths across all 30 baseline-changed
files; package/lock baseline diff empty, version 0.39.34 unchanged. Final
inventory and whitespace checks exit 0. Independent-review excerpts and exact
skip/smoke observations are retained in the tracked
`audit/DURABLE-SOLUTION-RELEASE-2026-10-16.md`.

Pre-gate HEAD was eb04c210b76277cf050c46ce38a98c9098c901c1. Content hashes,
not a moving daemon HEAD alone, identify the tested inputs. Only reviewable
audit evidence is finalized after the gate; tested implementation is unchanged.

## Touched-file review

Baseline comparison: `git diff 6943a00b --name-only`; daemon commits are retained.

| Path | Review |
| --- | --- |
| extensions/durable-solution.ts | Shared bounded typed admission, JSON normalization, target/revision matching, outcome-kind limits and common policy; every judgment remains executor-asserted. |
| extensions/goal-loop-core.ts | Goal metadata/markdown and state-load normalization; common drafting policy; Required fixes preference in continuation. Legacy tasks retain history, not exemptions. |
| extensions/goal-loop-forever.ts | Optional loop judgment state; no metric/bounds semantics changed. |
| extensions/goal-loop.ts | All loop prompt variants receive common policy and retained judgment. User finish remains a stop action. |
| extensions/loops/goal-tools.ts | Owned all-mode judgment admission/persistence; explicit outcome-claim limits; specific scope consent and target fences; explicit task amendment. Initial draft auto-accept remains available. |
| extensions/loops/goal-orchestrator.ts | Shared final refusal/rework transaction for unfinished work; no terminal render on refusal; human holds retained. |
| extensions/loops/goal-auditor-hooks.ts | Normal and recovered settlement reuse the same unfinished-work admission. Existing worker/attempt/revision/archive fences remain. |
| extensions/goal-loop-auditor.ts | Independent goal/project audit guidance explicitly checks root cause, actual runtime behavior and workaround evidence, never merely populated fields. |
| extensions/respec-builder-audit.ts | Project judgment carried into the existing independent audit adapter; requirements still verify individually. |
| extensions/respec-builder-runtime.ts | Pass retained judgment and separate initial draft confirmation from specific scope-amendment consent. |
| extensions/task-batch.ts | All unfinished committed tasks remain open, including legacy stamps; truthful refusal instructions. |
| schemas/goal.schema.json | Document bounded executor-assertion state; remove obsolete task-exemption contract. |
| tests/durable-solution-authority.test.ts | Real tool/temporary-journal tests for goal/list task admission, scope denial and target races; no provider dispatch required. |
| tests/durable-solution-judgment.test.ts | Positive all-mode admission/restore, negative evidence/workaround checks, scope guards, legitimate task amendments, failure persistence, recovered rework, corrupt metadata and actual-objection replay. |
| tests/durable-choice-ledger.test.ts | Existing positive cases supply new required evidence/blocker facts; original compaction/follow-up assertions retained. |
| tests/durable-defer-production-ui.test.ts | Positive fixture supplies evidence; durable-first ordering and repaint assertions unchanged. |
| tests/task-atomicity-gate.test.ts | Explicitly replace obsolete exemption expectations with refusal; retain task atomicity and race coverage. |
| tests/harness/mock-pi.ts | Expose optional isError in the mock result type; no behavior or assertion bypass. |
| tests/context-checkpoint.test.ts | Independently measured new exact serialized-byte pin; retain history-removal, cardinality and flat-growth assertions. |
| tests/context-growth-measurement.test.ts | Refresh exact raw-size snapshots for the common policy; retain exact provider usage, cardinality and linear-growth assertions. |
| tests/behavioral-orchestrator.test.ts | Freeze redaction fixture time to remove accidental .403Z false failures; forbidden-provider-payload assertions unchanged. |
| tests/respec-builder-wiring.test.ts | Route mock scope consent to the actual amendment confirmation callback; preserve rejection and legitimate amendment checks. |
| tests/stale-continuation-integration.test.ts | Enforce the earlier prerequisite-first pause behavior and reject primary resume; keep actual abort replacement/isolation assertions. |
| tests/supervised-provider-exhaustion-runtime.test.ts | Symmetric fixture reset and bounded progress only after asserted durable cycles; retain all 2,101 failures per mode, every assertion and original timeouts. |
| docs/RECOVERY.md | Explain policy, consent, all-mode persistence, claims versus observations, legacy stamps and explicit holds. |
| docs/RUNTIME-INVENTORY.md | Regenerated from real source; final --check and complete release gate passed. |
| CHANGELOG.md | Unreleased behavior notes; preserve earlier pause-card and stranded-loop fixes. |
| audit/DURABLE-SOLUTION-CONTRACT.md | Actual implementation map and explicit limits; no acceptance criterion removed. |
| audit/DURABLE-SOLUTION-VERIFICATION.md | Correct premature evidence claims; retain failed attempts and exact final gates, skip and smoke results. |
| audit/DURABLE-SOLUTION-RELEASE-2026-10-16.md | Tracked raw final-gate excerpts, timestamps, source/input identity, skip reason and isolated package-smoke boundary. |

## Boundaries and limitations

No version bump/publication, provider/credential/settings changes, external
project journals or other live-session reloads. The release smoke script uses a
disposable temporary install and RPC stub, not another real session or provider.
Installation/loading smoke is not live deployment evidence.

GLLA enforces structural obligations and truthful provenance, not automatic
architectural-quality classification or cryptographic authentication of arbitrary
repository artifacts. The independent auditor must inspect/reproduce cited
behavior. A supported workaround admits bounded work under the retained contract,
not completion of unmet requirements. Ordinary loop bounds/plateau/user finish
are not converted into goal audits.

The screenshot's stalled recovery state retained a Codex usage-limit diagnostic,
an in-flight primary probe and a pending switch without confirmed execution.
No provider reset time is inferred and no journal marker is manufactured to
claim that execution succeeded. Current authorized work continues against the
original contract; no global provider or upstream plugin repair is attempted.

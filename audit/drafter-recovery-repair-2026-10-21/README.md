# Drafter recovery repair — first queued finding

Implementation candidate for finding 1 in `audit/glla-command-review-2026-10-21/README.md`. Independent completion review is still required. Findings 2–6 and release preparation are separate queued work; they are not claimed fixed here.

## Root cause and durable correction

The candidate builder included the original session, but runtime recovery discarded every implicit session candidate. Exhaustion and restoration both discarded the lease before restoration succeeded. Delayed recovery also lacked cancellation and generation checks around its awaited host actions.

The recovery cursor now walks all canonical, deduplicated candidate identities. The implicit session default gets one bounded same-model retry; configured candidates are consumed once per lease. The session route resolves thinking from the original session, not the configured drafting dial. Current forbidden-model policy is rechecked after the wait.

Each lease owns an abort controller, captured host API/generation and any in-flight model switch. Cancellation settles/removes its retry timer. Restoration serializes behind an accepted switch, retains the original pair on rejected model/thinking restoration, and only releases that lease after success, explicit user model supersession or lifecycle replacement. A new interview cannot redefine a failed drafter as its original session. A monotonic start sequence prevents a cancelled old start from erasing a newer interview's gate.

The model-selection hook distinguishes GLLA's own in-flight target from genuine user selection, cancelling old retry work immediately for the latter. Every delayed operation rebinds to a live owner; no captured-context fallback can send into a successor. A deliberate thinking-only change during backoff is retained, as is user thinking during restoration.

## Behavioral verification

The production lifecycle is exercised in `tests/list-bare-draft.test.ts`: bare `/list` creates a real lease; `agent_end` with a provider error reaches the real recovery path; real `model_select` events distinguish own switches from manual changes. Tests use mock host APIs, not live model providers. Injectable recovery waiting controls time only; the first provider-error test executes the actual default delay.

Covered failure modes include configured alternatives followed by session inheritance; finite default-session retry; repeated exhaustion; rejected model or thinking restoration followed by successful retry; cancellation during backoff; policy becoming forbidden during backoff; concurrent error notifications; manual model/dial changes; normal reload and file-backed replacement without shutdown; cancellation behind an accepted switch; and a newer interview superseding an older delayed start.

### Checks

- `bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/list-bare-draft.test.ts tests/designer-drafter-policy.test.ts tests/plan-mode.test.ts tests/draft-staging.test.ts tests/draft-template-failure.test.ts tests/model-switch.test.ts`: **62 passed, 0 failed**, `focused.log`.
- `npm run check`: **passed**, `typecheck.log`.
- `npm run test:jiti`: **1 passed, 0 failed**, `jiti.log`; real extension loading still shares the queue/state binding.
- `bun test --parallel=1 --max-concurrency=1 --timeout=120000 audit/glla-command-review-2026-10-21/repro.test.ts -t 'runtime drafter failure'`: **1 passed, 0 failed, 5 filtered**, `original-repro.log`. The original failing scenario now records `recovery=true`, model `session`, thinking `max`, selections `selected,session`.
- `node scripts/generate-inventory.mjs && npm run check:inventory`: **passed** after regeneration.
- `git diff --check`: **passed** for the current working diff. The daemon had already checkpointed implementation edits.

The existing static cleanup guard in `tests/plan-mode.test.ts` was adjusted to allow the awaited model call to return a readiness result, while still requiring exception cleanup. On disposable copies of the actual try/catch fragment, renaming the local readiness variable passes; removing `clearDraftingState()` fails. `pin-perturbation.log` records that check. No live source or published input was mutated for this demonstration.

The full release gate is reserved for the final release-preparation item. No publication or live-session reload was performed, and no existing project is claimed recovered.

## Tested source binding

Implementation checkpoint observed: `c2ee82948` (subsequent daemon commits may contain documentation/evidence only).

```text
bc35b2bf70ff8dbb21844ba028235ab6373de838dded2a3401aa1af0c6cdb3d2  extensions/loops/goal-list-queue.ts
1b32159da968c52bd4a142bef5632f8ef796a9e33934fa0fb8747053ed4d08d4  extensions/loops/goal-activation.ts
9bfefb910109892085e1799b2129a069234d9d5c3e2dce5fa4dedb2b821ef26f  extensions/drafter-recovery.ts
bc5327516276aab16b2c40ee564b73779bf9fdd93105f27ffb970f47d5ff9aba  tests/list-bare-draft.test.ts
d2db6b86134b3c591ac106d11af85024a0cae32c9e7c01d8992139e764218ad7  tests/plan-mode.test.ts
```

# Designer session inheritance across lifecycle changes — 2026-10-21

Repair of finding 4 in [`../glla-command-review-2026-10-21/README.md`](../glla-command-review-2026-10-21/README.md)
("Session-default Designer becomes a stale static session pin"). Finding 3 (on-demand
enablement) is covered separately in
[`../designer-enablement-2026-10-21/README.md`](../designer-enablement-2026-10-21/README.md);
this report does not claim it.

## Contract and root cause

`pi-subagents` resolves a child from the agent definition file when the child starts, so
the managed `Designer.md` is a **launch projection**, not a saved pin. The projection was
written once per session and only refreshed for a Designer-marked goal dispatch, so after
the operator changed the session model or thinking, the next ordinary Designer launch still
read the pair the session had left. The durable direction of the finding was to resolve
inheritance at the actual launch boundary or reliably refresh it through the relevant
lifecycle hooks, while preserving the opt-in rule, and to stop presenting a static
snapshot as live inheritance.

## Durable behavior

- GLLA refreshes the managed Designer projection at every boundary where a Designer launch
  can happen: a model selection, a thinking-level selection, a turn start, and the
  `subagent` tool call that names the Designer role. The refresh consumes the live session
  state (`ctx.model` / `ctx.thinkingLevel`, and the selection events' own values), never a
  startup snapshot.
- The `subagent` tool call is the launch boundary for the ordinary case: pi fires
  `tool_call` before the tool executes and the companion discovers agent definitions
  during execution, so a refresh there reaches the launch that follows it. An ordinary
  Designer invocation outside any Designer-marked goal therefore inherits the current
  session pair.
- A role request is only read from an explicit role request in the tool input
  (`agent`, `tasks`, `chain`, `parallel`). Prose, management actions (`action`) and
  executable scripts never opt the role in.
- Session inheritance stays inheritance: the resolved pair is never written into
  settings, so no stale static pin is created. The managed file carries a provenance note
  that states it is a launch projection refreshed before every Designer launch, and never
  announces a session projection as a saved pin.
- Explicitly selected Designer model/thinking stay independent of the session dial and
  survive every lifecycle and launch boundary byte-for-byte.
- On-demand registration (registered only by an explicit role request or explicit
  configuration) and the disabled setting still win over any inherited pair, and a
  user-owned agent definition file is never overwritten or removed.
- Only GLLA-owned integration hooks are used: pi's public extension events (`model_select`,
  `thinking_level_select`, `before_agent_start`, `tool_call`) and GLLA's own managed
  definition file. No pi-subagents internals are touched.

## Requirement-to-evidence mapping

`tests/designer-settings.test.ts` drives the real extension handlers through the mock host
(`activate(pi.api)` plus `pi.fire(...)` on the actual lifecycle events), with a real
temporary agent directory and real settings files:

- `Designer refreshes its inherited pair at model, thinking, turn and ordinary launch
  boundaries without saving a pin` — the projection follows a `model_select` event whose
  model differs from the model still held by the context (the stale-context case), follows
  a `thinking_level_select` event, follows a turn start with no event at all, and follows
  the ordinary `subagent` tool call that names the Designer with no active goal. It also
  asserts that no `designerModel`/`designerThinkingLevel` appears in the saved settings
  and that the managed file describes itself as a projection rather than a saved pin.
- `Designer explicit model/thinking pins remain independent across actual lifecycle and
  launch boundaries` — a configured pair survives the same boundaries byte-for-byte.
- `Designer lifecycle preserves on-demand registration` /
  `... disabled registration` — a management action never opts in, an explicit ordinary
  role request does (unless disabled), an on-demand registration stays live on later
  launches, and a user-owned file is never overwritten.

`audit/glla-command-review-2026-10-21/repro.test.ts` is the tracked reproducer of the
review finding. Its Designer cases now pass: `session-backed Designer must update when the
session model and thinking change` and `on-demand Designer must stay unregistered until
explicitly requested`. The remaining failures in that file belong to other open items
(a stale assertion about the documented `auditorModel: null` session tombstone, the
thinking-display item and the fallback-slot item) and are not claimed here.

## Companion-compatibility check

The generated file was fed to the real companion discovery
(`pi-subagents` `discoverAgents`, with `PI_CODING_AGENT_DIR` pointed at a temporary agent
directory): the definition is discovered, `model` and `thinking` carry the projected pair,
the provenance note survives as an extra frontmatter field, and discovery reports **no
diagnostics** — the note text does not disturb the frontmatter.

Field observation: the managed `Designer.md` in the live agent directory still carries a
static provider/model pin written by an earlier session
(`openrouter/minimax/minimax-m3.1-flash:free`), which is exactly the stale static pin this
repair removes. It is refreshed at the next launch boundary once the repair is active.

## Regression sensitivity and change tolerance

The lifecycle regressions were checked against deliberate defects in an isolated copy of
the sources (never in the live tree):

| Deliberate defect | Detected by |
| --- | --- |
| `model_select` refresh uses the context model instead of the event model | `Designer refreshes its inherited pair …` (pair mismatch) |
| launch-boundary (`tool_call`) refresh removed | `Designer refreshes its inherited pair …` and `Designer lifecycle preserves on-demand registration` |
| the two writers of the managed file disagree about the provenance note | `Designer explicit model/thinking pins remain independent …` (file bytes change) |
| both writers keep the old "model pinned to …" note | `Designer refreshes its inherited pair …` (the file no longer declares a projection) |
| harmless rewording of the note ("launch projection", "Managed by GLLA") | none — the check is on the claim, not the wording |

## Verification

Executed in the repository with bounded commands:

```sh
timeout 300 bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/designer-settings.test.ts tests/designer-drafter-policy.test.ts tests/subagent-model-override.test.ts
timeout 300 npm run check
timeout 300 bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/settings-editors.test.ts tests/manual-resume-failback.test.ts
timeout 300 bun test --parallel=1 --max-concurrency=1 --timeout=120000 audit/glla-command-review-2026-10-21/repro.test.ts
timeout 60 node scripts/generate-inventory.mjs
timeout 60 node scripts/generate-inventory.mjs --check
git diff --check
```

Results:

- Required behavioral tests: **42 pass, 0 fail**, exit 0 (`/tmp/glla-designer-lifecycle-required.log`).
- Typecheck: **exit 0**, no diagnostics (`/tmp/glla-designer-lifecycle-typecheck.log`).
- Adjacent Designer/settings suites: **53 pass, 0 fail**, exit 0
  (`/tmp/glla-designer-lifecycle-adjacent.log`).
- Tracked review reproducer: the two Designer cases pass; the three other findings in that
  file are open items owned elsewhere (`/tmp/glla-designer-lifecycle-repro.log`).
- Runtime inventory regenerated; `npm run check:inventory` and `git diff --check`: exit 0.

Full-suite execution is not claimed.

Tested source SHA-256:

- `extensions/designer-registration.ts`: `848d77afac89e27c66c3a21b5f90e3f2383cc6789bf582e9f4afd16f0a87a826`
- `extensions/goal-loop-subagents.ts`: `3feff2ecd927467379d79eb4f5525e5d3ea2f5a71f0588baec41cfd61fa6af7b`
- `extensions/designer-model.ts`: `99672965ff5703762dd145ff31c197f7bb361c665d62eee9a4bd2a3b51996185`
- `extensions/loops/goal-activation.ts`: `3b79740ed22687c88f99653dc3bc320f53f9eb9e7102a3377855c737b31f2599`
- `tests/designer-settings.test.ts`: `5930fa2dc01f4a4899f54559093bf8c7d7bb02bd895094a5a59ab8f30cd63a76`

Observed checkpoint: `663caca22` (the daemon may subsequently commit documentation and
evidence without changing these tested source hashes).

An independent fresh-context reviewer rehearsed the verification contract against the
current revision. Its report is recorded in `review.md` in this directory. It found **no
P0/P1 defect** and confirmed all five obligations on static evidence; it had no shell
tool, so the two execution gates were run by the supervisor (results above).

Reviewer findings and their disposition:

- **P2 — a thinking-only Designer selection is not independent of the session dial**
  (`extensions/designer-model.ts`, the session route): an explicit `designerThinkingLevel`
  without an explicit `designerModel` is not carried onto the session route. **Retained,
  not changed.** The Designer tab always picks model and thinking together, so this
  configuration is only reachable from a hand-edited or legacy settings file, and the
  "session route inherits the pair" behavior is an existing intentional contract with its
  own regression test. Changing it would rewrite an existing intentional expectation
  without the user's consent; it is flagged here and in the completion record instead.
- **P2 — a workflow-script launch does not register an on-demand Designer.** **Retained
  by design**: GLLA never infers a role request from prose, management actions or
  executable scripts.
- **P2 — refresh failures were silent.** **Fixed in this repair**: a failed registration
  now has its own outcome and is reported at the launch boundary, so a requested launch
  does not fail later as an unexplained unknown agent
  (`tests/designer-settings.test.ts`, "a failed Designer registration is reported
  instead of failing later as an unknown agent").
- **P2 — the projection is global** and child sessions are excluded by the
  foreign-session guard. Already documented below.
- **Wording nit** — the provenance note names both possible sources of the pair. The
  note never claims a saved pin, so the contract holds; no change.

## Limits

- The projection is global: the managed `Designer.md` is one file for the whole agent
  directory. A nested launch inside a subagent child session keeps the main host's
  projection, because GLLA's foreign-session guard keeps child contexts from rewriting
  the managed file.
- The refresh writes the managed file only; it never writes settings, so an operator who
  wants a fixed Designer pair still configures it on the `/glla` Designer tab.
- The forbidden-session-model case is reported by the startup and settings surfaces, not
  by the lifecycle refresh, so a forbidden model does not append a ledger entry on every
  model, thinking, turn and launch event.
- An explicit `designerThinkingLevel` without an explicit `designerModel` is not carried
  onto the session route: the session route inherits the model **and** the live thinking
  as a pair. The Designer tab always configures model and thinking together, so this
  shape is only reachable from a hand-edited or legacy settings file; the existing
  intentional contract and its regression test were retained rather than rewritten.

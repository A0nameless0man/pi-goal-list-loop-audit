# Explicit auditor session inheritance across settings layers

Implementation candidate for the second queued repair; independent completion approval is pending. This report does not claim the other queued auditor/Designer/release findings are fixed.

## Contract and root cause

Selecting session must use the live session model **and** thinking even when project overrides conceal global auditor pins. Other projects must retain their global settings, explicit backup lists must remain intact, and unrelated settings must survive the edit.

The old editor deleted model/thinking overrides independently by provenance. Project deletion exposed global pins; mixed provenance could mutate a global dial. Absence cannot simultaneously mean ordinary layer inheritance and an explicit session selection.

## Durable behavior

- `auditorModel: null` is a documented, typed explicit session tombstone. The session action saves it in the project file and removes that project's thinking override. Deleting the project model key still means ordinary global inheritance.
- Normalization masks inherited auditor thinking for the explicit session route before invalid-setting reporting. A valid shadowed dial is not logged as junk.
- Runtime resolution puts the live session first for null, followed by eligible configured backups. It does not freeze the model or dial present when the setting was saved. Policy filtering remains intact.
- The menu displays the actual session model and thinking, not a fallback-chain primary.
- Subsequent explicit re-pinning saves the model and dial into the same owning scope, rather than modifying another project's global baseline.
- Partial-patch legacy migration now only rewrites subagent maps present in that patch. Previously it manufactured undefined map entries, which the writer interpreted as requests to delete unrelated project configuration.

## Requirement-to-evidence mapping

`tests/settings-editors.test.ts` executes the real editor and resolver against isolated settings files for four combinations: both project overrides, project model/global dial, project dial/global model, and only global pins.

Each case checks the effective session model/max dial, byte-for-byte unchanged global settings, another project's original global model/dial, retained ordered backup candidates, unrelated project configuration, live model/dial changes after saving, the menu's effective pair, and a later project re-pin that leaves global settings unchanged. Explicit-session normalization is also checked not to report the shadowed valid dial as invalid.

Existing raw-key-deletion checks were replaced with the intentional behavior: session inheritance without a second thinking prompt, while other projects retain their pins. This is not a relaxed deletion check: old project deletion would expose the global model/dial and fail the effective-pair assertions. The fixtures tolerate unrelated project settings and unused registry models; neither changes the required session behavior. Null persistence is an intentional documented settings protocol, not an incidental formatting assertion.

## Current-revision verification

- `timeout 240 bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/settings-editors.test.ts tests/auditor-thinking.test.ts tests/auditor-thinking-display.test.ts` — **62 passed, 0 failed**, exit 0, 9.83 seconds. `required-tests.log`.
- `timeout 240 npm run check` — **passed**, exit 0, no diagnostics. `typecheck.log`.
- Runtime inventory regenerated; `npm run check:inventory` — **passed**. `git diff --check` — **passed**.
- One fresh-context read-only reviewer found no issues/blockers. `review.md`. Its role lacks shell tools: the review was independently static; test/typecheck execution is explicitly supervisor-run, not independently executed.

No live provider requests, installed-session reload, release publication, upstream edits or history rewrite were performed. Full release validation remains with the final queued release-preparation item.

## Source binding

Observed checkpoint: `f92aca464`. The daemon may subsequently commit documentation/evidence without changing these tested source hashes.

```text
c0ef37951704728ebfa7585ced44d63d3db256192f979f2653fa7c3a8c141693  extensions/goal-settings.ts
d55736c79573fc74c570b84b483ad36271a5eff564a19a94c32871c48b8d5873  extensions/loops/goal-settings-ui.ts
613a4e9eb7cb741656ae976826a9ae35175216a44654b93fc46f068afb91e55c  extensions/settings-menu.ts
ff42332e9e8f9dba3570eb9f19e5c5e577db06352c1363bc32f0e3165c0299ff  tests/settings-editors.test.ts
```

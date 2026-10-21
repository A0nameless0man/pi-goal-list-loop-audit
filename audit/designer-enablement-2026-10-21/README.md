# Designer opt-in registration repair — 2026-10-21

## Requirement and correction

An unconfigured startup must not register Designer merely because selection-time resolution provides the session model and thinking. Explicit enablement, configuration and role requests must continue to register it; disabled settings must win, and user-owned agent files must remain untouched.

`extensions/goal-loop-subagents.ts` now separates authorization from resolved payload: when dedicated Designer settings are supplied, registration requires `designerRequested` or `designer.configured`, subject to `designer.disabled`. Model and thinking remain the payload for an authorized registration, not an opt-in signal. `resolveDesignerConfig` already marks explicit enablement, model/thinking pins and nonempty fallback configuration as configured. Generic override behavior is unchanged.

## Behavioral evidence

- `tests/manual-resume-failback.test.ts`: real extension startup with an implicit live session model/max-thinking pair leaves Designer absent. Resuming a goal with an explicit Designer role creates its definition with that session model and max thinking and dispatches the role request.
- `tests/designer-settings.test.ts`: resolved pair alone does not create a file; explicit request and configuration do; returning to unconfigured state removes a managed registration; disabled wins over both request and configuration. User-owned file bytes remain unchanged in unconfigured, requested/configured and disabled states.
- Existing `tests/subagent-model-override.test.ts` protects generic role overrides, explicit Designer selection, repair of managed definitions, legacy cleanup and ownership boundaries.

## Verification

Executed in the repository with bounded commands:

```sh
timeout 240 bun test --parallel=1 --max-concurrency=1 --timeout=120000 tests/manual-resume-failback.test.ts tests/designer-settings.test.ts tests/subagent-model-override.test.ts
timeout 240 npm run check
timeout 30 node scripts/generate-inventory.mjs
timeout 30 npm run check:inventory
git diff --check
```

Required behavioral tests: **28 pass, 0 fail**, exit 0 (5.54 seconds). Typecheck: exit 0, no diagnostics. Inventory check and whitespace check: exit 0. Full-suite execution is not claimed.

Executor logs: `/tmp/glla-designer-enablement-required.log` and `/tmp/glla-designer-enablement-typecheck.log`.

Tested source SHA-256:

- `extensions/goal-loop-subagents.ts`: `94c1e1234bd175d9d6b5ae60cead3b9275f551e30a23361705177034038684f3`
- `tests/manual-resume-failback.test.ts`: `01d80a009353779bd7955afd79084cc505f915eced375eb6efcdf8d3925a9a24`
- `tests/designer-settings.test.ts`: `08da1094bc3400e73d46d1c99dc34e7f668f47a7dedc1ec27f81a5ce1dc48ad1`

Independent reviewer rehearsal (`/tmp/glla-designer-enablement-review.md`) found no issues after inspecting current authorization, configuration, startup, dispatch and ownership seams plus the regression tests. This was a static-only review: the reviewer read executor logs but did not execute commands or independently verify hashes. The helper change had already been auto-committed, so the reviewer inspected its current source directly rather than treating the remaining working-tree diff as the full implementation. Detached goal audit remains separate from this rehearsal.

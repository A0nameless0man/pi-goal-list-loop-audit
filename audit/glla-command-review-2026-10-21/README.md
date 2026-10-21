# `/glla` model, thinking and recovery review

Reviewed implementation revision: `b36d84063` (the source/settings changes from the preceding conversation). This is a scoped code-and-behavior review, not a whole-repository approval, detached goal completion verdict, release validation or live-provider health check. No implementation files were changed in this review.

## Final dispositions for patch 0.39.44

All six findings below are retained as historical observations against `b36d84063`.
The integrated reproducer now passes **6/6** on the repaired tree. Finding 2's old
`undefined` assertion was replaced with the actual contract: production auditor
resolution returns the live session, inherited thinking is not shadowed, and the
global model stays unchanged for other projects. The explicit project session
representation is documented `auditorModel: null`, not deletion that reveals a pin.
Original failure logs remain historical and unchanged.

| Finding | Disposition and behavioral regression | Detailed evidence |
| --- | --- | --- |
| 1 — Drafter recovery loses session/lease | Repaired: real lifecycle recovery, rejected restoration, cancellation, manual selection/thinking and policy rechecks in `tests/list-bare-draft.test.ts` | [Drafter recovery](../drafter-recovery-repair-2026-10-21/README.md) |
| 2 — Session choice unmasks global auditor pins | Repaired: layered session selection, global preservation and later re-pin in `tests/settings-editors.test.ts`; actual headless display in `tests/auditor-thinking-display.test.ts` | [Auditor layers](../auditor-session-layers-2026-10-21/README.md) |
| 3 — Implicit pair enables on-demand Designer | Repaired: actual startup/marked request in `tests/manual-resume-failback.test.ts`; configuration, disabled and ownership boundaries in `tests/designer-settings.test.ts` | [Designer opt-in](../designer-enablement-2026-10-21/README.md) |
| 4 — Designer session inheritance becomes static | Repaired: real model/thinking/turn/tool-call handlers, ordinary no-goal request, explicit pin independence in `tests/designer-settings.test.ts` | [Designer lifecycle](../designer-session-inheritance-2026-10-21/README.md) |
| 5 — Thinking display exceeds dispatch | Repaired: menu/runtime and actual headless parity, max without xhigh, inherited thinking and non-reasoning models in `tests/settings-menu-complete.test.ts` and `tests/auditor-thinking-display.test.ts` | [Thinking parity](../thinking-display-parity-2026-10-21/README.md) |
| 6 — Primary consumes fallback slot ten | Repaired: actual tenth selection for both roles, overflow, aliases, forbidden identities and explicit session order in `tests/designer-drafter-policy.test.ts` | [Ten slots](../ten-role-fallback-slots-2026-10-21/README.md) |

Release gate results are recorded below when observed; the integrated 6/6 result alone
is **not** a release-gate pass. No live project recovery, publication or installed-session
reload is claimed.

## Findings (historical review)

### 1. P1 — Drafter runtime recovery discards the session fallback and its restoration lease

**Locations:** `extensions/loops/goal-list-queue.ts:574`, `extensions/loops/goal-list-queue.ts:619`.

`resolveDrafterModel` supplies a session candidate, but `handleDrafterModelFailure` constructs its recovery chain from only `via === "configured"` candidates. Once the selected model and configured alternatives are exhausted, the handler clears `draftingModelLease` without restoring the original session. `restoreDrafterModel` can no longer restore either its model or its thinking. The drafting-error branch in `extensions/loops/goal-activation.ts:3034` returns without invoking main-model recovery, so that path does not repair the lost lease.

**Observed:** starting an interview on `audit/selected` at `low`, then reporting a 503 and explicitly calling restoration, leaves the main context on `audit/selected` at `low`. The original session at `max` was never attempted/restored; recovery returns false.

**Durable direction:** walk all eligible candidates, including the session pair, recompute thinking for each route, and retain the restoration lease until restoration succeeds or a real user model change supersedes it. Recheck lifecycle/ownership after any awaited recovery delay.

**Final disposition:** repaired; see the final regression map above and [repair evidence](../drafter-recovery-repair-2026-10-21/README.md).

### 2. P1 — Selecting session can reveal an old global auditor pin instead of inheriting the session

**Locations:** `extensions/loops/goal-settings-ui.ts:237`, `extensions/loops/goal-settings-ui.ts:1705`.

The session picker saves `{ auditorModel: undefined, auditorThinkingLevel: undefined }`. The scope-aware writer routes each deletion to the effective layer. If both a project and a global pin exist, deleting the project keys exposes the global keys, while the notification claims session model and thinking are inherited.

**Observed:** global auditor `audit/selected`/`low`, project auditor `audit/other`/`medium`; choosing session results in effective auditor `audit/selected`/`low`, not session inheritance.

**Durable direction:** represent explicit project-level session inheritance instead of conflating it with removing a project override. Do not silently clear unrelated global settings for all projects as a workaround.

**Final disposition:** project-local `auditorModel: null` explicitly inherits the live session pair, keeps configured backups, and leaves global settings intact. See the final regression map above and [layer repair evidence](../auditor-session-layers-2026-10-21/README.md).

### 3. P2 — Default session resolution accidentally enables the on-demand Designer on startup

**Locations:** `extensions/goal-loop-subagents.ts:282`, `extensions/loops/goal-activation.ts:2199`.

Startup passes the resolved implicit session model/thinking to registration. The registration predicate treats any non-undefined model or thinking as an explicit reason to register, even when `configured` and `designerRequested` are false. The new default-pair resolution therefore creates `Designer.md` without a request. This registers a definition; it does not itself spawn a child.

**Observed:** an empty configuration and fresh startup create the managed Designer file. The existing `tests/manual-resume-failback.test.ts:65` test fails independently with `plain startup does not enable Designer` (3 other tests in that file pass).

**Durable direction:** separate eligibility/resolution from enablement; only explicit enablement, configuration or an actual role request should register the role.

### 4. P2 — Session-default Designer becomes a stale static session pin

**Locations:** `extensions/loops/goal-activation.ts:2199`, `extensions/loops/goal-activation.ts:3673`.

The default session pair is written as literal `model:` and `thinking:` frontmatter. The `model_select` handler does not refresh it. Goal continuation refreshes an explicitly Designer-routed task, but that does not cover subsequent ordinary Designer invocations after a user changes the session model.

**Observed:** enable Designer on session `audit/session`/`max`, switch the session to `audit/other`/`low` through `model_select`; the managed file still contains `audit/session`/`max`.

**Durable direction:** resolve inheritance at the actual Designer launch boundary or reliably refresh it through the relevant lifecycle hooks, while preserving the opt-in rule above. A static snapshot must not be presented as live inheritance.

### 5. P2 — Unsupported thinking can be displayed higher than what actually runs

**Location:** `extensions/settings-menu.ts:138`.

`modelThinkingText` substitutes the highest supported level whenever the requested level is unsupported. Runtime auditor/Designer thinking resolution searches downward instead. If `xhigh` is unsupported but `max` is supported, the menu displays `max` while runtime selects `high`.

**Observed:** supported levels `off,minimal,low,medium,high,max`, requested `xhigh`: row is `audit/selected · max (requested xhigh)`; runtime resolution is `high`.

**Durable direction:** share the same per-model level resolver between display and dispatch; never independently infer a higher effective level.

### 6. P2 — A primary consumes one of the ten advertised Designer/Drafter fallback slots

**Locations:** `extensions/designer-model.ts:52`, `extensions/drafter-model.ts:62`.

Both normalize/cap the combined primary-plus-fallback list at ten. The settings UI accepts ten fallback refs independently of the primary. With a primary set, the tenth fallback is discarded before eligibility is checked; the auditor resolver already avoids this cap error.

**Observed:** unavailable primary, nine unavailable alternatives and a valid tenth alternative `audit/other`: both Designer and Drafter select the session instead; the valid configured alternative is absent from the resolved chain.

**Durable direction:** bound the fallback setting independently, then prepend the primary and append the session route with model-aware deduplication.

## Original reproduction and checks (historical)

From repository root:

```sh
bun test --parallel=1 --max-concurrency=1 --timeout=120000 audit/glla-command-review-2026-10-21/repro.test.ts
```

The six tests asserted the intended contract and intentionally **failed on the originally reviewed implementation**. The current reproducer verifies the repaired behavior; its auditor assertion now checks effective behavior rather than the old incidental undefined representation. They use temporary settings, mock host APIs, real GLLA lifecycle handlers and production resolvers; they make no model/provider requests. `repro.log` records the original run from `/tmp`; the tracked reproducer only changes import paths to repository-relative paths.

Additional checks:

- Eight existing focused files: **171 passed, 0 failed**, `focused-existing.log`. These do not cover the six reproduced scenarios.
- Existing `tests/manual-resume-failback.test.ts`: **3 passed, 1 failed**, `designer-isolation.log`; confirms finding 3 without the new reproducer.
- `npm run check`: **passed (exit 0)**, `typecheck.log`. This closes the preceding turns' unverified typecheck result for the same implementation.
- `node scripts/generate-inventory.mjs --check`: **passed**.
- Full `npm test`: exceeded a **240-second** shell budget; **not passing / not completed**. Its partial output already contains the independent Designer opt-in failure; `existing-suite-incomplete.log`.

The original review was **not clean**. Its failures were implementation work, not external blockers or permission to weaken the session-inheritance contract. Final dispositions are indexed above; original verification output is not relabeled as passing. No active project/session was changed or claimed recovered.

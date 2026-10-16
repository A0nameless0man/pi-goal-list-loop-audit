# Durable-solution verification

Baseline: package 0.39.34, working tree at 8fa8603c.
Status: implementation and bounded verification complete; no publication.

## Requirement-to-artifact mapping

| Requirement | Implementation | Test | Result |
| --- | --- | --- | --- |
| Recorded deferrals never waive committed work | extensions/task-batch.ts:131-145 (collectOpenTasks) | task-atomicity-gate.test.ts (3 open tasks including deferral); durable-solution-authority.test.ts (goal+list reload) | PASS |
| Open-task gate runs before the detached auditor is dispatched | extensions/loops/goal-tools.ts:725-739 (gate), extensions/loops/goal-orchestrator.ts:1268-1278 (terminal archive) | durable-solution-authority.test.ts (complete_goal claim refused) | PASS |
| Terminal archive fence covers manual and recovered approved paths | extensions/loops/goal-orchestrator.ts:1268-1278, extensions/loops/goal-auditor-hooks.ts:1180-1188 | durable-solution-authority.test.ts (recovered approval) | PASS |
| Scope changes require explicit per-amendment consent (no draft auto-accept shortcut) | extensions/loops/goal-tools.ts:754-783 | durable-solution-authority.test.ts (agent scope replacement, mid-confirm fence) | PASS |
| Mid-confirm target changes cannot apply consent to a replacement | extensions/loops/goal-tools.ts:773-780 | durable-solution-authority.test.ts (replacement during confirm) | PASS |
| Recorded deferrals do not grant completion-gate exemptions | task-atomicity-gate.test.ts (legacy stamp + claim), durable-solution-authority.test.ts (replay after state reload) | PASS |
| Audit persistence: existing revision-bound and stuck recovery unchanged | revision-bound-audit.test.ts, audit-lifecycle.test.ts, audit-lifecycle-surfaces.test.ts, loop-finish.test.ts, respec-builder*.test.ts | 92 pass, 0 fail |
| Goal/list/loop mode-appropriate behavior preserved | loop-held-start.test.ts, loop-forever.test.ts, audit-markdown-determinism.test.ts, audit-evidence-continuation-isolation.test.ts, auditor-ladder-discipline.test.ts, designer-settings.test.ts, settings-menu-complete.test.ts | 152 pass, 0 fail |
| Typecheck clean | `timeout 120 npm run check` | exit 0 |
| Inventory consistent | `node scripts/generate-inventory.mjs --check` | exit 0 |
| Git whitespace clean | `git diff --check` | exit 0 |
| No publication/version bump | unchanged package.json | n/a |
| No external mutation | no other repo/settings/provider/credential writes | n/a |

## Gate results

```sh
timeout 200 node scripts/run-tests.mjs tests/durable-solution-authority.test.ts
# 8 pass / 0 fail

timeout 200 node scripts/run-tests.mjs tests/task-atomicity-gate.test.ts \
    tests/durable-choice-ledger.test.ts tests/durable-defer-production-ui.test.ts \
    tests/durable-solution-authority.test.ts tests/durability-return-contract.test.ts
# 41 pass / 0 fail

timeout 600 node scripts/run-tests.mjs tests/revision-bound-audit.test.ts \
    tests/loop-finish.test.ts tests/respec-builder.test.ts \
    tests/respec-builder-audit-runtime.test.ts tests/audit-lifecycle.test.ts \
    tests/audit-lifecycle-surfaces.test.ts
# 92 pass / 0 fail

timeout 120 node scripts/run-tests.mjs tests/loop-held-start.test.ts \
    tests/loop-forever.test.ts tests/audit-markdown-determinism.test.ts \
    tests/audit-evidence-continuation-isolation.test.ts \
    tests/auditor-ladder-discipline.test.ts tests/designer-settings.test.ts \
    tests/settings-menu-complete.test.ts
# 152 pass / 0 fail

timeout 120 npm run check && node scripts/generate-inventory.mjs --check \
    && git diff --check
# exit 0
```

Total focused regression: 285 pass / 0 fail across 16 files.

## Representative negative cases

1. Reloaded goal: legacy deferral stamp retained, claim with open task refused; ledger `complete_goal_tasks_refused` written; goal and contract unchanged.
2. Agent scope replacement with auto-accept drafts: confirmation requested with retained contract; denial preserves objective/revision.
3. Mid-confirm target replacement: amendment refused; live state remains the original owner.
4. Recovery path: a settling claim with open tasks is parked (`settlement_unfinished_work_refused`) before any archive.
5. Manual terminal archive: refused when the open-task collection is non-empty.

## Remaining limitations

- The "durable solution" policy covers GLLA-controlled evidence. It cannot
  detect every kind of misleading message; the independent auditor remains
  the canonical authority on completion.
- `loop` and `metricless loop` user `/loop finish` remain a user-authorized
  action and are NOT converted into a goal-completion path. A finish record
  follows existing semantics; lifecycle tests cover it.
- The respec project builder already requires every requirement verified
  before `phase === "complete"`. No further change is required; the durable
  contract in `audit/DURABLE-SOLUTION-CONTRACT.md` records the integration
  boundary.
- The shared `complete_goal` admission now includes an explicit per-amendment
  consent and a mid-confirm fence. UI paths that auto-accept drafts do not
  bypass this consent; tests prove it.
- This change set is local. No npm/GitHub release performed. No external
  project journal, settings, provider or credential mutated. No other live
  session reloaded.

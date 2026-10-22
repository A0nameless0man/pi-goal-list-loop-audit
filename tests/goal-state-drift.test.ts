// pi-goal-list-loop-audit — v0.39.45
// tests/goal-state-drift.test.ts
//
// Audit 2026-10-22 (durable-state seam): the live state must never drift
// from the durable projection (AGENTS.md), and the journal must never claim
// a state the snapshot contradicts.
//
// Before this pass:
//   - updateGoal assigned the NEW goal to RAM before the durable write was
//     proven; a failed persist left the live session holding a goal the
//     ledger never recorded.
//   - setGoal journalled `goal_created` unconditionally, so the row claimed
//     a creation the state line might not carry.
//   - the goal-queue repair path ignored its persist result and journalled
//     a promotion the snapshot may not carry.
//   - createGoal released the cold-load hold in RAM and journalled the
//     release as if it had landed (the 2026-10-19 fix had already replaced
//     that pattern everywhere else).

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { readState, readQueueFromDisk, writeQueueItemFile, queueItemPath, goalStateTransactionPath, type ListItem, type Goal } from "../extensions/goal-loop-core.js";
import { assessSuspiciousObjective, buildRepairTaskObjective } from "../extensions/faulty-objective-recovery.js";
import { state, replaceState, persistStateLine } from "../extensions/goal-state.js";
import { MockPi, makeMockCtx, tmpCwd, seedState } from "./harness/mock-pi.js";
import activate from "../extensions/loops/goal.js";
import { readGoalRuntimeSource } from "./harness/goal-source.js";

const pi = new MockPi();
activate(pi.api);

const GOAL_SRC = readGoalRuntimeSource();

function readLedger(cwd: string): { type: string; value: Record<string, unknown> }[] {
  const file = path.join(cwd, ".pi-glla", "active.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; value: Record<string, unknown> });
}

/** Make the state ledger unwritable WITHOUT touching the rest of .pi-glla:
 * the goal state transaction and the queue sidecars stay writable, so the
 * failure lands exactly on the durable state line. */
function breakStateLedger(cwd: string): () => void {
  const file = path.join(cwd, ".pi-glla", "active.jsonl");
  const mode = fs.statSync(file).mode;
  fs.chmodSync(file, mode & ~0o222);
  return () => { try { fs.chmodSync(file, mode); } catch { /* best effort */ } };
}

const runtime = () => ({
  updateGoal: (globalThis as unknown as { updateGoal: (patch: Record<string, unknown>, ctx: unknown) => boolean }).updateGoal,
  setGoal: (globalThis as unknown as { setGoal: (goal: unknown, ctx: unknown, via?: string) => boolean }).setGoal,
});

afterEach(() => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "persistState");
  if (descriptor && "value" in descriptor) delete (globalThis as Record<string, unknown>).persistState;
});

test("an incomplete projection leaves the live goal equal to what a restart adopts", () => {
  const cwd = tmpCwd();
  const ctx = makeMockCtx(cwd) as never;
  const goal = {
    id: "goal-drift", objective: "Keep the durable projection", policy: "goal" as const,
    status: "active" as const, autoContinue: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    usage: { tokensUsed: 0, tokensLimit: 0 },
  };
  seedState(cwd, { goal, list: [] });
  // The live session must hold the same goal the durable projection does.
  replaceState({ ...state, goal, list: [] } as typeof state);
  persistStateLine(cwd, state);
  const restore = breakStateLedger(cwd);
  let ok: boolean;
  try {
    ok = runtime().updateGoal({ status: "complete", completionSummary: "Outcome: done" }, ctx);
    assert.equal(ok, false, "an incomplete projection reports failure");
  } finally {
    restore();
  }
  // The durable goal-state transaction is the documented commit point, so the
  // update survives even when the JSONL line could not be written. The drift
  // invariant is that RAM matches what a restart ADOPTS — not that every
  // unprojected update is discarded (that would throw away a real commit).
  const adopted = readState(cwd).goal;
  assert.equal(adopted?.status, "complete", "the landed commit point carries the update");
  assert.equal(adopted?.completionSummary, "Outcome: done");
  assert.equal(state.goal?.status, "complete", "the live goal tracks the durable commit it made");
  assert.equal(state.goal?.completionSummary, "Outcome: done");
});

test("a goal update with no durable commit point is not kept in RAM", () => {
  const cwd = tmpCwd();
  const ctx = makeMockCtx(cwd) as never;
  const goal = {
    id: "goal-drift-none", objective: "Keep the durable projection", policy: "goal" as const,
    status: "active" as const, autoContinue: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    usage: { tokensUsed: 0, tokensLimit: 0 },
  };
  seedState(cwd, { goal, list: [] });
  replaceState({ ...state, goal, list: [] } as typeof state);
  persistStateLine(cwd, state);
  // Block the transaction write itself: nothing durable can be committed.
  const txn = goalStateTransactionPath(cwd);
  fs.mkdirSync(txn);
  try {
    assert.equal(runtime().updateGoal({ status: "complete", completionSummary: "Outcome: done" }, ctx), false);
    assert.equal(state.goal?.status, "active", "an uncommitted update is not kept in RAM");
  } finally {
    fs.rmdirSync(txn);
  }
  assert.equal(readState(cwd).goal?.status, "active", "the durable projection still holds the old goal");
});

test("a goal creation is journalled with whether it actually landed", () => {
  const cwd = tmpCwd();
  const ctx = makeMockCtx(cwd) as never;
  replaceState({ goal: null, list: [] });
  persistStateLine(cwd, state);
  const goal = {
    id: "goal-created-ok", objective: "Create a goal", policy: "goal" as const,
    status: "active" as const, autoContinue: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    usage: { tokensUsed: 0, tokensLimit: 0 },
  };
  runtime().setGoal(goal, ctx, "user");
  const row = readLedger(cwd).find((entry) => entry.type === "goal_created");
  assert.ok(row, "the creation is recorded");
  assert.equal(row!.value.persisted, true, "a landed creation says so");
  assert.equal(readState(cwd).goal?.id, "goal-created-ok", "the durable projection carries the goal");
});

test("the goal_created row can state that the creation did not persist", () => {
  // v0.39.45 (audit 2026-10-22): the row used to claim a creation
  // unconditionally. The flag is the honest shape: the journal never says
  // more than the durable projection carries.
  assert.match(GOAL_SRC, /appendLedger\(ctx\.cwd, "goal_created", \{[^}]*persisted: stateLanded/s,
    "the goal_created row must carry whether the state line landed");
});

test("a complete state snapshot replaces the projection instead of merging into it", () => {
  // v0.39.45 (audit 2026-10-22): readState merged every legacy state line
  // field by field, so a field the newest COMPLETE snapshot had dropped
  // (JSON.stringify omits an undefined value — lastModelRef is exactly
  // that case) survived from an older line and came back on a cold start.
  const cwd = tmpCwd();
  const at = new Date().toISOString();
  const complete = (goal: unknown, list: unknown[], extra: Record<string, unknown> = {}) => ({
    type: "state", at,
    value: {
      goal, list, loop: null, mainModelRecovery: null,
      lastCompactionAt: null, postCompactRecovery: null,
      supervisorPausedAt: null, loadHoldAt: null, lastOutcome: null,
      ...extra,
    },
  });
  const file = path.join(cwd, ".pi-glla", "active.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [
    JSON.stringify(complete({ id: "old", status: "active" }, [], { lastModelRef: "old/model" })),
    JSON.stringify(complete(null, [])),
    "",
  ].join("\n"));
  const loaded = readState(cwd);
  assert.equal(loaded.goal, null, "the newest complete snapshot owns the goal");
  assert.equal(loaded.lastModelRef, undefined, "a field the newest snapshot dropped does not resurrect");
});

for (const existingRepair of [false, true]) {
  test(`refused repair promotion rolls back recoverable sidecars (${existingRepair ? "existing" : "new"})`, () => {
    const cwd = tmpCwd();
    const ctx = makeMockCtx(cwd);
    const item: ListItem = { id: "suspicious-item", objective: "Evidence: all tests passed", addedAt: new Date().toISOString(), queueOrder: 1 };
    const assessment = assessSuspiciousObjective(item.objective);
    assert.equal(assessment.suspicious, true);
    const repair: ListItem = {
      id: "existing-repair", addedAt: item.addedAt, queueOrder: 5,
      objective: buildRepairTaskObjective({ policy: "list", objective: item.objective } as Goal, assessment),
    };
    const items = existingRepair ? [item, repair] : [item];
    seedState(cwd, { goal: null, list: items });
    replaceState({ goal: null, list: items });
    persistStateLine(cwd, state);
    for (const queued of items) assert.equal(writeQueueItemFile(cwd, queued).failed, undefined);
    const originalSidecar = existingRepair ? fs.readFileSync(queueItemPath(cwd, repair.id), "utf8") : undefined;
    const promote = (globalThis as unknown as {
      queueRepairAheadOfListItem: (ctx: unknown, item: ListItem, assessment: ReturnType<typeof assessSuspiciousObjective>) => boolean;
    }).queueRepairAheadOfListItem;
    const restore = breakStateLedger(cwd);
    try {
      assert.equal(promote(ctx, item, assessment), false, "refusal propagates to the activation caller");
    } finally { restore(); }
    assert.deepEqual(state.list, items, "RAM order and repair metadata roll back");
    assert.deepEqual(readState(cwd).list?.map(entry => entry.id), items.map(entry => entry.id), "snapshot remains unchanged");
    const recovered = readQueueFromDisk(cwd);
    assert.deepEqual(recovered.map(entry => entry.id).sort(), items.map(entry => entry.id).sort(), "no refused repair resurrects from a sidecar");
    if (existingRepair) assert.deepEqual(JSON.parse(fs.readFileSync(queueItemPath(cwd, repair.id), "utf8")), JSON.parse(originalSidecar!), "old sidecar metadata and order are restored");
    // Successful retry must still promote and persist exactly one repair.
    assert.equal(promote(ctx, item, assessment), true);
    assert.equal(state.list?.length, 2);
    assert.equal(state.list?.[0]?.objective, repair.objective);
    assert.equal(readQueueFromDisk(cwd).length, 2);
  });
}

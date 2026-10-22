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

import { readState } from "../extensions/goal-loop-core.js";
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

test("a failed goal update leaves the live goal equal to the durable one", () => {
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
  try {
    const ok = runtime().updateGoal({ status: "complete", completionSummary: "Outcome: done" }, ctx);
    assert.equal(ok, false, "a failed durable write reports failure");
  } finally {
    restore();
  }
  assert.equal(state.goal?.status, "active", "the live goal is rolled back to the durable one");
  assert.equal(state.goal?.completionSummary, undefined, "the unpersisted update is not kept in RAM");
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

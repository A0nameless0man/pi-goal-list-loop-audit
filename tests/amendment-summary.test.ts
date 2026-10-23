/**
 * v0.39.46 (note.md §2): the committed-plan amendment Confirm is a reviewable
 * summary, not a machine-state dump.
 *
 * The requirement this protects: when a task amendment replaces a real
 * committed plan, the user must be able to SEE the change — which tasks carry
 * over, which are new, and how the counts move — without reading a JSON blob
 * or re-reading an objective and contract they already confirmed. The
 * fail-closed behavior underneath (refuse on a changed proposal target) is
 * unchanged and is exercised here too.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAmendmentSummary } from "../extensions/loops/goal-tools.js";
import type { Task } from "../extensions/goal-loop-core.js";
import activate, { __testOnlyResetStaleFlag, __testOnlyLastConfirmDialog } from "../extensions/loops/goal.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tick, tmpCwd } from "./harness/mock-pi.js";

const pi = new MockPi();
activate(pi.api);
async function freshSession(cwd: string, reason: string) {
  __testOnlyResetStaleFlag();
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `amend-${Math.random()}` } });
  await pi.fire("session_start", { reason }, ctx);
  return ctx;
}

const task = (title: string, status: Task["status"], extra: Partial<Task> = {}): Task =>
  ({ id: title, title, status, subtasks: [], ...extra });

const priorTasks = [
  task("Release/CI hardening", "complete"),
  task("Model-selection parity", "complete"),
  task("Durable projection", "pending"),
];

// ── the summary itself ────────────────────────────────────────────────
test("amendment summary never renders a JSON blob", () => {
  const body = buildAmendmentSummary({
    objective: "Run ONE project audit pass and leave the project in a known state.",
    contract: "a\nb\nc",
    priorContract: "a\nb\nc",
    priorTasks,
    proposedTitles: ["Release/CI hardening", "Model-selection parity", "Durable projection", "Re-audit pass"],
  });
  // The two literal shapes the objective names as forbidden.
  assert.ok(!body.includes('{"version"'), "no serialized task-list object");
  assert.ok(!body.includes('"tasks":'), "no serialized tasks key");
  assert.ok(!body.includes('"status":'), "no serialized status field");
  assert.ok(!body.includes("{" + "\n"), "no pretty-printed object opening");
  assert.ok(!/^\s*[{}[\],]/m.test(body), "no bare JSON punctuation lines");
});

test("amendment summary shows the replacement counts and every proposed title with prior status", () => {
  const proposed = ["Release/CI hardening", "Model-selection parity", "Durable projection", "Re-audit pass"];
  const body = buildAmendmentSummary({
    objective: "Run ONE project audit pass.",
    contract: "a\nb\nc",
    priorContract: "a\nb\nc",
    priorTasks,
    proposedTitles: proposed,
  });
  assert.match(body, /Replacing 3 committed tasks \(2 complete, 1 pending\) with 4/, "the headline decision in the user's terms");
  for (const title of proposed) assert.ok(body.includes(title), `proposed title present: ${title}`);
  assert.match(body, /\[was: complete\]/, "carried-over tasks show their prior status");
  assert.match(body, /\[new\]/, "added tasks are marked, not inferred");
});

test("amendment summary states the contract is unchanged instead of re-printing it", () => {
  const contract = "first check\nsecond check\nthird check";
  const body = buildAmendmentSummary({
    objective: "Some goal.",
    contract,
    priorContract: contract,
    priorTasks,
    proposedTitles: ["Release/CI hardening"],
  });
  assert.match(body, /Contract: unchanged \(3 checks\)/, "quiet when nothing changed");
  assert.ok(!body.includes("third check"), "the contract text is not re-printed verbatim");
  assert.match(body, /Objective and contract are unchanged/, "the consequence is spelled out");
});

test("amendment summary flags a contract change as a revision boundary", () => {
  const body = buildAmendmentSummary({
    objective: "Some goal.",
    contract: "a\nb\nc\nd\ne",
    priorContract: "a\nb",
    priorTasks,
    proposedTitles: ["Release/CI hardening"],
  });
  assert.match(body, /Contract: CHANGED \(2 → 5 checks\)/, "the delta is named");
  assert.match(body, /prior revision proof no longer applies/, "the consequence matches the change");
});

test("amendment summary lists dropped tasks rather than silently losing them", () => {
  const body = buildAmendmentSummary({
    objective: "Some goal.",
    contract: "a",
    priorContract: "a",
    priorTasks: [...priorTasks, task("Obsolete sweep", "pending")],
    proposedTitles: ["Release/CI hardening", "Model-selection parity", "Durable projection"],
  });
  assert.match(body, /Dropped:/, "removals are explicit");
  assert.match(body, /Obsolete sweep \[was: pending\]/, "the dropped task is named with its status");
});

test("amendment summary keeps a long objective to one readable line", () => {
  const long = `Run ONE project audit pass. ${"Additional scope sentence that pads it out. ".repeat(20)}`;
  const body = buildAmendmentSummary({
    objective: long,
    contract: "a",
    priorContract: "a",
    priorTasks,
    proposedTitles: ["Release/CI hardening"],
  });
  const goalLine = body.split("\n").find((l) => l.startsWith("Goal: "))!;
  assert.ok(goalLine.length <= 130, `goal line stays short (got ${goalLine.length})`);
  assert.ok(goalLine.endsWith("…"), "truncation is marked, not silent");
});

test("amendment summary handles a first-time commit with no prior tasks", () => {
  const body = buildAmendmentSummary({
    objective: "Fresh goal.",
    contract: "a\nb",
    priorContract: undefined,
    priorTasks: [],
    proposedTitles: ["One", "Two"],
  });
  assert.match(body, /Committing 2 tasks/, "no misleading 'replacing 0 tasks'");
  assert.match(body, /\[new\]/);
});

// ── the real tool path ────────────────────────────────────────────────
// Exercises propose_task_list against a goal that already owns a committed
// plan, so the AMENDMENT branch (not the plain draft branch) renders.
test("propose_task_list amendment renders the readable summary, not a JSON dump", async () => {
  const cwd = tmpCwd();
  seedState(cwd, {
    goal: seedGoal({
      status: "active",
      objective: "Run ONE project audit pass and leave the project in a known state.",
      verificationContract: "gate passes",
    }),
  });
  const ctx = await freshSession(cwd, "reload");
  await tick();
  const bodies: string[] = [];
  ctx.ui.confirmImpl = async (_t: string, body: string) => { bodies.push(body); return true; };
  ctx.ui.customImpl = async () => "Yes";
  // First proposal commits a plan; the second must AMEND it (replacing branch).
  await pi.runTool("propose_task_list", {
    tasks: [{ title: "Release/CI hardening" }, { title: "Model-selection parity" }, { title: "Durable projection" }],
  }, ctx);
  const afterFirst = readState(cwd) as { goal?: { taskList?: { tasks?: unknown[] } } };
  const committed = afterFirst.goal?.taskList?.tasks?.length ?? 0;
  await pi.runTool("propose_task_list", {
    tasks: [
      { title: "Release/CI hardening" },
      { title: "Model-selection parity" },
      { title: "Durable projection" },
      { title: "Re-audit pass" },
    ],
  }, ctx);
  ctx.ui.confirmImpl = undefined;
  ctx.ui.customImpl = undefined;
  assert.equal(committed, 3, "a 3-task plan was committed by the first proposal");
  assert.ok(bodies.length > 0, `amendment dialog rendered (bodies=${bodies.length})`);
  const body = bodies[bodies.length - 1]!;
  assert.ok(!body.includes('"tasks":'), "no JSON task dump in the live dialog");
  assert.ok(!body.includes('"version":'), "no JSON version key in the live dialog");
  assert.match(body, /Replacing 3 committed tasks/, "real prior counts drive the headline");
  assert.match(body, /Re-audit pass\s+\[new\]/, "the added task is marked");
});

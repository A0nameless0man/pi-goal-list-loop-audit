import assert from "node:assert/strict";
import fs from "node:fs";
import { test, beforeEach, afterEach } from "node:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import activate, { __testOnlyLoadState, __testOnlyRegisterAgentTools, __testOnlyRememberCtx, __testOnlyResetOwnerSession, __testOnlyResetStaleFlag, __testOnlyResetTerminalFlags } from "../extensions/loops/goal.js";
import { readState, type TaskList } from "../extensions/goal-loop-core.js";
import { state } from "../extensions/goal-state.js";
import { archiveCurrentGoal } from "../extensions/loops/goal-orchestrator.js";
import { collectOpenTasks } from "../extensions/task-batch.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tmpCwd } from "./harness/mock-pi.js";

function reset(): void {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  __testOnlyResetTerminalFlags();
}
beforeEach(() => {
  reset();
  fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ autoAcceptDrafts: true }));
});
afterEach(reset);

function tasks(): TaskList {
  return { version: 1, tasks: [{ id: "1", title: "Verify loaded behavior", status: "pending", deferred: { reason: "Install done; runtime unavailable", followUp: "Verify the actual runtime later", at: "2026-10-16T09:00:00.000Z" } }] };
}
function harness(policy: "goal" | "list" = "goal", taskList?: TaskList) {
  const cwd = tmpCwd();
  seedState(cwd, { goal: seedGoal({ id: "durable-authority", status: "active", policy, revision: 1, objective: "Implement and verify the loaded behavior", verificationContract: "Inspect actual runtime behavior", ...(taskList ? { taskList } : {}) }) });
  __testOnlyLoadState(cwd);
  const pi = new MockPi();
  activate(pi.api);
  __testOnlyRegisterAgentTools(pi.api);
  const ctx = makeMockCtx(cwd);
  __testOnlyRememberCtx(ctx as unknown as ExtensionContext);
  return { cwd, pi, ctx };
}
const claim = { completionSummary: "Outcome: installed. Changed: source. Evidence: receipt. Tests: not run — runtime unavailable. Unresolved: loading. Next: none." };

for (const policy of ["goal", "list"] as const) {
  test(`${policy}: legacy deferral after state reload cannot waive unfinished runtime verification`, async () => {
    const { cwd, pi, ctx } = harness(policy, tasks());
    const before = readState(cwd).goal!;
    const result = await pi.runTool("complete_goal", claim, ctx);
    assert.match(result.content[0]!.text, /open committed task/);
    const after = readState(cwd).goal!;
    assert.equal(after.objective, before.objective);
    assert.equal(after.verificationContract, before.verificationContract);
    assert.equal(after.pendingCompletion, undefined);
    assert.equal(after.taskList!.tasks[0]!.status, "pending");
    assert.equal(fs.existsSync(`${cwd}/.pi-glla/archive/${before.id}.md`), false);
  });
}

test("legacy parent and child deferrals are historical notes, not completion authority", () => {
  const list = tasks();
  list.tasks[0]!.subtasks = [{ ...list.tasks[0]!, id: "1.1" }];
  assert.deepEqual(collectOpenTasks(list).map(t => t.id), ["1", "1.1"]);
});

test("agent scope replacement requires specific human consent even when drafts auto-accept", async () => {
  const { cwd, pi, ctx } = harness();
  let confirmations = 0;
  ctx.ui.confirmImpl = async (_title, body) => {
    confirmations++;
    assert.match(body, /Inspect actual runtime behavior/);
    assert.match(body, /Installation only/);
    return false;
  };
  const before = readState(cwd).goal!;
  const result = await pi.runTool("complete_goal", { ...claim, newObjective: "Installation only" }, ctx);
  assert.match(result.content[0]!.text, /not confirmed|not approved|not changed/i);
  assert.equal(confirmations, 1);
  const after = readState(cwd).goal!;
  assert.equal(after.objective, before.objective);
  assert.equal(after.verificationContract, before.verificationContract);
  assert.equal(after.revision, before.revision);
  assert.equal(after.pendingCompletion, undefined);
});

test("a target change during scope confirmation cannot apply consent to the replacement", async () => {
  const { cwd, pi, ctx } = harness();
  ctx.ui.confirmImpl = async () => {
    state.goal = { ...state.goal!, id: "replacement-owner", objective: "Keep replacement intact" };
    return true;
  };
  const result = await pi.runTool("complete_goal", { ...claim, newObjective: "Installation only" }, ctx);
  assert.match(result.content[0]!.text, /changed|stale/i);
  assert.equal(state.goal!.id, "replacement-owner");
  assert.equal(state.goal!.objective, "Keep replacement intact");
  assert.equal(readState(cwd).goal!.objective, "Implement and verify the loaded behavior");
  assert.equal(state.goal!.pendingCompletion, undefined);
});

test("the shared terminal archive fence refuses legacy deferred work, including recovered approvals", () => {
  const { cwd, ctx } = harness("goal", tasks());
  const before = readState(cwd).goal!;
  assert.equal(archiveCurrentGoal(ctx as unknown as ExtensionContext, "complete", "stored auditor approval"), false);
  assert.equal(readState(cwd).goal!.status, before.status);
  assert.equal(state.goal!.taskList!.tasks[0]!.status, "pending");
  assert.equal(fs.existsSync(`${cwd}/.pi-glla/archive/${before.id}.md`), false);
});

test("complete_goal: the gate now blocks a claim whose only task carries a legacy deferral", async () => {
  const { cwd, pi, ctx } = harness("goal", tasks());
  const before = readState(cwd).goal!;
  const res = await pi.runTool("complete_goal", { ...claim, verificationSummary: "Inspect actual runtime behavior" }, ctx);
  const text = res.content[0]!.text;
  assert.match(text, /open committed task/);
  assert.match(text, /Verify loaded behavior/);
  const after = readState(cwd).goal!;
  assert.equal(after.status, before.status);
  assert.equal(after.objective, before.objective);
  assert.equal(after.verificationContract, before.verificationContract);
  assert.equal(after.revision, before.revision);
  assert.equal(after.pendingCompletion, undefined);
  assert.equal(fs.existsSync(`${cwd}/.pi-glla/archive/${before.id}.md`), false);
  assert.match(fs.readFileSync(`${cwd}/.pi-glla/active.jsonl`, "utf8"), /"complete_goal_tasks_refused"/);
});

test("a meaningful newObjective amendment keeps the contract changes unless the user approves them", async () => {
  const { cwd, pi, ctx } = harness();
  const before = readState(cwd).goal!;
  let confirmations = 0;
  ctx.ui.confirmImpl = async () => { confirmations++; return false; };
  const res = await pi.runTool("complete_goal", { ...claim, newObjective: "Mark the source installed, no contract change" }, ctx);
  assert.match(res.content[0]!.text, /not confirmed|not changed/i);
  assert.equal(confirmations, 1);
  const after = readState(cwd).goal!;
  assert.equal(after.objective, before.objective);
  assert.equal(after.verificationContract, before.verificationContract);
  assert.equal(after.revision, before.revision);
  assert.equal(after.pendingCompletion, undefined);
});

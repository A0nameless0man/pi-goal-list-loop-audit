import assert from "node:assert/strict";
import fs from "node:fs";
import { test, afterEach } from "node:test";
import activate, { __testOnlyResetProcessState } from "../extensions/loops/goal.js";
import { readState } from "../extensions/goal-loop-core.js";
import { ACTION_REMINDER_CUSTOM_TYPE, markPauseAbort, markActionReminderTurnStart, consumePauseAbort, observePausedHostAbort, clearPauseAbort } from "../extensions/action-reminder.js";
import { humanCheckTime } from "../extensions/human-handoff.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tmpCwd } from "./harness/mock-pi.js";

let session: { pi: MockPi; ctx: ReturnType<typeof makeMockCtx> } | undefined;
afterEach(async () => {
  if (session) await session.pi.fire("session_shutdown", { reason: "test-end" }, session.ctx);
  session = undefined;
  __testOnlyResetProcessState();
});
async function boot(paused = false) {
  __testOnlyResetProcessState();
  fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!, JSON.stringify({ autoResume: true, aggressiveMode: false }));
  const cwd = tmpCwd(), pi = new MockPi(); activate(pi.api);
  const deadline = new Date(Date.now() + 30 * 60_000).toISOString();
  seedState(cwd, { goal: seedGoal({ status: paused ? "paused" : "active", policy: "list", autoContinue: false,
    ...(paused ? { pauseKind: "wait", pauseReason: "Soak needs more elapsed time", pauseResumeAt: deadline } : {}) }) });
  const ctx = makeMockCtx(cwd);
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await pi.fire("agent_start", {}, ctx);
  session = { pi, ctx };
  return { cwd, pi, ctx, deadline };
}
test("abort disposition cannot cross owner, goal or changed-pause boundaries", () => {
  const ownerSession = {};
  const marker = { ownerSession, goalId: "one", kind: "wait" as const, reason: "soak", resumeCommand: "/list resume", resumeAt: "2026-10-17T01:00:00.000Z" };
  markActionReminderTurnStart(); markPauseAbort(marker);
  assert.ok(consumePauseAbort({ ownerSession, goalId: "one", aborted: true }));
  assert.equal(observePausedHostAbort(marker), "expected");
  assert.equal(observePausedHostAbort(marker), "duplicate");
  assert.equal(observePausedHostAbort({ ...marker, ownerSession: {} }), "unexpected");
  assert.equal(observePausedHostAbort({ ...marker, goalId: "two" }), "unexpected");
  assert.equal(observePausedHostAbort({ ...marker, resumeAt: "2026-10-17T02:00:00.000Z" }), "unexpected");
  markActionReminderTurnStart();
  assert.equal(observePausedHostAbort(marker), "unexpected");
  clearPauseAbort();
  assert.equal(observePausedHostAbort(marker), "unexpected");
});

const abort = () => ({ role: "assistant", content: [], stopReason: "aborted", errorMessage: "This operation was aborted" });
// Pi can expose the transport as an error turn to agent_end even when the
// assistant message_end carries stopReason=aborted (both real paths matter).
const endAbort = () => ({ messages: [{ ...abort(), stopReason: "error" }] });
function observations(cwd: string) {
  return fs.readFileSync(`${cwd}/.pi-glla/active.jsonl`, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line))
    .filter(event => event.type === "unsupervised_error_retry_refused" && event.value.reason === "goal-paused-host-abort");
}

test("scheduled wait tool and card agree: assessment, intentional turn stop, no manual resume", async () => {
  const { cwd, pi, ctx, deadline } = await boot();
  const result = await pi.runTool("pause_goal", { kind: "wait", reason: "Soak needs more elapsed time", resumeAt: deadline }, ctx);
  const card = pi.sent.find(sent => sent.message.customType === ACTION_REMINDER_CUSTOM_TYPE)!.message.content!;
  const text = result.content[0]!.text;
  assert.match(text, /progress check/i);
  assert.match(text, /intentional/i);
  assert.doesNotMatch(text, /\/list resume to continue|Resume after the saved check/i);
  assert.ok(text.includes(humanCheckTime(deadline)));
  assert.match(card, /intentional/i);
  assert.match(card, /host.*abort|Pi.*abort/i);
  assert.match(card, /UTC/);
  assert.equal(readState(cwd).goal!.pauseResumeAt, deadline);
  assert.equal(readState(cwd).goal!.status, "paused");
});

test("matching pause abort is quiet and deduplicated even after message_end consumes its marker", async () => {
  const { cwd, pi, ctx, deadline } = await boot();
  await pi.runTool("pause_goal", { kind: "wait", reason: "Soak needs more elapsed time", resumeAt: deadline }, ctx);
  await pi.fire("message_end", { message: abort() }, ctx);
  await pi.fire("agent_end", endAbort(), ctx);
  await pi.fire("agent_end", endAbort(), ctx);
  assert.equal(ctx.ui.notifies.filter(notice => /host ended the turn/.test(notice.message)).length, 0);
  const recorded = observations(cwd);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0]!.value.expectedPauseAbort, true);
  assert.equal(pi.sent.filter(sent => sent.message.customType === "unsupervised-error-retry").length, 0);
  assert.equal(readState(cwd).goal!.pauseResumeAt, deadline);
});

test("unmarked wait abort is reported once without prescribing resume, and a new turn is not suppressed", async () => {
  const { cwd, pi, ctx, deadline } = await boot(true);
  await pi.fire("agent_end", endAbort(), ctx);
  await pi.fire("agent_end", endAbort(), ctx);
  const notices = ctx.ui.notifies.filter(notice => /host ended the turn/.test(notice.message));
  assert.equal(notices.length, 1);
  assert.doesNotMatch(notices[0]!.message, /Resume after|\/list resume/);
  assert.ok(notices[0]!.message.includes(humanCheckTime(deadline)));
  await pi.fire("agent_start", {}, ctx);
  await pi.fire("agent_end", endAbort(), ctx);
  assert.equal(ctx.ui.notifies.filter(notice => /host ended the turn/.test(notice.message)).length, 2);
  assert.equal(observations(cwd).length, 2);
  assert.equal(readState(cwd).goal!.status, "paused");
});

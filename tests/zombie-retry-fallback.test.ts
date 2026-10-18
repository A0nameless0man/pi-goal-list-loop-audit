// pi-goal-list-loop-audit — v0.39.x
// tests/zombie-retry-fallback.test.ts
//
// Field (screenshot 20261017_163203, hellhunter increment 3): a loop owner
// aborted after 35m of zero stream, retried 3 times on the SAME wedged model
// route (ledger: identical observedStreamAt across all 3 aborts, attempts
// 1-3 dispatched, then refused_streak at count 4 > 3) while the fallback
// stayed healthy. The completed increment could then never be claimed —
// and manual /loop resume is futile, because the streak persists and the
// next abort refuses again at count 5.
//
// The durable fix under test:
//   1. stop → bounded retry → reactivate preserves iteration/builder and
//      re-enables the submission tools (claim/audit) — the eligible path.
//   2. a retry that produced zero new stream (recurrence: same frozen clock)
//      routes the next dispatch via the owned fallback envelope instead of
//      replaying the wedged route.
//   3. no fallback configured degrades to the same-route retry; exhaustion
//      reports the actual cause (attempts, frozen-since) + next action
//      (explicit resume grants a fresh budget) on the durable park itself.
//   4. explicit holds (user stop/pause, supervisor freeze, refinement park,
//      missing-permission) are never auto-cleared: the timer bails and the
//      original reason stands.
//   5. explicit /loop resume resets the streak: the next abort schedules
//      again instead of refusing forever.

import { test, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  __testOnlyResetZombieAutoRetry,
  __testOnlySetZombieRetryDelay,
  __testOnlySetZombieRetryMaxAttempts,
  __testOnlySetZombieFallbackAttempt,
} from "../extensions/loops/goal-activation.js";
import activate, {
  __testOnlyLoadState,
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
  __testOnlyResetTerminalFlags,
} from "../extensions/loops/goal.js";
import { __testOnlyResetZombieRunWatchdog, __testOnlyHeartbeatTick, __testOnlySetZombieRunWindows } from "../extensions/goal-heartbeat.js";
import { readState } from "../extensions/goal-loop-core.js";
import { clearLoopTimer } from "../extensions/goal-loop.js";
import { MockPi, makeMockCtx, tmpCwd, seedState, seedLoop, tick, type MockCtx } from "./harness/mock-pi.js";

const pi = new MockPi();
activate(pi.api);

function readLedger(cwd: string): Array<{ type: string; value: Record<string, unknown> }> {
  return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf-8")
    .trim().split("\n").filter(Boolean)
    .map((l) => JSON.parse(l));
}

let currentCtx: MockCtx | null = null;

async function freshSession(cwd: string, sm: string): Promise<MockCtx> {
  const ctx = makeMockCtx(cwd, { sessionManager: { name: sm } });
  ctx.isIdle = () => false; // host BUSY, zero stream events — the field signature
  let aborts = 0;
  const prevAbort = ctx.abort.bind(ctx);
  ctx.abort = () => { aborts++; try { prevAbort(); } catch { /* mock */ } };
  (ctx as unknown as { aborts: () => number }).aborts = () => aborts;
  await pi.fire("session_start", { reason: "reload" }, ctx);
  return ctx;
}

function abortsOf(ctx: MockCtx): number {
  return (ctx as unknown as { aborts: () => number }).aborts();
}

function buildingLoop(iteration = 3): Record<string, unknown> {
  return seedLoop({
    active: true,
    iteration,
    maxIterations: 10,
    measureCmd: "",
    builder: {
      projectId: "hellhunter-probe",
      phase: "building",
      revision: 2,
      cycle: 3,
      vision: "probe vision",
      requirements: [{ id: "r1", text: "Req one", acceptance: "Observable one works", status: "open" }],
      tasks: [{ id: "t5", text: "Task five", requirementIds: ["r1"], status: "pending" }],
      feedback: [],
      history: [],
    },
  });
}

function zombieStop(loop: { stopReason?: unknown }): boolean {
  return typeof loop.stopReason === "string" && loop.stopReason.includes("zero-stream abort");
}

beforeEach(() => {
  __testOnlyResetStaleFlag();
  __testOnlyResetOwnerSession();
  __testOnlyResetTerminalFlags();
  __testOnlyResetZombieRunWatchdog();
  __testOnlyResetZombieAutoRetry();
  __testOnlySetZombieRetryMaxAttempts(3);
  __testOnlySetZombieFallbackAttempt(null);
});

afterEach(async () => {
  __testOnlySetZombieRunWindows(null);
  __testOnlySetZombieRetryDelay(null);
  __testOnlySetZombieRetryMaxAttempts(null);
  __testOnlySetZombieFallbackAttempt(null);
  __testOnlyResetZombieAutoRetry();
  __testOnlyResetZombieRunWatchdog();
  clearLoopTimer();
  if (currentCtx) {
    await pi.fire("session_shutdown", { reason: "quit" }, currentCtx).catch(() => {});
    currentCtx = null;
  }
});

test("v0.39.x: zero-stream abort auto-retries a loop owner, preserves iteration+builder, and re-enables claim/audit", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const cwd = tmpCwd();
  seedState(cwd, { loop: buildingLoop(3) });
  const ctx = await freshSession(cwd, "zrf-reactivate");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  // Seeded active loops boot onto the cold-restore hold; resume so the
  // watchdog sees a live owner (mirrors the operator-visible path).
  await pi.command("loop", "resume", ctx);
  await tick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "setup: loop resumed");

  __testOnlyHeartbeatTick();
  assert.equal(abortsOf(ctx), 1, "the silent turn is aborted");
  const parked = readState(cwd).loop as { active: boolean; stopReason: string; iteration: number };
  assert.equal(parked.active, false);
  assert.ok(zombieStop(parked), "parked with the zero-stream stop reason");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_scheduled").length, 1);

  // First retry is same-route (no recurrence yet: no prior abort this episode).
  await tick(300);
  const revived = readState(cwd).loop as { active: boolean; stopReason?: string; iteration: number; builder: { phase: string; revision: number; tasks: Array<{ id: string; status: string }> } };
  assert.equal(revived.active, true, "the automatic retry reactivates the loop");
  assert.equal(revived.stopReason, undefined);
  assert.equal(revived.iteration, 3, "iteration preserved");
  assert.equal(revived.builder.phase, "building", "builder phase preserved");
  assert.equal(revived.builder.revision, 2, "builder revision preserved");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_dispatched").length, 1);

  // Submission tools are eligible again with the preserved builder.
  const claimed = await pi.runTool("claim_project_task", { id: "t5" }, ctx);
  assert.match(JSON.stringify(claimed), /Project building/, "claim succeeds after reactivation");
  assert.equal((readState(cwd).loop as { builder: { tasks: Array<{ status: string }> } }).builder.tasks[0]!.status, "claimed");
  const audited = await pi.runTool("audit_project_increment", { claim: "Task five implemented and exercised" }, ctx);
  assert.match(JSON.stringify(audited), /Project auditing/, "audit submit succeeds after reactivation");
});

test("v0.39.x: a recurrence-proven wedge routes the next retry via fallback instead of replaying the route", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const fallbackCalls: Array<{ attempt: number }> = [];
  __testOnlySetZombieFallbackAttempt(async () => { fallbackCalls.push({ attempt: -1 }); return true; });
  const cwd = tmpCwd();
  seedState(cwd, { loop: buildingLoop(3) });
  const ctx = await freshSession(cwd, "zrf-fallback");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  // Seeded active loops boot onto the cold-restore hold; resume so the
  // watchdog sees a live owner (mirrors the operator-visible path).
  await pi.command("loop", "resume", ctx);
  await tick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "setup: loop resumed");

  // Abort #1: fresh episode, same-route retry (no recurrence yet).
  __testOnlyHeartbeatTick();
  assert.equal(abortsOf(ctx), 1);
  await tick(300);
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "first retry reactivates");
  assert.equal(fallbackCalls.length, 0, "first retry replays the route (transient blip tolerated)");

  // The retried turn streams nothing (mock sends never advance the stream
  // clock): abort #2 sees the identical frozen clock — recurrence proven.
  __testOnlyHeartbeatTick();
  assert.equal(abortsOf(ctx), 2, "the still-silent retried turn is aborted again");
  await tick(300);
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "second retry reactivates");
  assert.equal(fallbackCalls.length, 1, "the recurrence-proven retry engages fallback routing");
  const ledger = readLedger(cwd);
  assert.equal(ledger.filter((e) => e.type === "zombie_retry_fallback_engaged").length, 1);
  assert.equal(ledger.filter((e) => e.type === "zombie_auto_retry_dispatched").length, 2);
});

test("v0.39.x: fallback attempt failure degrades to the same-route retry", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  let calls = 0;
  __testOnlySetZombieFallbackAttempt(async () => { calls++; return false; });
  const cwd = tmpCwd();
  seedState(cwd, { loop: buildingLoop(3) });
  const ctx = await freshSession(cwd, "zrf-nofallback");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  // Seeded active loops boot onto the cold-restore hold; resume so the
  // watchdog sees a live owner (mirrors the operator-visible path).
  await pi.command("loop", "resume", ctx);
  await tick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "setup: loop resumed");

  __testOnlyHeartbeatTick();
  await tick(300);
  __testOnlyHeartbeatTick();
  await tick(300);
  assert.equal(calls, 1, "fallback attempted on recurrence");
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "retry still reactivates same-route");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_retry_fallback_skipped").length, 1);
});

test("v0.39.x: exhausted budget reports cause + next action on the park and refuses submission tools while held", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  __testOnlySetZombieRetryMaxAttempts(1);
  const cwd = tmpCwd();
  seedState(cwd, { loop: buildingLoop(3) });
  const ctx = await freshSession(cwd, "zrf-exhaust");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  // Seeded active loops boot onto the cold-restore hold; resume so the
  // watchdog sees a live owner (mirrors the operator-visible path).
  await pi.command("loop", "resume", ctx);
  await tick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "setup: loop resumed");

  __testOnlyHeartbeatTick();
  await tick(300);
  assert.equal((readState(cwd).loop as { active: boolean }).active, true);
  __testOnlyHeartbeatTick();
  const parked = readState(cwd).loop as { active: boolean; stopReason: string };
  assert.equal(parked.active, false, "exhausted budget stays parked");
  const ledger = readLedger(cwd);
  assert.equal(ledger.filter((e) => e.type === "zombie_auto_retry_refused_streak").length, 1);
  assert.match(parked.stopReason, /exhausted after 1 attempt/, "park states the attempt count");
  assert.match(parked.stopReason, /stream frozen since/, "park states the frozen stream clock");
  assert.match(parked.stopReason, /fresh budget/, "park states the next action");
  assert.match(parked.stopReason, /^stopped: automatic zero-stream abort/, "resume prefix intact");

  const claimed = await pi.runTool("claim_project_task", { id: "t5" }, ctx);
  assert.match(JSON.stringify(claimed), /No active respec project builder/, "submission refused while held");
  await tick(300);
  assert.equal((readState(cwd).loop as { active: boolean }).active, false, "exhausted park does not self-resume");
});

test("v0.39.x: explicit /loop resume after exhaustion grants a fresh budget", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  __testOnlySetZombieRetryMaxAttempts(1);
  const cwd = tmpCwd();
  seedState(cwd, { loop: buildingLoop(3) });
  const ctx = await freshSession(cwd, "zrf-resume");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  // Seeded active loops boot onto the cold-restore hold; resume so the
  // watchdog sees a live owner (mirrors the operator-visible path).
  await pi.command("loop", "resume", ctx);
  await tick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "setup: loop resumed");

  __testOnlyHeartbeatTick();
  await tick(300);
  __testOnlyHeartbeatTick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, false, "budget exhausted");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_refused_streak").length, 1);

  await pi.command("loop", "resume", ctx);
  await tick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "explicit resume reactivates");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_retry_streak_reset_on_resume").length, 1);

  // The next silence aborts and SCHEDULES again — no more futile refusal.
  __testOnlyHeartbeatTick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, false);
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_scheduled").length, 2, "fresh budget schedules again");
});

test("v0.39.x: supervisor freeze during the waystation keeps the park standing", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const cwd = tmpCwd();
  seedState(cwd, { loop: buildingLoop(3) });
  const ctx = await freshSession(cwd, "zrf-freeze");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  // Seeded active loops boot onto the cold-restore hold; resume so the
  // watchdog sees a live owner (mirrors the operator-visible path).
  await pi.command("loop", "resume", ctx);
  await tick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "setup: loop resumed");

  __testOnlyHeartbeatTick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, false);
  await pi.command("glla", "pause", ctx);
  await tick(300);
  const parked = readState(cwd).loop as { active: boolean; stopReason: string };
  assert.equal(parked.active, false, "frozen supervisor leaves the park standing");
  assert.ok(zombieStop(parked), "original zero-stream reason untouched");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_dispatched").length, 0, "no automatic dispatch under freeze");
});

test("v0.39.x: an explicit user stop superseding the abort wins over the pending retry", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const cwd = tmpCwd();
  seedState(cwd, { loop: buildingLoop(3) });
  const ctx = await freshSession(cwd, "zrf-supersede");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  // Seeded active loops boot onto the cold-restore hold; resume so the
  // watchdog sees a live owner (mirrors the operator-visible path).
  await pi.command("loop", "resume", ctx);
  await tick();
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "setup: loop resumed");

  __testOnlyHeartbeatTick();
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_scheduled").length, 1);
  await pi.command("loop", "stop", ctx);
  await tick();
  const stopped = readState(cwd).loop as { active: boolean; stopReason: string };
  assert.equal(stopped.active, false);
  await tick(300);
  const after = readState(cwd).loop as { active: boolean; stopReason: string };
  assert.equal(after.active, false, "superseded park stays parked");
  assert.ok(!zombieStop(after), "explicit stop reason stands (no zero-stream substring)");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_dispatched").length, 0, "pending retry bails on the superseded park");
});

test("v0.39.x: auto-retry preserves a refinement-parked builder without overriding the pending scope decision", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const cwd = tmpCwd();
  seedState(cwd, { loop: seedLoop({
    active: true,
    iteration: 3,
    maxIterations: 10,
    measureCmd: "",
    builder: {
      projectId: "hellhunter-probe",
      phase: "replanning",
      revision: 3,
      cycle: 3,
      vision: "probe vision",
      requirements: [{ id: "r1", text: "Req one", acceptance: "Observable one works", status: "open" }],
      tasks: [],
      audit: undefined,
      feedback: [],
      history: [],
      scopeChanges: [{ revision: 3, reason: "gold-gate wording", removedIds: [] }],
    },
  }) });
  const ctx = await freshSession(cwd, "zrf-refine");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  await pi.command("loop", "resume", ctx);
  await tick();

  __testOnlyHeartbeatTick();
  await tick(300);
  const revived = readState(cwd).loop as { active: boolean; builder: { phase: string; revision: number; tasks: unknown[]; scopeChanges: Array<{ reason: string }> } };
  assert.equal(revived.active, true, "infra hold revives the loop");
  assert.equal(revived.builder.phase, "replanning", "explicit refinement park untouched");
  assert.equal(revived.builder.revision, 3);
  assert.deepEqual(revived.builder.tasks, [], "cleared tasks stay cleared — no stale resurrection");
  assert.equal(revived.builder.scopeChanges[0]!.reason, "gold-gate wording", "pending scope decision preserved");
  const claimed = await pi.runTool("claim_project_task", { id: "t5" }, ctx);
  assert.match(JSON.stringify(claimed), /replanning; expected building/, "refinement park gates submission until the scope question is answered");
});

test("v0.39.x: a fresh episode after a fallback episode reports same-route (no stale routing flag)", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const fallbackCalls: unknown[] = [];
  __testOnlySetZombieFallbackAttempt(async () => { fallbackCalls.push(1); return true; });
  const cwd = tmpCwd();
  seedState(cwd, { loop: buildingLoop(3) });
  const ctx = await freshSession(cwd, "zrf-episode");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;
  await pi.command("loop", "resume", ctx);
  await tick();
  const ui = ctx.ui as unknown as { notifies: Array<{ message: string }> };
  // The schedule site also notifies ("starts in ~90s"); only the dispatch
  // site ("starting —") carries the per-attempt routing claim under test.
  const retryNotifies = () => ui.notifies.filter((n) => n.message.includes("Automatic retry") && n.message.includes("starting —"));

  // Episode 1, attempt 1: fresh streak — same-route, honestly reported.
  __testOnlyHeartbeatTick();
  await tick(300);
  assert.equal((readState(cwd).loop as { active: boolean }).active, true);
  assert.equal(fallbackCalls.length, 0);
  assert.equal(retryNotifies().length, 1);
  assert.ok(!retryNotifies()[0]!.message.includes("routed via the fallback model"), "first attempt reports same-route");

  // The retried turn streams: a later hang is a FRESH episode, not a
  // recurrence of episode 1 — its retry must report same-route even though
  // an earlier episode engaged fallback.
  await pi.fire("agent_start", {}, ctx);
  __testOnlyHeartbeatTick();
  await tick(300);
  assert.equal((readState(cwd).loop as { active: boolean }).active, true, "fresh-episode retry reactivates");
  assert.equal(fallbackCalls.length, 0, "fresh episode does not engage fallback");
  assert.equal(retryNotifies().length, 2);
  assert.ok(!retryNotifies()[1]!.message.includes("routed via the fallback model"), "fresh episode reports same-route (stale flag cleared)");

  // Still silent afterwards: the next abort IS recurrent — fallback engages.
  __testOnlyHeartbeatTick();
  await tick(300);
  assert.equal((readState(cwd).loop as { active: boolean }).active, true);
  assert.equal(fallbackCalls.length, 1, "recurrence re-engages fallback");
  assert.equal(retryNotifies().length, 3);
  assert.ok(retryNotifies()[2]!.message.includes("routed via the fallback model"), "recurrent attempt reports fallback routing");
});

test("v0.39.x: a missing-permission park never arms the automatic retry and keeps its reason", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const cwd = tmpCwd();
  const ctx = await freshSession(cwd, "zrf-permission");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;

  await pi.runTool("list_add", { items: ["permission fence item — done when the hold stands"] }, ctx);
  assert.equal((readState(cwd).goal as { status?: string } | null)?.status, "active");
  const paused = await pi.runTool("pause_goal", {
    reason: "missing permission: cannot read /secure/deploy-creds — grant access then /goal resume",
    kind: "blocked",
    interruption: { reason: "missing-permission", evidence: "deploy step requires /secure/deploy-creds which this session cannot read" },
  }, ctx);
  assert.ok(!JSON.stringify(paused).includes("Not paused"), "permission pause admitted");
  const park = readState(cwd).goal as { status?: string; pauseReason?: string } | null;
  assert.equal(park?.status, "paused");
  assert.match(park?.pauseReason ?? "", /missing permission/);
  assert.equal(readLedger(cwd).filter((e) => e.type === "interruption_admitted").length, 1);

  // The watchdog sees a held owner, not a hung turn: nothing arms, nothing
  // dispatches, the permission reason stands. (The pause itself aborts the
  // live turn once — snapshot after it and require no FURTHER abort.)
  const abortsAfterPause = abortsOf(ctx);
  __testOnlyHeartbeatTick();
  assert.equal(abortsOf(ctx), abortsAfterPause, "held turn is never re-aborted");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_scheduled").length, 0, "no retry arms on a permission hold");
  await tick(300);
  const after = readState(cwd).goal as { status?: string; pauseReason?: string } | null;
  assert.equal(after?.status, "paused");
  assert.match(after?.pauseReason ?? "", /missing permission/, "original permission reason stands");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_dispatched").length, 0, "no automatic dispatch under a permission hold");
});

test("v0.39.x: an explicit /goal pause superseding the abort wins over the pending retry", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const cwd = tmpCwd();
  const ctx = await freshSession(cwd, "zrf-goal-supersede");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;

  await pi.runTool("list_add", { items: ["goal supersede item — done when the user pause wins"] }, ctx);
  __testOnlyHeartbeatTick();
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_scheduled").length, 1);
  await pi.command("goal", "pause", ctx);
  await tick();
  const stopped = readState(cwd).goal as { status?: string; pauseReason?: string } | null;
  assert.equal(stopped?.status, "paused");
  await tick(300);
  const after = readState(cwd).goal as { status?: string; pauseReason?: string } | null;
  assert.equal(after?.status, "paused", "superseded park stays parked");
  assert.equal(after?.pauseReason, "paused by user", "explicit pause reason stands");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_auto_retry_dispatched").length, 0, "pending retry bails on the superseded park");
});

test("v0.39.x: goal-owner recurrence routes via fallback and reactivates", async () => {
  __testOnlySetZombieRunWindows(0, 0);
  __testOnlySetZombieRetryDelay(50);
  const fallbackCalls: unknown[] = [];
  __testOnlySetZombieFallbackAttempt(async () => { fallbackCalls.push(1); return true; });
  const cwd = tmpCwd();
  const ctx = await freshSession(cwd, "zrf-goal");
  currentCtx = ctx;
  (globalThis as any).compactionGraceUntil = 0;
  (globalThis as any).postCompletionSettleUntil = 0;

  await pi.runTool("list_add", { items: ["goal recurrence item — done when fallback routing lands"] }, ctx);
  assert.equal((readState(cwd).goal as { status?: string } | null)?.status, "active");

  __testOnlyHeartbeatTick();
  const parked = readState(cwd).goal as { status?: string; pauseReason?: string } | null;
  assert.equal(parked?.status, "paused");
  assert.match(parked?.pauseReason ?? "", /zero-stream abort/);
  await tick(300);
  assert.equal((readState(cwd).goal as { status?: string } | null)?.status, "active", "first retry reactivates");
  assert.equal(fallbackCalls.length, 0, "first retry is same-route");

  __testOnlyHeartbeatTick();
  await tick(300);
  assert.equal((readState(cwd).goal as { status?: string } | null)?.status, "active", "recurrent retry reactivates");
  assert.equal(fallbackCalls.length, 1, "recurrent retry engages fallback routing");
  assert.equal(readLedger(cwd).filter((e) => e.type === "zombie_retry_fallback_engaged").length, 1);
});

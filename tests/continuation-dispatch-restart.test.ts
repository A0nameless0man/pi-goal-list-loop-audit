// pi-goal-list-loop-audit — v0.39.38
// tests/continuation-dispatch-restart.test.ts
//
// Unacknowledged-dispatch restore: a crash between dispatch and start proof
// leaves continuation-dispatch.json on disk with process memory wiped. The
// session_start boundary must reconcile it — recovered forensics for live
// records, stale discard for terminal/expired ones, zero blind resends on
// every path, a visible hold (never silent loss), and exactly one fresh
// re-drive on explicit resume (never a duplicate).

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
  __testOnlyResetTerminalFlags,
} from "../extensions/loops/goal.js";
import { seedGoal, seedState, MockPi, makeMockCtx, tmpCwd, tick, type MockCtx } from "./harness/mock-pi.js";

const pi = new MockPi();
activate(pi.api);

function hostManager(id: string, messages: unknown[]): unknown {
  return {
    name: "main-session-manager",
    getSessionId: () => id,
    buildSessionContext: () => ({ messages }),
  };
}

function loadedCtx(cwd: string, id: string): MockCtx {
  return makeMockCtx(cwd, { sessionManager: hostManager(id, [{ role: "user", content: "hi" }]) });
}

function seedActiveGoal(cwd: string): void {
  seedState(cwd, { goal: seedGoal({ objective: "restart reconcile target — done when proven", autoContinue: true }) });
}

function seedSidecar(cwd: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const dir = path.join(cwd, ".pi-glla");
  fs.mkdirSync(dir, { recursive: true });
  const record = {
    version: 1,
    id: "inst:7:goal-1",
    generation: 7,
    ownerSessionId: "sess-main",
    kind: "goal",
    goalId: "goal-1",
    marker: "[GOAL CONTINUATION goal-1]",
    sentAt: Date.now(),
    phase: "accepted",
    resync: false,
    timeoutMs: 30_000,
    acceptedAt: Date.now(),
    ...overrides,
  };
  fs.writeFileSync(path.join(dir, "continuation-dispatch.json"), `${JSON.stringify(record)}\n`);
  return record;
}

function ledger(cwd: string): string {
  return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf-8");
}

function countLedger(cwd: string, event: string): number {
  return ledger(cwd).split("\n").filter((line) => line.includes(`"${event}"`)).length;
}

function resetModuleState(): void {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  __testOnlyResetTerminalFlags();
}

beforeEach(() => {
  resetModuleState();
  pi.sent.length = 0;
});

afterEach(() => {
  pi.execHandler = null;
  pi.sendMessageError = null;
  resetModuleState();
  pi.sent.length = 0;
});

test("v0.39.38: live accepted dispatch is recovered, held visibly, and never blind-resent", async () => {
  const cwd = tmpCwd();
  seedActiveGoal(cwd);
  const record = seedSidecar(cwd);
  const ctx = loadedCtx(cwd, "sess-main");
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick();

  assert.equal(fs.existsSync(path.join(cwd, ".pi-glla", "continuation-dispatch.json")), false, "the record is consumed");
  assert.equal(countLedger(cwd, "continuation_dispatch_recovered"), 1, "recovered once with its phase");
  assert.match(ledger(cwd), new RegExp(`"continuation_dispatch_recovered"[^{]*{[^}]*"id":"${record.id}"[^}]*"phase":"accepted"`), "recovery names the dispatch and phase");
  assert.equal(countLedger(cwd, "continuation_dispatch_discarded_stale"), 0, "a live record is not stale");
  assert.equal(pi.sent.length, 0, "no blind resend at the restore boundary");
  const notifies = (ctx.ui as unknown as { notifies: Array<{ message: string }> }).notifies;
  assert.ok(
    notifies.some((n) => /held|resume/i.test(n.message)),
    `the hold is user-visible, never silent: ${notifies.map((n) => n.message.slice(0, 80)).join(" | ")}`,
  );
});

test("v0.39.38: second boot finds nothing to consume and sends nothing", async () => {
  const cwd = tmpCwd();
  seedActiveGoal(cwd);
  seedSidecar(cwd);
  await pi.fire("session_start", { reason: "startup" }, loadedCtx(cwd, "sess-main"));
  await tick();
  assert.equal(pi.sent.length, 0);
  await pi.fire("session_shutdown", { reason: "quit" }, loadedCtx(cwd, "sess-main"));
  await pi.fire("session_start", { reason: "startup" }, loadedCtx(cwd, "sess-main"));
  await tick();
  assert.equal(countLedger(cwd, "continuation_dispatch_recovered"), 1, "consume-once: no second recovery");
  assert.equal(pi.sent.length, 0, "no send across either boot");
});

test("v0.39.38: expired accepted dispatch is discarded as stale, never resent", async () => {
  const cwd = tmpCwd();
  seedActiveGoal(cwd);
  const old = Date.now() - 120_000;
  seedSidecar(cwd, { sentAt: old, acceptedAt: old });
  const ctx = loadedCtx(cwd, "sess-main");
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick();

  assert.equal(fs.existsSync(path.join(cwd, ".pi-glla", "continuation-dispatch.json")), false, "the stale record is consumed");
  assert.equal(countLedger(cwd, "continuation_dispatch_recovered"), 0, "an expired record is not called recovered");
  assert.equal(countLedger(cwd, "continuation_dispatch_discarded_stale"), 1, "expiry is named as stale");
  assert.match(ledger(cwd), /"continuation_dispatch_discarded_stale"[^{]*{[^}]*"phase":"accepted"/, "the stale verdict keeps the phase");
  assert.equal(pi.sent.length, 0, "an expired window never refires");
});

test("v0.39.38: failed dispatch is discarded as stale, never resent", async () => {
  const cwd = tmpCwd();
  seedActiveGoal(cwd);
  seedSidecar(cwd, { phase: "failed" });
  await pi.fire("session_start", { reason: "startup" }, loadedCtx(cwd, "sess-main"));
  await tick();

  assert.equal(countLedger(cwd, "continuation_dispatch_recovered"), 0, "a terminal record is not called recovered");
  assert.equal(countLedger(cwd, "continuation_dispatch_discarded_stale"), 1, "terminal phase is named as stale");
  assert.equal(pi.sent.length, 0);
});

test("v0.39.38: prepared-never-sent dispatch is recovered live (write-before-send survives the crash)", async () => {
  const cwd = tmpCwd();
  seedActiveGoal(cwd);
  seedSidecar(cwd, { phase: "prepared" });
  await pi.fire("session_start", { reason: "startup" }, loadedCtx(cwd, "sess-main"));
  await tick();

  assert.equal(countLedger(cwd, "continuation_dispatch_recovered"), 1, "the unsent intent is recovered, not lost");
  assert.equal(pi.sent.length, 0, "recovery itself still sends nothing");
});

test("v0.39.38: explicit resume re-drives exactly one fresh dispatch (no loss, no duplicate)", async () => {
  const cwd = tmpCwd();
  seedActiveGoal(cwd);
  const record = seedSidecar(cwd);
  const ctx = loadedCtx(cwd, "sess-main");
  await pi.fire("session_start", { reason: "startup" }, ctx);
  await tick();
  assert.equal(pi.sent.length, 0, "restore holds without sending");

  await pi.command("goal", "resume", ctx);
  await tick();
  assert.equal(pi.sent.length, 1, "explicit resume re-drives exactly one dispatch");
  const sidecar = JSON.parse(fs.readFileSync(path.join(cwd, ".pi-glla", "continuation-dispatch.json"), "utf8")) as {
    phase: string;
    id: string;
  };
  assert.equal(sidecar.phase, "accepted");
  assert.notEqual(sidecar.id, record.id, "the re-drive carries a fresh identity, never the consumed one");

  // Settle the fresh dispatch with owner start proof so no watchdog outlives the test.
  const prompt = pi.sent[0]!.message.content;
  if (typeof prompt === "string") await pi.fire("before_agent_start", { prompt }, ctx);
  await tick();
  assert.equal(fs.existsSync(path.join(cwd, ".pi-glla", "continuation-dispatch.json")), false, "the fresh dispatch settles normally");
  await pi.command("goal", "pause", ctx);
});

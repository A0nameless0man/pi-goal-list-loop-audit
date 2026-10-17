// v0.39.38: dispatchStartAcknowledged must not claim a durable start it
// could not write. It used to assign the "started" record to the live ref
// and discard persistDispatchRecord's boolean, so an unwritable .pi-glla
// left RAM saying started while the sidecar still said accepted — a restart
// then read the accepted record past its expiry and misread a started turn
// as stuck dispatch (re-arming the start watchdog / resending for a turn
// that was already running).
//
// The fix fails closed: on a persist failure the live ref rolls back to the
// accepted record, the start watchdog stays armed, the gap is ledgered, and
// the ack reports false — a later start-proof event re-acks once storage is
// fixed.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
  __testOnlySetContinuationStartTimeout,
} from "../extensions/loops/goal.js";
import {
  dispatchStartAcknowledged,
  resetContinuationDispatchState,
} from "../extensions/goal-continuation.js";
import { readDispatchRecord } from "../extensions/goal-loop-dispatch.js";
import { MockPi, makeMockCtx, tick, tmpCwd, type MockCtx } from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
const pi = new MockPi();
activate(pi.api);

function waitUntil(predicate: () => boolean, timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return (async () => {
    while (!predicate()) {
      if (Date.now() >= deadline) throw new Error("timed out waiting for the continuation dispatch state");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  })();
}

function ledgerText(cwd: string): string {
  try {
    return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf8");
  } catch {
    return "";
  }
}

function context(cwd: string, name: string): MockCtx {
  return makeMockCtx(cwd, { sessionManager: { name } });
}

let lastCwd = "";

afterEach(() => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  resetContinuationDispatchState(lastCwd);
  __testOnlySetContinuationStartTimeout(null);
  pi.sent.length = 0;
});

test("v0.39.38 a start ack that cannot be persisted fails closed and re-acks after storage recovers", async () => {
  __testOnlyResetStaleFlag();
  // A long watchdog window: the failed ack must leave it armed, and it must
  // not fire between the failed ack and the recovery re-ack below.
  __testOnlySetContinuationStartTimeout(30_000);
  const cwd = tmpCwd();
  resetContinuationDispatchState(cwd);
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ autoResume: true, aggressiveMode: false }));
  lastCwd = cwd;
  const ctx = context(cwd, `start-ack-persist-${Date.now()}-${Math.random()}`);
  await pi.fire("session_start", { reason: "startup" }, ctx);
  try {
    await pi.command("goal", "start-ack persist failure target — done when pinned", ctx);
    await tick();
    await waitUntil(() => pi.sent.length >= 1);
    await waitUntil(() => ledgerText(cwd).includes("continuation_dispatch_accepted"));
    const accepted = readDispatchRecord(cwd);
    assert.ok(accepted && accepted.phase === "accepted", "the live flow leaves an accepted sidecar record");

    // Break ONLY the dispatch sidecar: a directory at the record path makes
    // the atomic temp+rename fail, so the start ack's persist is the first
    // write to fail.
    const sidecar = path.join(cwd, ".pi-glla", "continuation-dispatch.json");
    fs.rmSync(sidecar, { force: true });
    fs.mkdirSync(sidecar, { recursive: true });

    const acked = dispatchStartAcknowledged(ctx as never, "before_agent_start", `prompt carrying ${accepted.marker}`);
    assert.equal(acked, false, "the unpersistable start ack must fail closed");
    await waitUntil(() => ledgerText(cwd).includes("continuation_start_ack_persist_failed"));
    const ledger = ledgerText(cwd);
    assert.doesNotMatch(ledger, /continuation_start_acknowledged/, "no durable 'start acknowledged' claim for an unpersisted ack");

    // Storage recovers: the rolled-back live record is still accepted, so a
    // later start-proof event settles the same dispatch instead of bouncing
    // off a phantom started phase.
    fs.rmdirSync(sidecar);
    const reacked = dispatchStartAcknowledged(ctx as never, "before_agent_start", `prompt carrying ${accepted.marker}`);
    assert.equal(reacked, true, "the re-ack after storage recovery settles the dispatch");
    await waitUntil(() => ledgerText(cwd).includes("continuation_start_acknowledged"));
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

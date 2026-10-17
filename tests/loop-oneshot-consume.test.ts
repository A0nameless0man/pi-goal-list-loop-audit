// v0.39.38: one-shot loop directives must be consumed durably, not just in
// RAM. The loop-turn send path cleared auditReprieveNote / hypothesisFeedback
// / refineHint on the live loop object but never wrote a state line, so a
// crash before the next state write replayed the reprieve/hint prompts on
// the next turn from the still-armed disk snapshot.
//
// The fix persists the consume: on success the disk snapshot agrees the
// one-shots are spent; on a persist failure the live values roll back
// (RAM/disk agreement), the gap is ledgered, and the operator is notified.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
} from "../extensions/loops/goal.js";
import { state } from "../extensions/goal-state.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, seedLoop, seedState, tmpCwd, tick } from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
const pi = new MockPi();
activate(pi.api);

afterEach(() => {
  pi.execHandler = null;
  pi.sent.length = 0;
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
});

const ONESHOTS = {
  auditReprieveNote: "PLATEAU REPRIEVE (1/3): one-shot shove",
  hypothesisFeedback: "one-shot hypothesis feedback",
  refineHint: "one-shot operator refine hint",
} as const;

async function runLoopTurn(cwd: string) {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ autoResume: true, aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  seedState(cwd, {
    loop: seedLoop({
      target: "reduce the todo count",
      measureCmd: "echo 42",
      direction: "min",
      bestValue: 10,
      lastValue: 10,
      iteration: 1,
      ...ONESHOTS,
    }),
  });
  pi.execHandler = (() => ({ code: 0, stdout: "9\n", stderr: "" })) as typeof pi.execHandler;
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `oneshot-consume-${Date.now()}-${Math.random()}` } });
  await pi.fire("session_start", { reason: "reload" }, ctx);
  try {
    await pi.fire("agent_end", {
      messages: [{ role: "assistant", content: [{ type: "text", text: "HYPOTHESIS: fewer todos" }], stopReason: "end_turn" }],
    }, ctx);
    await tick(400);
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
  return ctx;
}

test("v0.39.38 a sent loop turn consumes its one-shot directives on disk", async () => {
  const cwd = tmpCwd();
  await runLoopTurn(cwd);
  assert.ok(pi.sent.length >= 1, "the loop turn was actually sent");
  const sent = pi.sent.map((s) => s.message.content ?? "").join("\n");
  assert.ok(sent.includes(ONESHOTS.refineHint), "the sent turn carried the one-shot hint");
  const disk = readState(cwd).loop as Record<string, unknown> | null;
  assert.equal(disk?.auditReprieveNote, undefined, "the reprieve does not survive on disk past its turn");
  assert.equal(disk?.hypothesisFeedback, undefined, "hypothesis feedback does not survive on disk past its turn");
  assert.equal(disk?.refineHint, undefined, "the refine hint does not survive on disk past its turn");
});

test("v0.39.38 an unpersistable consume re-arms RAM and notifies instead of diverging silently", async () => {
  const cwd = tmpCwd();
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ autoResume: true, aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  seedState(cwd, {
    loop: seedLoop({
      target: "reduce the todo count",
      measureCmd: "echo 42",
      direction: "min",
      bestValue: 10,
      lastValue: 10,
      iteration: 1,
      ...ONESHOTS,
    }),
  });
  pi.execHandler = (() => ({ code: 0, stdout: "9\n", stderr: "" })) as typeof pi.execHandler;
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `oneshot-fail-${Date.now()}-${Math.random()}` } });
  await pi.fire("session_start", { reason: "reload" }, ctx);
  try {
    // Break ONLY the state line: a directory at active.jsonl makes every
    // state-snapshot append fail while the dispatch sidecar (a separate
    // file) keeps working, so the turn still sends and the consume runs.
    const journal = path.join(cwd, ".pi-glla", "active.jsonl");
    fs.rmSync(journal, { force: true });
    fs.mkdirSync(journal, { recursive: true });
    await pi.fire("agent_end", {
      messages: [{ role: "assistant", content: [{ type: "text", text: "HYPOTHESIS: fewer todos" }], stopReason: "end_turn" }],
    }, ctx);
    await tick(400);
    assert.ok(pi.sent.length >= 1, "the loop turn was actually sent");
    const live = (state.loop ?? {}) as Record<string, unknown>;
    assert.equal(live.refineHint, ONESHOTS.refineHint, "RAM re-arms the hint so it agrees with the still-armed disk");
    assert.equal(live.hypothesisFeedback, ONESHOTS.hypothesisFeedback, "RAM re-arms hypothesis feedback");
    assert.equal(live.auditReprieveNote, ONESHOTS.auditReprieveNote, "RAM re-arms the reprieve");
    assert.ok(ctx.ui.matching("one-shot consume could not be persisted").length >= 1, "the operator is told the consume did not land");
  } finally {
    await pi.fire("session_shutdown", { reason: "test-end" }, ctx);
  }
});

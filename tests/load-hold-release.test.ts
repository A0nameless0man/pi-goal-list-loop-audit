// pi-goal-list-loop-audit — the cold-load consent gate release
//
// v0.39.40 (audit 2026-10-19): the release used to be a RAM-only delete that
// was journalled and announced as if it had landed. A refused resume spent
// the gate, the journal claimed a release the durable projection still held,
// and the live state drifted from the durable one.
//
// releaseLoadHoldDurably makes the release durable BEFORE it is claimed:
//   "not-held" — there was no gate; nothing done, nothing claimed.
//   "released" — the gate was held and its release landed durably.
//   "failed"   — the gate was held but the release could not land; the gate
//                stays held and nothing is claimed.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";

import { releaseLoadHoldDurably, type State } from "../extensions/goal-loop-core.js";

/** Swap the ambient persistState writer for the duration of one call. The
 * runtime global is installed by extensions/loops/goal-orchestrator.ts and is
 * configurable, so a test can stand in its own writer. */
function withPersistState(impl: (ctx: unknown) => boolean, run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, "persistState");
  Object.defineProperty(globalThis, "persistState", { configurable: true, writable: true, value: impl });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(globalThis, "persistState", original);
    else delete (globalThis as Record<string, unknown>).persistState;
  }
}

function ctxWith(notices: string[]): { cwd: string; ui: { notify: (message: string, type?: string) => void } } {
  return { cwd: "/fixture", ui: { notify: (message: string) => { notices.push(message); } } };
}

afterEach(() => {
  // Leave no global behind for the next file in this process.
  if (!Object.getOwnPropertyDescriptor(globalThis, "persistState")?.get) {
    // The real global is a getter installed by the orchestrator; only remove
    // a plain value a test left behind.
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "persistState");
    if (descriptor && "value" in descriptor) delete (globalThis as Record<string, unknown>).persistState;
  }
});

test("no hold means nothing is released and nothing is claimed", () => {
  const notices: string[] = [];
  const state = { goal: null } as unknown as State;
  let persisted = 0;
  withPersistState(() => { persisted += 1; return true; }, () => {
    const outcome = releaseLoadHoldDurably(state, ctxWith(notices), "agent-resume");
    assert.equal(outcome, "not-held");
  });
  assert.equal(persisted, 0, "an absent gate is not worth a state write");
  assert.deepEqual(notices, [], "an absent gate is not announced");
});

test("a hold that lands durably is released, journalled and announced", () => {
  const notices: string[] = [];
  const state = { loadHoldAt: 1234 } as unknown as State;
  let journalled: { type: string; value: unknown } | null = null;
  withPersistState(() => true, () => {
    const outcome = releaseLoadHoldDurably(state, {
      cwd: "/fixture",
      ui: { notify: (message: string) => { notices.push(message); } },
    } as never, "agent-resume");
    assert.equal(outcome, "released");
  });
  assert.equal(state.loadHoldAt, undefined, "the gate is cleared");
  assert.ok(notices.some((n) => /automation is live again/i.test(n)), "the release is announced");
  void journalled;
});

test("a hold whose release cannot land stays held and is not claimed", () => {
  const notices: string[] = [];
  const state = { loadHoldAt: 1234 } as unknown as State;
  withPersistState(() => false, () => {
    const outcome = releaseLoadHoldDurably(state, ctxWith(notices), "agent-resume");
    assert.equal(outcome, "failed");
  });
  assert.equal(state.loadHoldAt, 1234, "the gate stays held — live and durable still agree");
  assert.ok(notices.some((n) => /could not be released durably/i.test(n)), "the failure is surfaced");
  assert.ok(!notices.some((n) => /automation is live again/i.test(n)), "a failed release is never announced as one");
});

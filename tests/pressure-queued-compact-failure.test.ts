// 2026-10-11 audit: a pressure attempt stuck in `queued` (claimed but never
// flushed) must not double-recover when some other lane's compaction fails.
// Before the fix, settlePressureAttempt ignored queued attempts, the failure
// fell through to boundary handling, and the live pressure deadline later
// fired a second park + abort on the same episode.
import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import activate, {
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
  __testOnlySetCompactionInFlight,
  __testOnlyResetPostCompactDebt,
} from "../extensions/loops/goal.js";
import { classifyMainModelFailure } from "../extensions/main-model-recovery.js";
import {
  __testOnlySetPressureTimeout,
  claimPressureAttempt,
  clearPressureAttempt,
  pressureAttemptPending,
} from "../extensions/context-pressure-attempt.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tick, tmpCwd } from "./harness/mock-pi.js";

const GLOBAL = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
const original = fs.readFileSync(GLOBAL, "utf8");
let session: { pi: MockPi; ctx: any } | null = null;

async function boot(cwd: string) {
  fs.writeFileSync(GLOBAL, JSON.stringify({ autoResume: true, aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  const pi = new MockPi();
  activate(pi.api);
  const sessionId = `pressure-queued-${Date.now()}-${Math.random()}`;
  const ctx = makeMockCtx(cwd, { sessionManager: { name: sessionId, getSessionId: () => sessionId } });
  (ctx as any).model = { provider: "provider", id: "small" };
  (ctx as any).modelRegistry = {
    find: (provider: string, id: string) => ({ provider, id }),
    hasConfiguredAuth: () => true,
  };
  await pi.fire("session_start", { reason: "reload" }, ctx);
  await tick(80);
  session = { pi, ctx };
  return { pi, ctx };
}

afterEach(async () => {
  if (session) {
    const current = session;
    session = null;
    __testOnlySetCompactionInFlight(null);
    __testOnlyResetPostCompactDebt();
    await current.pi.fire("session_shutdown", { reason: "test-end" }, current.ctx).catch(() => {});
  }
  __testOnlySetPressureTimeout(undefined);
  fs.writeFileSync(GLOBAL, original);
});

test("a queued pressure attempt is consumed by another lane's compact failure, never double-parked", async () => {
  __testOnlySetPressureTimeout(60);
  const cwd = tmpCwd();
  seedState(cwd, { goal: seedGoal({ status: "active", objective: "survive another lane's failed compaction" }) });
  const { pi, ctx } = await boot(cwd);
  // Keep the attempt queued: pending messages block the admission flush.
  ctx.hasPendingMessages = () => true;
  const events: string[] = [];
  let timeouts = 0;
  assert.equal(claimPressureAttempt(ctx, {
    failure: classifyMainModelFailure("provider failed"),
    valid: () => true,
    fallback: () => {},
    record: (e: string) => { events.push(e); },
    timeout: () => { timeouts++; },
  }), true);
  assert.equal(pressureAttemptPending(ctx), true, "attempt starts queued");

  await pi.fire("session_compact_failed", {
    reason: "overflow",
    errorMessage: "generation hit the token cap and the summary is incomplete",
    aborted: false,
    willRetry: true,
    fromExtension: false,
  }, ctx);
  await tick(30);

  assert.equal(pressureAttemptPending(ctx), false, "the queued attempt is consumed, not left live");
  assert.ok(events.includes("aborted"), `queued attempt transcript marks the abort: ${events.join(",")}`);
  await new Promise((r) => setTimeout(r, 180));
  assert.equal(timeouts, 0, "the cleared deadline never fires a second recovery");
  clearPressureAttempt(ctx);
});

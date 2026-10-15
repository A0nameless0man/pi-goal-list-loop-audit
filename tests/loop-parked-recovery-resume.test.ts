import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import activate, { __testOnlyResetOwnerSession, __testOnlyResetStaleFlag } from "../extensions/loops/goal.js";
import { MockPi, makeMockCtx, seedLoop, seedState, tick, tmpCwd } from "./harness/mock-pi.js";

// Field 2026-10-15 (junk-runner): a loop parked at iter 11 with saved
// main-model recovery (backup selected, attempts made, episode aging) but
// NO armed retry timer and NO manual-resume flag answered every resume
// verb with a shrug, while the widget card promised "work is saved ·
// /loop resume retries the recovery". The recovery was stranded: the
// resume paths only recognized manualResumeRequired or an armed
// retryAt/pendingModelSwitch, so a timer-less saved recovery fell through
// to "Nothing to resume" / "No held loop to resume".

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;

function seedStranded(cwd: string) {
  // No goal (matches the stranded session: nothing paused, nothing active).
  // Loop inactive with a stopReason outside RESUMABLE_STOP; recovery holds
  // real attempts but no timer and no manual flag.
  seedState(cwd, {
    loop: seedLoop({ active: false, stopReason: "user wipe (/glla wipe)", iteration: 11, target: "Build the intended project" }),
    mainModelRecovery: {
      primary: "minimax/MiniMax-M3.1-Flash",
      active: "minimax/MiniMax-M3.1-Flash",
      attempted: ["kilocode/stepfun/step-5-preview-free", "minimax/MiniMax-M3.1-Flash"],
      attempts: 22,
      reason: "main model transient — provider 429",
      kind: "loop",
      firstFailureAt: new Date(Date.now() - 34 * 60_000).toISOString(),
      retryAt: undefined,
      pendingModelSwitch: undefined,
      manualResumeRequired: undefined,
    },
  } as unknown as Parameters<typeof seedState>[1]);
}

async function boot(pi: MockPi, cwd: string) {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ aggressiveMode: false }));
  __testOnlyResetOwnerSession(); __testOnlyResetStaleFlag();
  const ctx = makeMockCtx(cwd, { sessionManager: { name: `parked-recovery-${Math.random()}` } });
  await pi.fire("session_start", { reason: "startup" }, ctx); await tick(120); return ctx;
}
afterEach(() => {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify({ aggressiveMode: false }));
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
});

for (const command of ["loop", "glla"]) {
  test(`${command} resume retries a stranded parked-loop recovery (no timer, no manual flag)`, async () => {
    const cwd = tmpCwd(), pi = new MockPi(); activate(pi.api);
    seedStranded(cwd);
    const ctx = await boot(pi, cwd);
    try {
      await pi.command(command, "resume", ctx);
      await tick(150);
      assert.ok(
        ctx.ui.matching("Retrying the saved main-model recovery now").length > 0,
        `expected the saved recovery to be retried, got: ${ctx.ui.messages.map(m => m.message).join("\n")}`,
      );
      assert.equal(ctx.ui.matching("Nothing to resume").length, 0, "must not shrug while saved recovery exists");
      assert.equal(ctx.ui.matching("No held loop to resume").length, 0, "must not shrug while saved recovery exists");
    } finally { await pi.fire("session_shutdown", { reason: "test-end" }, ctx); }
  });
}

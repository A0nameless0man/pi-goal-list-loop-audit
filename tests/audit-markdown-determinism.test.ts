import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { auditLifecycleProjection, renderGoalMarkdown, writeGoalMd, type Goal } from "../extensions/goal-loop-core.js";

test("legacy snapshot timestamps remain deterministic without freezing live projections", () => {
  const at = "2026-10-14T21:49:07.909Z";
  const goal: Goal = {
    id: "legacy-audit-clock", objective: "Verify legacy recovery", policy: "goal",
    status: "auditing", autoContinue: true,
    createdAt: at, updatedAt: "invalid-legacy-timestamp",
    usage: { tokensUsed: 0, tokensLimit: 0 },
    pendingCompletion: { at, phase: "running", lastActivityAt: at, completionSummary: "Stored" },
  };
  const originalNow = Date.now;
  try {
    for (const fallback of ["creation", "claim", "epoch"] as const) {
      if (fallback !== "creation") goal.createdAt = "invalid";
      if (fallback === "epoch") goal.pendingCompletion!.at = "invalid";
      Date.now = () => Date.parse(at);
      const saved = renderGoalMarkdown(goal);
      Date.now = () => Date.parse(at) + 600_001;
      assert.equal(renderGoalMarkdown(goal), saved, fallback);
    }
    // The snapshot fix must not change the live projection's default clock.
    goal.pendingCompletion!.at = at;
    Date.now = () => Date.parse(at);
    const fresh = auditLifecycleProjection(goal.pendingCompletion)!;
    Date.now = () => Date.parse(at) + 600_001;
    const later = auditLifecycleProjection(goal.pendingCompletion)!;
    assert.equal(fresh.idleMs, 0);
    assert.equal(later.idleMs, 600_001);
    assert.equal(fresh.stale, false);
    assert.equal(later.stale, true);
  } finally {
    Date.now = originalNow;
  }
});

// updateGoal writes markdown, journals state, then checks the markdown against
// a second render. A clock tick must not turn a successful write into a false
// auditor-cursor persistence failure (live hellhunter/platform reports).
for (const phase of ["starting", "running", "settling", "retry-waiting", "recovery-pending"] as const) {
  test(`durable audit markdown is clock-independent: ${phase}`, () => {
    const snapshotAt = Date.parse("2026-10-14T21:49:07.909Z");
    const goal: Goal = {
      id: "audit-clock", objective: "Verify the final tree", policy: "goal",
      status: "auditing", autoContinue: true,
      createdAt: new Date(snapshotAt - 600_000).toISOString(),
      updatedAt: new Date(snapshotAt).toISOString(),
      usage: { tokensUsed: 0, tokensLimit: 0 },
      pendingCompletion: {
        at: new Date(snapshotAt - 600_000).toISOString(), phase,
        startedAt: new Date(snapshotAt - 120_000).toISOString(),
        lastActivityAt: new Date(snapshotAt - 999).toISOString(),
        recoveryAt: new Date(snapshotAt - 999).toISOString(),
        recoveryRetryAt: new Date(snapshotAt + 60_000).toISOString(),
        completionSummary: "Stored claim",
      },
    };
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "glla-audit-clock-"));
    const originalNow = Date.now;
    try {
      Date.now = () => snapshotAt;
      const file = writeGoalMd(cwd, goal);
      const written = fs.readFileSync(file, "utf8");
      assert.equal(written, renderGoalMarkdown(goal));
      // Cross a second boundary, the stale threshold and the retry deadline.
      for (const delta of [2, 1001, 600_001]) {
        Date.now = () => snapshotAt + delta;
        assert.equal(renderGoalMarkdown(goal), written,
          "a successful durable write must survive a later readback render");
      }
      if (phase === "running") assert.match(written, /last worker activity 0s ago/);
      if (phase === "retry-waiting") assert.match(written, /auto-retry in 1m 00s/);
    } finally {
      Date.now = originalNow;
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Goal } from "../extensions/goal-loop-core.js";
import type { LoopState } from "../extensions/goal-loop-forever.js";
import { buildSeedGrillMessage } from "../extensions/goal-loop-core.js";
import { continuationPrompt } from "../extensions/goal-continuation.js";
import { loopPrompt } from "../extensions/goal-loop.js";
import { buildGoalAuditorPrompt } from "../extensions/goal-loop-auditor.js";
import { VERIFICATION_VALUE_POLICY, VERIFICATION_VALUE_REVIEW_POLICY } from "../extensions/verification-value.js";
import { respecIncrementAuditGoal } from "../extensions/respec-builder-audit.js";
import { createRespecBuilder, adoptRespecRequirements, planRespecIncrement, claimRespecTask, beginRespecAudit } from "../extensions/respec-builder.js";
import { seedGoal, seedLoop } from "./harness/mock-pi.js";
import { conditionalBody } from "./harness/source-structure.js";

// This pins policy delivery by identity, not wording. Semantic effectiveness is
// separately evaluated against frozen cases, not asserted by a string match.
for (const policy of ["goal", "list"] as const) {
  test(`${policy}: rendered continuation and independent review receive canonical instructions`, () => {
    const goal = seedGoal({ policy, objective: "Preserve intentional compatibility" }) as unknown as Goal;
    assert.ok(continuationPrompt(goal).includes(VERIFICATION_VALUE_POLICY));
    assert.ok(buildGoalAuditorPrompt(goal, "claim", "evidence").includes(VERIFICATION_VALUE_REVIEW_POLICY));
  });
}
for (const measureCmd of [undefined, "echo 1"]) {
  test(`loop ${measureCmd ? "metric" : "metricless"}: rendered execution receives canonical instructions`, () => {
    const loop = seedLoop({ measureCmd }) as unknown as LoopState;
    assert.ok(loopPrompt(loop, "", "", "").includes(VERIFICATION_VALUE_POLICY));
  });
}
test("project increment execution and its normal auditor receive canonical instructions", () => {
  const builder = adoptRespecRequirements(createRespecBuilder("Compatible storage"), [{ id: "R1", text: "round trip", acceptance: "actual round trip" }]);
  const loop = seedLoop({ builder }) as unknown as LoopState;
  assert.ok(loopPrompt(loop, "", "", "").includes(VERIFICATION_VALUE_POLICY));
  const tasks = planRespecIncrement(builder, [{ id: "T1", text: "implement", requirementIds: ["R1"] }]);
  const auditing = beginRespecAudit(claimRespecTask(tasks, "T1"), "attempt", "implemented");
  const goal = respecIncrementAuditGoal(auditing, loop.startedAt, "2026-10-18T00:00:00Z");
  assert.ok(buildGoalAuditorPrompt(goal, "claim", "evidence").includes(VERIFICATION_VALUE_REVIEW_POLICY));
});
test("draft instructions deliver the policy before the contract is confirmed", () => {
  assert.ok(buildSeedGrillMessage("[DRAFT]", "Implement compatibility", "propose_goal_draft").includes(VERIFICATION_VALUE_POLICY));
});
test("structural branch inspection tolerates comments and detects wrong routing", () => {
  const source = `if (enabled) { /* ${"explanation ".repeat(50)} */ await menu(ctx); } else { other(); }`;
  assert.match(conditionalBody(source, "enabled"), /await menu\(ctx\)/);
  assert.doesNotMatch(conditionalBody(source.replace("menu(ctx)", "other(ctx)"), "enabled"), /await menu\(ctx\)/);
  assert.throws(() => conditionalBody(source, "missing"), { name: "AssertionError" });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractVerificationContract } from "../extensions/goal-loop-core.js";
import { assessSuspiciousObjective } from "../extensions/faulty-objective-recovery.js";

// Reduced read-only reproduction of Screenshot_20261012_130230:
// contract text was embedded in the objective as well as supplied separately.
const objective = "Polish the darklord title screen and fix the audio-settings layout bug. Do NOT touch gameplay code.\n\nDesktop only. Out of scope: gameplay tuning.\n\nVerification contract (auditor checks each line):\n1. The settings bug is named; tests pass.\n2. Prior archived goals remain verdict=approved.";

test("field contract heading separates acceptance criteria from actionable intent", () => {
  const parsed = extractVerificationContract(objective);
  assert.match(parsed.objective, /^Polish the darklord/);
  assert.ok(!parsed.objective.includes("Verification contract"));
  assert.match(parsed.verificationContract, /Prior archived goals remain verdict=approved/);
  assert.equal(assessSuspiciousObjective(parsed.objective, parsed.verificationContract).suspicious, false);
});

test("plain verification contract heading is parsed, but ordinary verification prose is retained", () => {
  assert.equal(extractVerificationContract("Fix the panel\nVerification contract:\n1. Tests pass").objective, "Fix the panel");
  const prose = "Verify the contract parser handles punctuation: preserve ordinary prose.";
  assert.equal(extractVerificationContract(prose).objective, prose);
});

test("report-shaped objective before a contract still fails the safety check", () => {
  const parsed = extractVerificationContract("Reviewer: everything is complete.\nVerification contract (auditor checks each line):\n1. Tests pass");
  assert.ok(assessSuspiciousObjective(parsed.objective, parsed.verificationContract).reasons.includes("verification-fragment"));
});

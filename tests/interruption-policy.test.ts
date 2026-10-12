import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyInterruption, type InterruptionReason } from "../extensions/interruption-policy.js";

const material: InterruptionReason[] = ["missing-permission", "missing-input", "unauthorized-irreversible-action", "contract-conflict"];
for (const reason of material) {
  test(`${reason}: resolve upfront; preserve a legitimate execution exception`, () => {
    assert.equal(classifyInterruption({phase:"drafting",reason,explicitHold:false,authorizedNextStep:false}), "clarify-before-confirmation");
    // A general authorization or run-to-done preference cannot waive this.
    assert.equal(classifyInterruption({phase:"execution",reason,explicitHold:false,authorizedNextStep:true}), "material-exception");
  });
}
for (const reason of ["mechanical-verification", "reversible-work"] as const) {
  test(`${reason}: known authorized work continues without a question`, () => {
    assert.equal(classifyInterruption({phase:"execution",reason,explicitHold:false,authorizedNextStep:true}), "continue-authorized-work");
    assert.equal(classifyInterruption({phase:"execution",reason,explicitHold:false,authorizedNextStep:false}), "investigate-without-consent");
  });
}
for (const reason of [...material,"mechanical-verification","reversible-work","runtime-dependency","unclassified"] as InterruptionReason[]) {
  test(`explicit hold outranks ${reason}`, () => {
    assert.equal(classifyInterruption({phase:"execution",reason,explicitHold:true,authorizedNextStep:true}), "preserve-hold");
  });
}
test("owned runtime dependencies are waits, not human decisions", () => {
  assert.equal(classifyInterruption({phase:"execution",reason:"runtime-dependency",explicitHold:false,authorizedNextStep:true}), "supervised-wait");
});
test("unclassified prose never establishes permission or automatic human-blocker status", () => {
  assert.equal(classifyInterruption({phase:"execution",reason:"unclassified",explicitHold:false,authorizedNextStep:true}), "investigate-without-consent");
});

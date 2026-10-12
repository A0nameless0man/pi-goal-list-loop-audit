import { test } from "node:test";
import assert from "node:assert/strict";
import { assessDraftReadiness } from "../extensions/draft-readiness.js";
import { extractVerificationContract } from "../extensions/goal-loop-core.js";

const bookkeeping = "the fix is committed on the current branch with the repo's configured identity, and this finding's box in .pi-glla/audit-loop/findings.md is checked (\"- [x] … — fixed in <commit>\").";
test("AI-auto-video upload with empty criteria requests material boundaries", () => {
  assert.equal(assessDraftReadiness("ok lets upload the videos but not release")[0]?.code,"external-action-without-criteria");
});
test("Endless-TD procedural objective mismatches retained implementation gates", () => {
  assert.equal(assessDraftReadiness("Review the latest auditor disapproval in /goal status.","bun run check exits 0; bun run test exits 0 — full unit suite")[0]?.code,"procedural-intent");
});
for (const finding of ["HIGH: menuItems.ts routes lack leading slashes", "MEDIUM: baselineCreature.ts is dead production code"]) {
  test(`generated bookkeeping-only finding: ${finding}`, () => {
    assert.equal(assessDraftReadiness(`Fix audit finding: ${finding}`,bookkeeping)[0]?.code,"bookkeeping-only");
    assert.deepEqual(assessDraftReadiness(`Fix audit finding: ${finding}`,bookkeeping+" A regression test and typecheck pass."),[]);
  });
}
for (const [objective,contract] of [
  ["Upload the named videos as private drafts to the confirmed account; never publish", "Receipt lists each video ID and private draft visibility; no publication scheduled"],
  ["Implement upload validation", ""],
  ["Fix a spelling error in README", ""],
  ["Commit the reviewed documentation", "Commit exists with the intended diff"],
  ["Review the latest auditor disapproval in /goal status.", "A report lists each objection with source evidence"],
  ["Fix audit finding: routes are relative", "A nested-route runtime test passes and types are clean"],
] as const) {
  test(`valid counterexample: ${objective}`, () => assert.deepEqual(assessDraftReadiness(objective,contract),[]));
}
test("ordinary verification prose cannot swallow the rest of a list objective", () => {
  const objective="Improve readiness and misleading bookkeeping-only verification without pretending arbitrary contradictions can be proven. Preserve valid tasks.";
  const parsed=extractVerificationContract(`${objective} Done when: regression tests pass.`);
  assert.equal(parsed.objective,objective);
  assert.equal(parsed.verificationContract,"regression tests pass.");
  assert.equal(extractVerificationContract("Improve verification without a contract heading: preserve prose.").objective,"Improve verification without a contract heading: preserve prose.");
});
test("explicit inline verification contract and bare marker remain supported", () => {
  assert.equal(extractVerificationContract("Fix the parser. Verification contract: tests pass").verificationContract,"tests pass");
  assert.equal(extractVerificationContract("Fix the parser. Verification contract:").explicitClear,true);
});

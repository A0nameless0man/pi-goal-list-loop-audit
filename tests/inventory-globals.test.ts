// pi-goal-list-loop-audit — v0.39.38
// generate-inventory used to crash with a bare TypeError when the globals
// marker moved, and its audit-baseline count text rotted silently. Both
// lanes are loud now: named marker errors plus a fail-closed drift gate.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  AUDIT_BASELINE_GLOBAL_NAMES,
  baselineDrift,
  extractGlobalNames,
} from "../scripts/inventory-globals.mjs";

const fixture = `// fixture
export const GOAL_RUNTIME_GLOBAL_NAMES = [
  "goal",
  "list",
] as const;
`;

test("v0.39.38: the globals list extracts by marker, not by position", () => {
  assert.deepEqual(extractGlobalNames(fixture, "fixture"), ["goal", "list"]);
});

test("v0.39.38: a renamed marker fails with a named error, not a bare TypeError", () => {
  assert.throws(
    () => extractGlobalNames(`export const RENAMED = ["goal"] as const;`, "goal-runtime-globals.ts"),
    /marker .* not found in goal-runtime-globals\.ts — was the globals export renamed\?/,
  );
  assert.throws(
    () => extractGlobalNames(`export const GOAL_RUNTIME_GLOBAL_NAMES = ["goal"];`, "goal-runtime-globals.ts"),
    /terminator .* not found in goal-runtime-globals\.ts/,
  );
});

test("v0.39.38: baseline drift reports both numbers; match stays silent", () => {
  assert.equal(baselineDrift(AUDIT_BASELINE_GLOBAL_NAMES), null);
  const report = baselineDrift(AUDIT_BASELINE_GLOBAL_NAMES + 1);
  assert.match(report ?? "", new RegExp(`stand at ${AUDIT_BASELINE_GLOBAL_NAMES + 1}`));
  assert.match(report ?? "", new RegExp(`baseline: ${AUDIT_BASELINE_GLOBAL_NAMES}`));
  assert.match(report ?? "", /bump AUDIT_BASELINE_GLOBAL_NAMES/);
});

test("v0.39.38: the live bridge set still matches its audit baseline", () => {
  const source = readFileSync("extensions/loops/goal-runtime-globals.ts", "utf8");
  const globals = extractGlobalNames(source, "extensions/loops/goal-runtime-globals.ts");
  assert.equal(baselineDrift(globals.length), null, "bump the baseline with the audit date when the set changes");
});

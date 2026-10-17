// pi-goal-list-loop-audit — v0.39.38
// No dead shadow files in tests/: a 0-byte `*.plaintext` copy sitting next
// to a live test invites editing the wrong file (field case: the
// infrastructure-retry, respec-builder-audit-runtime and
// loop-infrastructure-recovery shadows, all 0 bytes beside healthy live
// tests). Shadows carry no content, so the ban is unconditional.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

test("v0.39.38: tests/ holds no dead *.plaintext shadows of live tests", () => {
  const shadows = readdirSync("tests").filter((f) => f.endsWith(".plaintext"));
  assert.deepEqual(shadows, [], `dead shadow files invite editing the wrong file: ${shadows.join(", ")}`);
});

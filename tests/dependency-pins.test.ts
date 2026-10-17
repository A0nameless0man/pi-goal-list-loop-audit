// pi-goal-list-loop-audit — dependency range pins.
//
// Finding: pi-subagents was pinned as "*" so any npm install could silently
// pull a new major (lockfile held 0.74.0 while npm served 0.79.0) and churn
// the lock under the sync daemon. Ranges must carry an upper bound.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.join(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf-8"));
const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, "package-lock.json"), "utf-8"));

test("v0.39.38: no star ranges in dependencies or devDependencies", () => {
  for (const section of ["dependencies", "devDependencies"]) {
    for (const [name, range] of Object.entries(pkg[section] ?? {})) {
      assert.notEqual(range, "*", `${section}.${name} must not float on star`);
      assert.doesNotMatch(String(range), /(^|\s)(latest|\*)\s*$/i, `${section}.${name} must resolve deterministically`);
    }
  }
});

test("v0.39.38: pi-subagents carries an explicit major upper bound", () => {
  const range = String(pkg.devDependencies["pi-subagents"] ?? "");
  assert.match(range, /<\s*\d/, "pi-subagents must name a ceiling so npm cannot pull a new major");
  // The locked resolution still satisfies the range: no surprise upgrade.
  const locked = lock.packages?.["node_modules/pi-subagents"]?.version;
  assert.ok(locked, "the lockfile still pins the resolved pi-subagents");
  const major = Number(String(locked).split(".")[0]);
  assert.ok(Number.isInteger(major), `locked version parses: ${locked}`);
  const ceiling = range.match(/<\s*(\d+)/);
  assert.ok(ceiling?.[1] !== undefined && major < Number(ceiling[1]), `locked ${locked} must sit below the ${range} ceiling`);
});

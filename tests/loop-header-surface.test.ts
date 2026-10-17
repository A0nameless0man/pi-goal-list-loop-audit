// pi-goal-list-loop-audit — v0.39.38
// tests/loop-header-surface.test.ts
//
// v0.39.38 audit: the eight extensions/loops/* module headers all carried
// the same v0.8.0 boilerplate — "four top-level commands" with a short
// subcommand list — after decomposition moved the surface (bodies to
// goal-commands.ts, registration to goal-activation.ts, auditing to the
// detached goal-loop-auditor-process.ts) and /review became the fifth
// command. This pins the refreshed headers against the real registration
// site so the prose cannot silently rot behind the code again.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOOPS = path.resolve(__dirname, "../extensions/loops");
const HEADER_FILES = [
  "goal-activation.ts",
  "goal-auditor-hooks.ts",
  "goal-list-queue.ts",
  "goal-orchestrator.ts",
  "goal-session.ts",
  "goal-settings-ui.ts",
  "goal-tools.ts",
  "goal-ui.ts",
];

function headerOf(file: string): string {
  const src = fs.readFileSync(path.join(LOOPS, file), "utf-8");
  return src.slice(0, src.indexOf("*/"));
}

test("v0.39.38: no loops header documents the retired four-command surface", () => {
  for (const file of HEADER_FILES) {
    const header = headerOf(file);
    assert.ok(!header.includes("four top-level commands"), `${file}: retired command count is gone`);
    assert.ok(!header.includes("v0.8.0"), `${file}: retired version stamp is gone`);
  }
});

test("v0.39.38: every loops header names the five registered commands and the true surface sites", () => {
  const activation = fs.readFileSync(path.join(LOOPS, "goal-activation.ts"), "utf-8");
  const registered = [...activation.matchAll(/pi\.registerCommand\("([a-z]+)"/g)].map((m) => m[1]);
  for (const cmd of ["goal", "glla", "review", "list", "loop"]) {
    assert.ok(registered.includes(cmd), `/${cmd} is really registered in goal-activation.ts`);
  }
  for (const file of HEADER_FILES) {
    const header = headerOf(file);
    for (const cmd of ["/goal", "/list", "/loop", "/glla", "/review"]) {
      assert.ok(header.includes(cmd), `${file}: header names ${cmd}`);
    }
    assert.ok(header.includes("goal-activation.ts"), `${file}: header points at the registration site`);
    assert.ok(header.includes("goal-commands.ts"), `${file}: header points at the command bodies`);
    assert.ok(header.includes("goal-loop-auditor-process.ts"), `${file}: header names the detached auditor path`);
  }
});

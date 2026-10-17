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

test("v0.39.38: header verb lists cover the live completion verbs (no silent verb rot)", () => {
  const activation = fs.readFileSync(path.join(LOOPS, "goal-activation.ts"), "utf-8");
  // Slice per-command: from its registerCommand( to the next one (or EOF).
  const starts = [...activation.matchAll(/pi\.registerCommand\("([a-z]+)"/g)].map((m) => ({ cmd: m[1], index: m.index }));
  const liveVerbs = new Map<string, Set<string>>();
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1]!.index : activation.length;
    const slice = activation.slice(starts[i]!.index, end);
    // Bound the scan to the getArgumentCompletions([...]) array — later
    // code in the slice (e.g. status checks like ["complete", ...]) is
    // not command surface. Walk brackets from the completions( open.
    const verbs = new Set<string>();
    const anchor = slice.indexOf("getArgumentCompletions");
    if (anchor >= 0) {
      let depth = 0, started = false, k = slice.indexOf("completions([", anchor) + "completions(".length;
      let span = "";
      for (; k < slice.length; k++) {
        const ch = slice[k];
        if (ch === "[") { depth++; started = true; }
        span += ch;
        if (ch === "]") { depth--; if (started && depth === 0) break; }
      }
      for (const m of span.matchAll(/\["([a-z]+)",/g)) verbs.add(m[1]!);
    }
    liveVerbs.set(starts[i]!.cmd, verbs);
  }
  // Intentional exclusions: the /list `settings` stub only redirects to /glla.
  const excluded = new Map([["list", new Set(["settings"])]]);
  const headerLine = (header: string, cmd: string): string =>
    header.split("\n").find((line) => line.includes(`/${cmd} `) || line.includes(`/${cmd}<`)) ?? "";
  for (const file of HEADER_FILES) {
    const header = headerOf(file);
    for (const [cmd, verbs] of liveVerbs) {
      if (cmd === "review") continue; // No completions array — presence pinned above.
      const line = headerLine(header, cmd);
      assert.ok(line.length > 0, `${file}: header has a /${cmd} verb line`);
      for (const verb of verbs) {
        if (excluded.get(cmd)?.has(verb)) continue;
        assert.ok(line.includes(verb), `${file}: header /${cmd} line covers live verb "${verb}"`);
      }
    }
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

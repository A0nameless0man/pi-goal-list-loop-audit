#!/usr/bin/env node
// Standalone, opt-in mutation evidence. Never imported by the test suite.
// Only disposable copies are changed; external projects and the live tree stay untouched.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "glla-pin-controls-"));
const results = [];
const originals = new Map();
function edit(file, transform) {
  const target = path.join(scratch, file);
  if (!originals.has(file)) originals.set(file, fs.readFileSync(target, "utf8"));
  const before = fs.readFileSync(target, "utf8");
  const after = transform(before);
  assert.notEqual(after, before, `mutation applies: ${file}`);
  fs.writeFileSync(target, after);
}
function restore() { for (const [file, text] of originals) fs.writeFileSync(path.join(scratch, file), text); originals.clear(); }
function run(name, files, pattern, failure) {
  const args = ["test", ...files.map(file => `./tests/${file}.test.ts`), "-t", pattern];
  const out = spawnSync("bun", args, { cwd: scratch, encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GLLA_GLOBAL_SETTINGS_PATH: path.join(scratch, "global-settings.json") } });
  const log = `${out.stdout ?? ""}${out.stderr ?? ""}`;
  fs.writeFileSync(path.join(scratch, `${results.length}.log`), log);
  assert.equal(out.error, undefined, `${name}: process ran within bound`);
  if (failure) { assert.notEqual(out.status, 0, `${name}: must reject regression`); assert.match(log, failure, `${name}: intended check must fail, not an import error`); }
  else assert.equal(out.status, 0, `${name}: ${log}`);
  results.push({ name, expected: failure ? "meaningful regression rejected" : "harmless change accepted", status: "pass", processExit: out.status });
  fs.writeFileSync(path.join(scratch, "results.json"), JSON.stringify(results, null, 2));
  restore();
}
function stripComments(text) {
  const source = ts.createSourceFile("fixture.ts", text, ts.ScriptTarget.Latest, true);
  const ranges = new Map();
  function at(pos) {
    for (const r of [...(ts.getLeadingCommentRanges(text, pos) ?? []), ...(ts.getTrailingCommentRanges(text, pos) ?? [])]) ranges.set(r.pos, r.end);
  }
  function visit(node) { at(node.pos); at(node.end); ts.forEachChild(node, visit); }
  visit(source);
  let result = text;
  for (const [start, end] of [...ranges].sort((a, b) => b[0] - a[0])) result = result.slice(0, start) + result.slice(start, end).replace(/[^\r\n]/g, " ") + result.slice(end);
  return result;
}
try {
  for (const name of ["extensions", "tests", "prompts", "scripts", ".github", "package.json", "bunfig.toml"]) fs.cpSync(path.join(root, name), path.join(scratch, name), { recursive: true });
  fs.symlinkSync(path.join(root, "node_modules"), path.join(scratch, "node_modules"), "dir");
  fs.mkdirSync(path.join(scratch, "audit"));
  for (const name of ["EXTERNAL-REPAIR-PROPOSALS-2026-10-12.md", "EXTERNAL-REPAIR-EVIDENCE-2026-10-12.json"]) fs.copyFileSync(path.join(root, "audit", name), path.join(scratch, "audit", name));
  // The dated report also links tracked local evidence/docs; copy those targets only.
  const report = fs.readFileSync(path.join(scratch, "audit/EXTERNAL-REPAIR-PROPOSALS-2026-10-12.md"), "utf8");
  for (const match of report.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const relative = path.relative(root, path.resolve(root, "audit", match[1].split("#")[0]));
    assert.ok(!relative.startsWith(".."), "local report links remain contained");
    const target = path.join(scratch, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, relative), target);
  }
  for (const file of ["extensions/goal-settings.ts", "extensions/goal-continuation.ts", "extensions/goal-loop-core.ts", "extensions/goal-heartbeat.ts", "extensions/loops/goal-auditor-hooks.ts", "extensions/goal-loop-auditor-process.ts"]) edit(file, stripComments);
  run("comment removal preserves recovery, API, quiet-copy and monitor checks", ["stuck-audit-latch", "tool-overrides", "postaudit-surface", "settings-menu-complete", "hourly-quota-probe", "long-running-discipline", "stall-handling"], "Fix A|ledgered only|Settings type accepts|SETTINGS_KEYS|quiet copy|nextHourlyProbeMs|monitor goals|hanging-verification");
  const long = `/* ${"accurate explanatory comment ".repeat(40)} */`;
  edit("extensions/loops/goal-auditor-hooks.ts", text => text.replace("if (!opts.manual && outcome.fired && outcome.reportPath) {", `if (!opts.manual && outcome.fired && outcome.reportPath) { ${long}`));
  edit("extensions/goal-commands.ts", text => text.replace('if (/^postaudit(?:\\s|$)/.test(trimmed)) {', `if (/^postaudit(?:\\s|$)/.test(trimmed)) { ${long}`));
  run("long explanations do not break notification/routing geometry", ["postaudit-surface"], "SECOND notify|same menu|manual suppression");
  edit("prompts/goal-loop-continuation.md", () => "[GOAL CHECKPOINT goalId=${GOAL_ID}]\n${OBJECTIVE}\n${VERIFICATION_CONTRACT}\n${LONG_RUNNING_JUDGMENT_POLICY}\n${ACTIVE_EXECUTION_QUESTION_GUIDANCE}\n${DYNAMIC_DIRECTIVES}\n");
  run("short full brief still carries contract and canonical policies", ["delta-only-continuation"], "clean goal|builder:|consecutive sends|rebind reset");
  edit("extensions/loops/goal-tools.ts", text => text.replace(/text: `The auditor has now disapproved[\s\S]*?`,/g, "text: `The auditor has now disapproved. INVESTIGATE audit history; provide YOUR ASSESSMENT.`,"));
  run("concise investigation guidance has no arbitrary character minimum", ["pause-message-content"], "audit-cap pause");
  run("workflow harmless edits and release regressions", ["ci-workflow-concurrency"], ".");
  const mutations = [
    ["provenance membership lost", "extensions/goal-settings.ts", '  "toolOverrides",', '', ["tool-overrides"], "SETTINGS_KEYS", /\(fail\).*SETTINGS_KEYS/],
    ["postaudit provenance membership lost", "extensions/goal-settings.ts", '  "postaudit",', '', ["postaudit-surface"], "SETTINGS_KEYS", /\(fail\).*SETTINGS_KEYS/],
    ["lost deferred verdict", "extensions/loops/goal-auditor-hooks.ts", "audit_verdict_deferred", "lost_verdict", ["stuck-audit-latch"], "Fix A", /\(fail\) Fix A/],
    ["wrong hourly skew", "extensions/goal-loop-core.ts", "d.setMinutes(0, 30, 0)", "d.setMinutes(0, 0, 0)", ["hourly-quota-probe"], "nextHourlyProbeMs returns|at :00:29", /\(fail\).*nextHourlyProbeMs/],
    ["invented monitor classification", "extensions/goal-loop-core.ts", "export function isMonitorGoal(_goal: Pick<Goal, \"objective\" | \"createdAt\">, _now = Date.now()): boolean {\n  return false;", "export function isMonitorGoal(_goal: Pick<Goal, \"objective\" | \"createdAt\">, _now = Date.now()): boolean {\n  return true;", ["long-running-discipline"], "monitor goals", /\(fail\) monitor goals/],
    ["quiet count hidden", "extensions/goal-agents-panel.ts", 'if (richness === "quiet") {', 'if (richness === "quiet") { return undefined;', ["subagent-display-richness"], "rich assembles", /\(fail\).*rich assembles/],
    ["wrong postaudit route", "extensions/goal-commands.ts", 'if (/^postaudit(?:\\s|$)/.test(trimmed)) {\n    await cmdReviewerSettings(ctx);', 'if (/^postaudit(?:\\s|$)/.test(trimmed)) {\n    await cmdWrongSettings(ctx);', ["postaudit-surface"], "same menu", /\(fail\).*same menu/],
    ["investigation guidance removed", "extensions/loops/goal-tools.ts", "YOUR ASSESSMENT", "no assessment", ["pause-message-content"], "audit-cap pause", /\(fail\).*audit-cap pause/],
    ["timeout action lost", "extensions/loops/goal-auditor-hooks.ts", "Check long-running verification commands", "No action", ["stall-handling"], "hanging-verification", /\(fail\).*hanging-verification/],
    ["full brief loses policy", "prompts/goal-loop-continuation.md", "${LONG_RUNNING_JUDGMENT_POLICY}", "", ["delta-only-continuation"], "builder:", /\(fail\) builder:/],
  ];
  for (const [name, file, before, after, files, pattern, failure] of mutations) { edit(file, text => text.replaceAll(before, after)); run(name, files, pattern, failure); }
  function pythonCheck(name, failure = false) {
    const out = spawnSync("python3", ["scripts/check-external-repair-proposals.py"], { cwd: scratch, encoding: "utf8", timeout: 10_000 });
    assert.equal(out.error, undefined);
    if (failure) { assert.notEqual(out.status, 0); assert.match(out.stderr, /AssertionError/); }
    else assert.equal(out.status, 0, out.stderr);
    results.push({ name, expected: failure ? "collector boundary regression rejected" : "harmless collector rename accepted", status: "pass", processExit: out.status });
    restore();
  }
  edit("scripts/external-repair-proposal-evidence.py", text => text.replace("os.O_RDONLY | os.O_NOFOLLOW", "os.O_NOFOLLOW | os.O_RDONLY").replace("path = ROOT / 'audit'", "output_path = ROOT / 'audit'").replace("path.write_text", "output_path.write_text"));
  pythonCheck("collector local name and flag order are incidental");
  edit("scripts/external-repair-proposal-evidence.py", text => text.replace("os.O_RDONLY | os.O_NOFOLLOW", "os.O_RDONLY"));
  pythonCheck("collector must not follow links", true);
  fs.writeFileSync(path.join(scratch, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ scratch, results, scope: "disposable GLLA copies only; no live workflows or external projects changed" }, null, 2));
} finally {
  // Preserve bounded logs and result artifacts for inspection, not the source copy.
  for (const name of ["extensions", "tests", "prompts", "scripts", ".github", "audit", "node_modules"]) fs.rmSync(path.join(scratch, name), { recursive: true, force: true });
}

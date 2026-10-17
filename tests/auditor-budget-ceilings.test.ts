// pi-goal-list-loop-audit — worker budget ceiling regressions.
//
// Finding: the worker tool-timeout computation was a Math.max floor with no
// Math.min cap, so huge env values defeated bounded verification and stall
// brakes. The clamp schedule lives in scripts/auditor-budgets.mjs (pure, no
// env access) precisely so it can be pinned here — the worker itself cannot
// be imported (main() runs at load).

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const budgets = await import(pathToFileURL(path.join(__dirname, "../scripts/auditor-budgets.mjs")).href);
const { clampBudget, resolveBudget, MAX_TOOL_TIMEOUT_MS, MAX_STALL_TIMEOUT_MS } = budgets;

test("v0.39.38: mirrored ceilings match the settings-layer constants", async () => {
  const src = fs.readFileSync(path.join(__dirname, "../extensions/goal-loop-auditor-process.ts"), "utf-8");
  assert.match(src, /export const MAX_AUDITOR_TOOL_TIMEOUT_MS = 6 \* 3_600_000;/);
  assert.match(src, /export const MAX_AUDITOR_STALL_MS = 24 \* 3_600_000;/);
  assert.equal(MAX_TOOL_TIMEOUT_MS, 6 * 3_600_000, "tool mirror matches MAX_AUDITOR_TOOL_TIMEOUT_MS");
  assert.equal(MAX_STALL_TIMEOUT_MS, 24 * 3_600_000, "stall mirror matches MAX_AUDITOR_STALL_MS");
});

test("v0.39.38: huge tool env caps at the 6h ceiling (the finding's red case)", () => {
  assert.equal(resolveBudget("999999999999", 300_000), MAX_TOOL_TIMEOUT_MS);
  assert.equal(resolveBudget(String(Number.MAX_SAFE_INTEGER), 300_000), MAX_TOOL_TIMEOUT_MS);
});

test("v0.39.38: huge stall env caps at the 24h ceiling (the stall-brake red case)", () => {
  assert.equal(resolveBudget("999999999999", 600_000, { ceiling: MAX_STALL_TIMEOUT_MS }), MAX_STALL_TIMEOUT_MS);
});

test("v0.39.38: in-range budgets survive untouched, edges floor and fall back", () => {
  assert.equal(resolveBudget("1234567", 300_000), 1_234_567, "in-range env passes through");
  assert.equal(resolveBudget("5", 300_000), 50, "tiny env floors at 50");
  assert.equal(resolveBudget("abc", 300_000), 300_000, "garbage env falls back to default");
  assert.equal(resolveBudget(undefined, 300_000), 300_000, "missing env falls back to default");
  assert.equal(resolveBudget("Infinity", 300_000), 300_000, "non-finite env falls back to default");
  assert.equal(clampBudget(2 ** 40), MAX_TOOL_TIMEOUT_MS, "setTimeout-overflow-scale input caps before arming");
});

test("v0.39.38: the worker parses every budget through the bounded helper", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../scripts/goal-auditor-worker.mjs"), "utf-8");
  assert.match(worker, /from "\.\/auditor-budgets\.mjs"/, "worker imports the shared ceilings");
  assert.doesNotMatch(worker, /\? Math\.max\(50, configuredToolTimeoutMs\)/, "uncapped tool base is gone");
  assert.doesNotMatch(worker, /\? Math\.max\(50, configuredStallMs\)/, "uncapped stall base is gone");
  assert.match(worker, /ceiling: MAX_STALL_TIMEOUT_MS/, "stall uses the stall ceiling, not the tool ceiling");
});

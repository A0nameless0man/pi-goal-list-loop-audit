// pi-goal-list-loop-audit — v0.39.41
// tests/host-contention.test.ts
//
// The gate's hang bounds must be sized for the CPU the host is actually
// giving the suite, and they must be sized in ONE place.
//
// This file pins three things:
//   1. the contention measurement is bounded and never shrinks a budget,
//   2. an idle host is a no-op — the budget is exactly what was asked for,
//      so CI and a normal workstation see no behaviour change at all,
//   3. no test file hand-rolls a wait deadline any more: the wait budget
//      comes from the shared helper, so the rule cannot drift back.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_CONTENTION_FACTOR,
  MIN_CONTENTION_FACTOR,
  contentionFactor,
  measureContentionFactor,
  resetContentionFactor,
  scaledBudgetMs,
} from "../scripts/host-contention.mjs";
import { hangDeadlineMs, untilMs } from "./harness/host-budget.js";
import {
  DEFAULT_TEST_TIMEOUT_MS,
  MAX_TEST_TIMEOUT_MS,
  buildRunnerArgs,
  serialFlags,
} from "../scripts/run-tests.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the contention measurement is bounded and never reports a speedup", () => {
  const measured = measureContentionFactor();
  assert.equal(measured.measurable, true, "the host can be measured");
  assert.ok(Number.isFinite(measured.factor), "the factor is a finite number");
  assert.ok(measured.factor >= MIN_CONTENTION_FACTOR, `factor ${measured.factor} is at least ${MIN_CONTENTION_FACTOR}`);
  assert.ok(measured.factor <= MAX_CONTENTION_FACTOR, `factor ${measured.factor} is at most ${MAX_CONTENTION_FACTOR}`);
  assert.ok(measured.cpuMs > 0, "the probe actually consumed CPU");
  assert.ok(measured.wallMs >= measured.cpuMs, "wall time is at least the CPU time it took to get it");
});

test("a budget is never smaller than the one the test asked for", () => {
  for (const base of [1, 1_000, 10_000, 30_000, 300_000]) {
    assert.ok(hangDeadlineMs(base) >= base, `budget ${base} is not shrunk (got ${hangDeadlineMs(base)})`);
    assert.ok(scaledBudgetMs(base) >= base, `scaled budget ${base} is not shrunk`);
  }
});

test("the budget scales with the slowdown the host is actually experiencing", () => {
  assert.equal(hangDeadlineMs(10_000, { factor: 1 }), 10_000, "an idle host asks for exactly what it asked for");
  assert.equal(hangDeadlineMs(10_000, { factor: 3 }), 30_000, "a 3x slower host gets 3x the wall time");
  assert.equal(hangDeadlineMs(10_000, { factor: 2.5 }), 25_000, "the factor is applied, not rounded down to a bucket");
});

test("an idle host is a no-op: the deadline is exactly the requested budget", () => {
  const before = Date.now();
  const deadline = untilMs(10_000, { factor: 1 });
  const after = Date.now();
  assert.ok(deadline >= before + 10_000, "the deadline is at least the requested budget");
  assert.ok(deadline <= after + 10_000, "the deadline is at most the requested budget plus the call's own cost");
});

test("the measured factor is cached for its window and can be forced fresh", () => {
  resetContentionFactor();
  const first = contentionFactor();
  const second = contentionFactor();
  assert.equal(first, second, "a fresh factor is reused inside the window");
  const forced = contentionFactor({ force: true });
  assert.ok(forced >= MIN_CONTENTION_FACTOR && forced <= MAX_CONTENTION_FACTOR, "a forced measurement is still bounded");
  resetContentionFactor();
});

test("the per-test timeout default leaves real headroom over the slowest legitimate test", () => {
  // The slowest test that relies on the DEFAULT budget took 22.8s
  // (tests/goal-timeline.test.ts). The old 60s default left only ~2.6x
  // headroom, and that test was killed by bun's own timeout on a contended
  // host — a healthy test reported as a hang.
  assert.ok(
    DEFAULT_TEST_TIMEOUT_MS >= 5 * 22_800,
    `the default per-test budget leaves at least 5x headroom over the slowest legitimate test (got ${DEFAULT_TEST_TIMEOUT_MS}ms)`,
  );
  assert.ok(MAX_TEST_TIMEOUT_MS >= DEFAULT_TEST_TIMEOUT_MS, "the ceiling is above the default");
  assert.ok(MAX_TEST_TIMEOUT_MS <= 900_000, "the ceiling keeps a hung test bounded to minutes, not hours");
});

test("the runner passes a serial, load-sized timeout to bun", () => {
  assert.deepEqual(
    serialFlags(DEFAULT_TEST_TIMEOUT_MS),
    ["--parallel=1", "--max-concurrency=1", `--timeout=${DEFAULT_TEST_TIMEOUT_MS}`],
    "the serial flags keep their shape and carry the per-test budget",
  );
  const { bunArgs } = buildRunnerArgs([], []);
  assert.ok(bunArgs.includes(`--timeout=${DEFAULT_TEST_TIMEOUT_MS}`), "the default budget reaches bun");
  const scaled = buildRunnerArgs([], [], undefined, { timeoutMs: 240_000 });
  assert.ok(scaled.bunArgs.includes("--timeout=240000"), "an explicit budget reaches bun");
  assert.ok(!scaled.bunArgs.includes(`--timeout=${DEFAULT_TEST_TIMEOUT_MS}`), "the explicit budget replaces the default");
});

test("no test file hand-rolls a wait deadline any more", () => {
  // A wait deadline is a `Date.now() + N` that is later compared against
  // `Date.now()`. The budget must come from the shared measurement, so it is
  // sized for the host and the rule cannot drift back into 40 files.
  // A deadline is compliant when its value goes through the shared helper
  // (untilMs / hangDeadlineMs), through the shared module an embedded child
  // script imports (scaledBudgetMs), or through the budget the parent hands
  // that child (GLLA_TEST_WAIT_BUDGET_MS).
  const DEADLINE = /\b(?:const|let)\s+(\w+)\s*=\s*Date\.now\(\)\s*\+\s*([^;]+);/;
  const CHECK = /Date\.now\(\)\s*[<>]=?\s*(\w+)/;
  const SHARED = /untilMs\(|hangDeadlineMs\(|scaledBudgetMs\(|GLLA_TEST_WAIT_BUDGET_MS/;
  const offenders: string[] = [];
  for (const file of walk(path.join(ROOT, "tests"))) {
    if (!file.endsWith(".test.ts")) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const made = lines[i].match(DEADLINE);
      if (!made) continue;
      if (SHARED.test(made[2])) continue;
      const window = lines.slice(i + 1, i + 8).join("\n");
      const checked = window.match(CHECK);
      if (!checked || checked[1] !== made[1]) continue;
      offenders.push(`${path.relative(ROOT, file)}:${i + 1}  ${lines[i].trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "these files size a wait deadline by hand; use untilMs() from ./harness/host-budget.js so the budget follows the host's CPU",
  );
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

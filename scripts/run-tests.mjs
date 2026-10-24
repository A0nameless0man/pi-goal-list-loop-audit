#!/usr/bin/env node
// pi-goal-list-loop-audit — v0.38.104
// scripts/run-tests.mjs
//
// Fast/slow suite split. The full serialized suite takes ~7 minutes —
// slow enough to discourage running it. Default `npm test` runs the
// fast set (everything minus the slow-file list, excluded via bun's
// --path-ignore-patterns); `npm run test:slow` runs the slow files;
// `npm run test:all` still runs the whole suite plus the release gates.
//
// Usage: node scripts/run-tests.mjs [--slow|--all] [extra bun test args...]
// An explicit test path in the extras always wins: ignore patterns are
// dropped so `npm test -- tests/some-slow.test.ts` runs that file.
// A `--changed` filter also drops the slow-file exclusions: changed-file
// selection is itself the scope, so a changed slow file must still run
// (serially, under the stall/orphan watch) rather than be filtered out.
//
// Observable progress and bounded suite-group cleanup. The field reported a
// suite that produced nothing for 37 minutes and a 26-hour-old `bun test`
// still burning a core: a runner you cannot see is a runner you cannot trust.
// So this wrapper now:
//   1. streams a periodic progress heartbeat (bytes of suite output seen),
//   2. fails LOUDLY instead of hanging when the suite goes silent past a
//      bounded stall window, and
//   3. always takes its child down with it (SIGINT/SIGTERM/exit), so an
//      interrupted run cleans its suite group before reporting failure.
// Separately detached workers require their own ownership cleanup (F3).
// The heartbeat goes to stderr so piping stdout still gives clean test output.

import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { terminateContainedChild } from "./contained-child.mjs";
import { createTestProcessRegistry, registerOwnedTestProcess, reapOwnedTestProcesses } from "./test-process-registry.mjs";
import { captureTestFailureDiagnostics, diagnosticTail } from "./test-failure-diagnostics.mjs";
import { SLOW_TEST_FILES } from "./slow-files.mjs";
// v0.39.45 (audit 2026-10-22): re-exported so the PACKAGED runner can prove
// it loaded its own policy list (scripts/release-pack-smoke.mjs) — the list
// used to live under tests/, which the npm package does not ship, so the
// packaged runner could not be imported at all.
export { SLOW_TEST_FILES };
import { hangFactor } from "./host-contention.mjs";

/** v0.39.41: the gate's default per-test budget, in wall-clock time.
 *
 * The previous 60s default left only ~2.6x headroom over the slowest
 * legitimate test in the suite (22.8s, tests/goal-timeline.test.ts). On a
 * contended host that test needs 5x the wall time and was killed by bun's
 * own timeout, which reports a healthy system as a hung one. 120s restores
 * ~5x headroom on an idle host; below it, a genuinely hung test is still
 * caught by this bound and by the suite-level stall watchdog below.
 *
 * Tests that legitimately need longer declare their own budget
 * (`test(name, { timeout: N })`), which overrides this default — the same as
 * before this change. */
export const DEFAULT_TEST_TIMEOUT_MS = 120_000;

/** The ceiling for a contention-scaled per-test budget. Contention is capped
 * too, but the product of the two could otherwise reach ~16 minutes for a
 * single test; ten minutes still fails a hung test long before a human
 * gives up, and the stall watchdog covers a silent suite. */
export const MAX_TEST_TIMEOUT_MS = 600_000;

/** The serial flags bun must run with. The per-test timeout is the gate's
 * hang bound, so it is sized for the CPU the host is actually giving the
 * suite: on an idle host this is exactly DEFAULT_TEST_TIMEOUT_MS. */
export function serialFlags(timeoutMs = DEFAULT_TEST_TIMEOUT_MS) {
  return ["--parallel=1", "--max-concurrency=1", `--timeout=${timeoutMs}`];
}

/** The base serial flags (idle host). Kept exported for callers that need
 * the shape without the scaled timeout. */
export const SERIAL_FLAGS = serialFlags();

/** v0.39.38 (audit): node-only gates. Bun discovers *.test.mjs, but this
 * repro MUST run under node with the real jiti loader (see its header) —
 * a bun run is a wasted duplicate today and a conflicting-result risk
 * tomorrow. Excluded from bun discovery in every scan mode; the single
 * execution path is `npm run test:jiti` (wired into test:all and CI).
 * Explicitly naming the file still runs it: naming means "run this file". */
export const NODE_ONLY_TEST_FILES = ["tests/repro-jiti-state-split.test.mjs"];

/** v0.38.104: how long the suite may print NOTHING before we call it hung.
 * Generous on purpose — a serialized suite on a loaded host still emits
 * output every few seconds, and bun's own --timeout=60000 only bounds a
 * single test, not a runner that stops making progress. */
export const DEFAULT_STALL_TIMEOUT_MS = 180_000;
/** v0.39.43: the stall window may be extended when the host is measurably
 * slow (see the watchdog), but never without bound: a genuinely wedged suite
 * must still die in minutes, and the field cases this bound exists for were
 * 37 minutes of silence and a 26-hour orphan. */
export const MAX_STALL_TIMEOUT_MS = 900_000;
/** How many times the window may be extended before the run is killed. */
export const MAX_STALL_EXTENSIONS = 3;
/** Heartbeat cadence: frequent enough that a watcher sees movement. */
export const DEFAULT_HEARTBEAT_MS = 30_000;

export function stallTimeoutMs(env = process.env) {
  const raw = Number(env.GLLA_TEST_STALL_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 10_000) return Math.floor(raw);
  // The stall bound watches for a SILENT suite. Under contention the suite
  // still prints, but a starved child can hold the output for longer than an
  // idle-host budget allows, so the bound scales with the same measured
  // slowdown the per-test budget uses.
  // v0.39.45 (audit 2026-10-22): the scaled window is CLAMPED to the
  // declared ceiling. Without the clamp, a maximally contended host
  // (factor 8) produced a 24-minute window — past the module's own
  // MAX_STALL_TIMEOUT_MS — and the "extend" branch then shrank that
  // already-granted window back to the ceiling while logging "extended".
  return Math.min(MAX_STALL_TIMEOUT_MS, Math.ceil(DEFAULT_STALL_TIMEOUT_MS * hangFactor()));
}

export function heartbeatMs(env = process.env) {
  const raw = Number(env.GLLA_TEST_HEARTBEAT_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? Math.floor(raw) : DEFAULT_HEARTBEAT_MS;
}

/** Pure: has the suite gone silent for longer than the stall window? */
export function isStalled({ silentMs, limitMs }) {
  return Number.isFinite(silentMs) && Number.isFinite(limitMs) && silentMs >= limitMs;
}

/**
 * Pure: what should the stall watchdog do about a silent suite?
 *
 * A silent suite is not automatically a HUNG suite. One test file can
 * legitimately run for minutes without emitting a line, and killing the run
 * there reports a busy machine as a broken suite. So before killing, ask how
 * slow the host is RIGHT NOW: a contended host explains the silence, so
 * extend the window instead. The extension is bounded, so a genuinely wedged
 * suite still dies.
 */
export function stallDecision({ silentMs, limitMs, extensions, factor, maxExtensions = MAX_STALL_EXTENSIONS, maxTimeoutMs = MAX_STALL_TIMEOUT_MS }) {
  if (!isStalled({ silentMs, limitMs })) return { action: "wait" };
  if (Number.isFinite(factor) && factor > 1.2 && extensions < maxExtensions) {
    // v0.39.45 (audit 2026-10-22): an extension never SHORTENS a window it
    // already granted. The ceiling caps growth; it does not rewind it.
    const grown = Math.min(limitMs * Math.min(factor, 4), maxTimeoutMs);
    return { action: "extend", limitMs: Math.max(limitMs, grown) };
  }
  return { action: "kill" };
}

/** Pure arg builder (unit-tested in tests/test-split.test.ts). */
export function buildRunnerArgs(argv, slowFiles, nodeOnlyFiles = NODE_ONLY_TEST_FILES, options = {}) {
  const flags = serialFlags(options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS);
  // Bun only accepts the --changed=<ref> filter form (`bun test --help`);
  // fold the space form up front so a bare ref is never mistaken for an
  // explicit path (or filename filter). A bare --changed stays bare: it
  // takes no space-separated value, so it must not consume the next token.
  const normalized = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--changed" && i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
      normalized.push(`--changed=${argv[i + 1]}`);
      i++;
    } else {
      normalized.push(arg);
    }
  }
  let mode = "fast";
  const rest = [];
  for (const arg of normalized) {
    if (arg === "--slow") mode = "slow";
    else if (arg === "--all") mode = "all";
    else rest.push(arg);
  }
  // Ignore patterns beat even explicit paths in bun, so explicit
  // selection drops them — naming a file means "run this file".
  // Value-taking flags (-t foo) consume the next token so filter
  // values are not mistaken for paths.
  const VALUE_FLAGS = new Set([
    "-t", "--test-name-pattern", "--timeout", "--parallel",
    "--max-concurrency", "--preload", "--path-ignore-patterns",
    "--rerun-each", "--repeat-each",
  ]);
  let hasExplicitPaths = false;
  let hasChangedFilter = false;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--changed" || arg.startsWith("--changed=")) { hasChangedFilter = true; continue; }
    if (VALUE_FLAGS.has(arg)) { i++; continue; }
    if (!arg.startsWith("-")) { hasExplicitPaths = true; break; }
  }
  // Node-only gates are never bun's job (except when explicitly named) —
  // unlike slow files they are not merely slow elsewhere, they are WRONG
  // under any loader but node, so the ignore survives --changed scope too.
  const nodeOnlyIgnores = nodeOnlyFiles.flatMap((f) => ["--path-ignore-patterns", f]);
  if (mode === "slow") return { mode, bunArgs: [...flags, ...slowFiles, ...rest] };
  if (hasExplicitPaths) return { mode: "explicit", bunArgs: [...flags, ...rest] };
  if (hasChangedFilter) return { mode: "changed", bunArgs: [...flags, ...nodeOnlyIgnores, ...rest] };
  if (mode === "all") return { mode, bunArgs: [...flags, ...nodeOnlyIgnores, ...rest] };
  return {
    mode,
    bunArgs: [...flags, ...slowFiles.flatMap((f) => ["--path-ignore-patterns", f]), ...nodeOnlyIgnores, ...rest],
  };
}

const log = (line) => {
  if (process.env.GLLA_TEST_RUNNER_QUIET !== "1") process.stderr.write(`[run-tests] ${line}\n`);
};

/** Bun used to silently interpret unknown flag values as test filters.
 * Check capabilities, not a version string, before granting the gate a run. */
export function bunTestCapabilityError(probe = spawnSync) {
  const result = probe("bun", ["test", "--help"], { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) return `Could not inspect Bun test capabilities: ${result.error?.message ?? `exit ${result.status}`}`;
  const help = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const missing = ["--parallel", "--max-concurrency", "--path-ignore-patterns"]
    .filter(flag => !new RegExp(`${flag}(?=[=\\s<]|$)`).test(help));
  return missing.length ? `Bun test lacks required capabilities: ${missing.join(", ")}. Use the project's CI toolchain (Bun 1.3.14 or newer with these flags); no tests were started.` : undefined;
}

function main() {
  const capabilityError = bunTestCapabilityError();
  if (capabilityError) {
    process.stderr.write(`[run-tests] ${capabilityError}\n`);
    process.exitCode = 1;
    return;
  }
  // Size the gate's hang bounds for the CPU this host is actually giving
  // the suite. On an idle host the factor is 1.0 and every bound is exactly
  // what it was before; on a contended host the per-test bound grows in
  // proportion, so a slow-but-progressing test is not reported as a hang.
  const factor = hangFactor();
  const timeoutMs = Math.min(MAX_TEST_TIMEOUT_MS, Math.ceil(DEFAULT_TEST_TIMEOUT_MS * factor));
  const { mode, bunArgs } = buildRunnerArgs(process.argv.slice(2), SLOW_TEST_FILES, undefined, { timeoutMs });
  let stallLimit = stallTimeoutMs();
  let stallExtensions = 0;
  const beat = heartbeatMs();
  const startedAt = Date.now();
  log(`mode=${mode} slow_files=${SLOW_TEST_FILES.length} stall_timeout=${Math.round(stallLimit / 1000)}s heartbeat=${Math.round(beat / 1000)}s`);
  if (factor > 1.05) {
    log(`host is ${factor.toFixed(1)}x slower than an idle host — per-test budget raised to ${Math.round(timeoutMs / 1000)}s`);
  }

  // Give the suite a group we can terminate without signalling this wrapper.
  const registryDir = fs.mkdtempSync(path.join(os.tmpdir(), "glla-test-processes-"));
  const testEnv = { ...process.env, ...createTestProcessRegistry(registryDir) };
  testEnv.GLLA_TEST_ROOT_PROCESS_REGISTRY ??= testEnv.GLLA_TEST_PROCESS_REGISTRY;
  testEnv.GLLA_TEST_ROOT_PROCESS_TOKEN ??= testEnv.GLLA_TEST_PROCESS_TOKEN;
  const child = spawn("bun", ["test", ...bunArgs], { stdio: ["inherit", "pipe", "pipe"], detached: true, env: testEnv });
  let bytes = 0;
  let outputTail = "";
  let lastOutputAt = Date.now();
  let settled = false;
  let stallFired = false;
  let interruptedExitCode;
  let cleanupPromise;
  let exitCleanupTimer;
  const cleanup = () => cleanupPromise ??= terminateContainedChild(child, { graceMs: 5000 });
  child.once("exit", () => {
    // A descendant retaining a pipe must not prevent close/status delivery.
    exitCleanupTimer = setTimeout(() => { void cleanup(); }, 100);
  });

  const forward = (stream, sink) => {
    stream.on("data", (chunk) => {
      bytes += chunk.length;
      outputTail = diagnosticTail(outputTail + chunk.toString());
      lastOutputAt = Date.now();
      sink.write(chunk);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  /** Take the child down, escalating, so nothing survives this wrapper. */
  const takeDown = (signal) => {
    try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* already gone */ } }
  };
  // Probe the suite group; detached grandchildren do not belong to it.
  try {
    process.kill(-child.pid, 0);
    // Keep the exit-status obligation referenced. Pipe EOF can precede
    // ChildProcess.close; unref here let a failed suite become exit 0.
  } catch (error) {
    log(`WARNING: the suite child is not its own process group (${error?.code ?? error?.message}) — takeDown can only signal the direct child, so orphaned grandchildren may survive the run.`);
  }

  const onSignal = (signal) => {
    interruptedExitCode ??= signal === "SIGINT" ? 130 : 143;
    log(`received ${signal} — cleaning up the suite group`);
    void cleanup();
  };
  process.on("SIGINT", () => { onSignal("SIGINT"); });
  process.on("SIGTERM", () => { onSignal("SIGTERM"); });
  process.on("exit", () => takeDown("SIGTERM"));

  const watch = setInterval(() => {
    const silentMs = Date.now() - lastOutputAt;
    const elapsed = Date.now() - startedAt;
    if (!stallFired) {
      const decision = stallDecision({
        silentMs, limitMs: stallLimit, extensions: stallExtensions,
        factor: hangFactor({ force: true, maxAgeMs: 0 }),
      });
      if (decision.action === "extend") {
        stallExtensions += 1;
        stallLimit = decision.limitMs;
        log(`stall window extended to ${Math.round(stallLimit / 1000)}s — the host is contended (extension ${stallExtensions}/${MAX_STALL_EXTENSIONS})`);
        return;
      }
      if (decision.action === "wait") {
        log(`progress: ${Math.round(elapsed / 1000)}s elapsed · ${Math.round(silentMs / 1000)}s since last output · ${(bytes / 1024).toFixed(0)} KiB of suite output`);
        return;
      }
      stallFired = true;
      log(`STALLED: no suite output for ${Math.round(silentMs / 1000)}s (limit ${Math.round(stallLimit / 1000)}s) after ${Math.round(elapsed / 1000)}s — killing the run instead of hanging.`);
      log(`hint: a hung run is usually CPU starvation (host load) or a test awaiting a child that exited; rerun that file alone, or raise GLLA_TEST_STALL_TIMEOUT_MS if the host is simply slow.`);
      void cleanup();
      return;
    }
    log(`progress: ${Math.round(elapsed / 1000)}s elapsed · ${Math.round(silentMs / 1000)}s since last output · ${(bytes / 1024).toFixed(0)} KiB of suite output`);
  }, beat);
  watch.unref?.();

  const done = async (code, signal) => {
    if (settled) return;
    settled = true;
    clearInterval(watch);
    clearTimeout(exitCleanupTimer);
    await cleanup();
    const detached = await reapOwnedTestProcesses(testEnv);
    if (detached.reaped || detached.unverified) log(`detached cleanup: ${detached.reaped} owned groups; ${detached.unverified} unverified survivors/records`);
    const failed = stallFired || interruptedExitCode || detached.unverified || code !== 0 || signal;
    if (failed) {
      try {
        const file = captureTestFailureDiagnostics({ directory: registryDir, exitCode: code, signal,
          reason: stallFired ? `suite stalled: no output for ${stallLimit}ms` : interruptedExitCode ? `interrupted (${interruptedExitCode})` : `suite exit ${code}; unverified cleanup ${detached.unverified}`,
          outputTail, processState: { pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode, killed: child.killed, ...detached } });
        log(`failure diagnostics retained at ${file}`);
      } catch (error) { log(`could not retain failure diagnostics: ${error.message}`); }
    }
    if (failed) log(`cleanup evidence retained at ${registryDir}`);
    else {
      fs.rmSync(registryDir, { recursive: true, force: true });
      fs.rmSync(`${registryDir}.obligations`, { recursive: true, force: true });
    }
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    if (stallFired) {
      log(`FAILED: suite stalled and was terminated after ${elapsed}s`);
      process.exit(1);
    }
    log(`finished in ${elapsed}s (exit ${code}${signal ? `, signal ${signal}` : ""})`);
    process.exit(interruptedExitCode ?? (detached.unverified ? 1 : code ?? 1));
  };
  child.on("error", (error) => {
    log(`could not start bun: ${error.message}`);
    void done(1);
  });
  child.on("close", done);
  // Registration can fail while the newly launched suite is already running.
  // Install containment and settlement handlers first, then retain/reap its
  // failed obligation through the same exit path as every other launch error.
  try { registerOwnedTestProcess(child, testEnv); }
  catch (error) {
    log(`could not register bun: ${error.message}`);
    void done(1);
  }
}

// Kept for a caller that explicitly wants a blocking run (tests).
export function runBlocking(args) {
  const child = spawnSync("bun", ["test", ...args], { stdio: "inherit" });
  return child.status ?? 1;
}

const invokedAsScript = (() => {
  try {
    return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (invokedAsScript) main();

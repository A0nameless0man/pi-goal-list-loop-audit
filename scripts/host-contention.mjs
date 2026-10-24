/**
 * Host CPU-contention measurement for the test gate.
 *
 * The gate's hang detectors are wall-clock deadlines: a test waits for an
 * asynchronous condition and gives up when the clock runs out. That only
 * means "this is a hang" if the process gets the CPU the deadline assumes.
 *
 * On a shared or oversubscribed host a test that needs 10s of CPU can take
 * 40s of wall time while making steady progress. The deadline fires, the
 * gate reports a healthy system as broken, and the release is blocked by a
 * machine that was merely busy. That is a gate defect, not a product defect:
 * the gate must distinguish "slow" from "hung".
 *
 * This module measures the discrepancy directly. It runs a short CPU-bound
 * probe and compares the wall time it took with the CPU time it actually
 * consumed. The ratio is the slowdown the process is really experiencing:
 *
 *   1.0  the process gets the CPU it asks for
 *   3.7  it gets roughly a quarter of a core
 *
 * The ratio needs no reference host, no CPU-count model and no assumptions
 * about the scheduler: it is measured on the machine running the suite. On an
 * idle host it is 1.0 and every deadline is exactly what it was before, so
 * this is a no-op on a normal machine and CI is unaffected.
 */

/** CPU time the probe spends. Large enough to clear the kernel's CPU
 * accounting granularity, small enough to be invisible next to a suite. */
import * as os from "node:os";

export const DEFAULT_PROBE_CPU_MS = 50;

/** A factor below 1 would shrink a deadline below the value the test asked
 * for, so the floor is 1: the probe may only ever be more generous. */
export const MIN_CONTENTION_FACTOR = 1;

/** The ceiling keeps a genuine hang bounded. At 8x, a 10s deadline becomes
 * 80s and the suite still fails a wedged test in minutes, not hours. */
export const MAX_CONTENTION_FACTOR = 8;

/** How long a measured factor stays fresh. Contention moves on a scale of
 * seconds, so re-measuring every 30s tracks it without adding noise. */
export const DEFAULT_FACTOR_MAX_AGE_MS = 30_000;

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

/**
 * Burn CPU until `probeCpuMs` of CPU time has been consumed, and report how
 * long that took in wall time. Self-limiting: the probe costs a fixed amount
 * of CPU on every host, so it cannot become a load problem of its own.
 */
export function measureContentionFactor(options = {}) {
  const {
    probeCpuMs = DEFAULT_PROBE_CPU_MS,
    min = MIN_CONTENTION_FACTOR,
    max = MAX_CONTENTION_FACTOR,
  } = options;
  const cpuStart = process.cpuUsage();
  const wallStart = now();
  let spins = 0;
  for (;;) {
    // A plain arithmetic loop: no allocation, no syscalls, so the CPU time
    // measured is the work itself rather than the harness around it.
    let x = 0x9e3779b9;
    for (let i = 0; i < 50_000; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
    }
    spins += 1;
    if (x === -1) break; // never taken; keeps the loop from being optimized away
    const used = process.cpuUsage(cpuStart);
    if ((used.user + used.system) / 1000 >= probeCpuMs) break;
    if (spins > 100_000) break; // absolute backstop: never spin forever
  }
  const cpuEnd = process.cpuUsage(cpuStart);
  const cpuMs = (cpuEnd.user + cpuEnd.system) / 1000;
  const wallMs = now() - wallStart;
  if (!(cpuMs > 0) || !(wallMs > 0)) {
    return { factor: min, wallMs, cpuMs, spins, measurable: false };
  }
  const raw = wallMs / cpuMs;
  const factor = Math.min(max, Math.max(min, raw));
  return { factor, wallMs, cpuMs, spins, measurable: true };
}

let cached = null;
let stableCached = null;
let loadCached = null;

/** The ceiling for the load-derived factor. The product scales its own
 * timeouts by load/cpus with the same 2x ceiling
 * (extensions/goal-loop-shield.ts MECHANICAL_LOAD_SCALE_MAX), so the gate and
 * the product size their budgets the same way. */
export const MAX_LOAD_SCALE_FACTOR = 2;

/** How long a measured load average stays fresh. Contention moves on a scale
 * of seconds, and a wait that starts now must be sized for the host as it is
 * now — not as it was when the suite started. */
export const LOAD_FACTOR_MAX_AGE_MS = 2_000;

/**
 * The machine-wide CPU pressure, as a slowdown factor.
 *
 * The contention probe above measures how much CPU THIS process gets. It
 * cannot see the pressure that comes from elsewhere on the machine: a host
 * whose load average is 50 on 16 cores is slow for every process because the
 * run queue and the disk queues are deep — but a process that is not itself
 * waiting still burns its 25ms probe at full speed and reports a factor of
 * 1.0.
 *
 * That gap is not academic for this suite. The gate's waits are dominated by
 * filesystem and subprocess latency rather than arithmetic, so on a busy host
 * the CPU probe under-reads the slowdown and a healthy wait gets reported as a
 * hang. That is exactly what the 0.39.5x release gate did: the 2101-cycle
 * provider-exhaustion stress test needs ~334s of wall time on a host at load
 * 50, but its CPU-scaled budget came out at ~333s, because the probe never
 * saw the pressure that was actually slowing the test down.
 *
 * The load average IS the machine-wide measure of that pressure, so a hang
 * bound takes the worse of the two readings.
 */
export function hostLoadFactor(options = {}) {
  const { maxAgeMs = LOAD_FACTOR_MAX_AGE_MS } = options;
  const stamp = now();
  if (!options.force && loadCached && stamp - loadCached.at < maxAgeMs) return loadCached.factor;
  let factor = 1;
  try {
    const load = os.loadavg()[0] ?? 0;
    const cpus = os.cpus()?.length ?? 1;
    if (Number.isFinite(load) && load > 0 && Number.isFinite(cpus) && cpus > 0) {
      factor = Math.min(MAX_LOAD_SCALE_FACTOR, Math.max(1, load / cpus));
    }
  } catch {
    // An unreadable load average degrades to no scaling, never to nonsense.
    factor = 1;
  }
  loadCached = { at: stamp, factor };
  return factor;
}

/**
 * The factor a HANG BOUND should use: the worse of this process's measured
 * CPU slowdown and the machine's load pressure.
 *
 * A hang bound is a wait, and a wait is sized for the time the work really
 * needs. A scenario budget (a number handed to the product that the
 * assertions then compare against) is a different thing — it must be fixed for
 * the life of the process so a scenario and its assertion cannot disagree —
 * so it stays on the CPU-only factor.
 */
export function hangFactor(options = {}) {
  return Math.max(contentionFactor(options), hostLoadFactor(options));
}

/**
 * The cached factor. `maxAgeMs` bounds staleness; pass 0 to force a fresh
 * measurement. Returns 1 when the host cannot be measured, so an
 * unmeasurable host degrades to today's behaviour rather than to nonsense.
 */
export function contentionFactor(options = {}) {
  const { maxAgeMs = DEFAULT_FACTOR_MAX_AGE_MS, force = false } = options;
  const stamp = now();
  if (!force && cached && stamp - cached.at < maxAgeMs) return cached.factor;
  const measured = measureContentionFactor(options);
  cached = { at: stamp, factor: measured.factor };
  if (!stableCached) stableCached = { at: stamp, factor: measured.factor };
  else stableCached.factor = Math.max(stableCached.factor, measured.factor);
  return cached.factor;
}

/**
 * The factor for SCENARIO budgets, measured once per process.
 *
 * A scenario budget is a number a test hands to the product, and the
 * assertions that follow compare against the same number. If the factor
 * could change between the two reads, the scenario and its assertions would
 * disagree — a test would then measure how the host drifted mid-test instead
 * of what it is about. So the scenario factor is fixed for the life of the
 * process. Wait deadlines want the opposite (the freshest reading), and use
 * `contentionFactor` directly.
 */
export function stableContentionFactor(options = {}) {
  if (stableCached) return stableCached.factor;
  const measured = measureContentionFactor(options);
  stableCached = { at: now(), factor: measured.factor };
  return stableCached.factor;
}

/**
 * The scenario factor, which only ever GROWS.
 *
 * A scenario budget and the assertion that compares against it must use the
 * same number, or the test measures how the host drifted mid-test instead of
 * what it is about. So the factor is fixed for the life of the process —
 * and it only grows, because a host that has been busy once can be busy
 * again, and a budget that shrank would be smaller than the work it has to
 * cover. A test captures its scenario numbers once and compares against
 * those.
 */
export function monotonicContentionFactor(options = {}) {
  const measured = measureContentionFactor(options);
  if (!stableCached) stableCached = { at: now(), factor: measured.factor };
  else stableCached.factor = Math.max(stableCached.factor, measured.factor);
  return stableCached.factor;
}

/** Forget the cached factor (tests). */
export function resetContentionFactor() {
  cached = null;
  stableCached = null;
  loadCached = null;
}

/**
 * The wall-clock budget for work that asked for `baseMs`.
 *
 * On an idle host this is `baseMs` exactly. On a contended host it is
 * `baseMs` scaled by the measured slowdown, so the work is given the CPU
 * time it would have had on an idle machine. The budget is never smaller
 * than what was asked for.
 *
 * This is the one implementation of that rule: the test helper, the test
 * runner and the child processes a test spawns all size their budgets here.
 */
export function scaledBudgetMs(baseMs, options = {}) {
  if (!Number.isFinite(baseMs) || baseMs <= 0) return baseMs;
  const { stable = true, ...rest } = options;
  // Both branches are HANG BOUNDS in this suite, and a hang bound is sized
  // for the wall time the work really needs. The load term is what makes that
  // true on a busy host: the CPU probe cannot see machine-wide pressure, and
  // the waits here are I/O- and subprocess-bound rather than arithmetic-bound.
  if (stable) return Math.ceil(baseMs * Math.max(monotonicContentionFactor(rest), hostLoadFactor(rest)));
  // A WAIT gets the worse of "how slow is the host right now" and "how slow
  // has it been at any point in this run". A momentary quiet reading must not
  // hand a wait a budget the host has already shown it cannot meet.
  const current = hangFactor(rest);
  const worst = stableCached?.factor ?? current;
  return Math.ceil(baseMs * Math.max(current, worst));
}

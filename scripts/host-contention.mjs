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
  if (stable) return Math.ceil(baseMs * monotonicContentionFactor(rest));
  // A WAIT gets the worse of "how slow is the host right now" and "how slow
  // has it been at any point in this run". A momentary quiet reading must not
  // hand a wait a budget the host has already shown it cannot meet.
  const current = contentionFactor(rest);
  const worst = stableCached?.factor ?? current;
  return Math.ceil(baseMs * Math.max(current, worst));
}

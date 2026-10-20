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
  return cached.factor;
}

/** Forget the cached factor (tests). */
export function resetContentionFactor() {
  cached = null;
}

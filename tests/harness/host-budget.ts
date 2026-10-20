// pi-goal-list-loop-audit — v0.39.41
// tests/harness/host-budget.ts
//
// Load-aware hang budgets for the test gate.
//
// The gate's wait loops end in a wall-clock deadline: "keep polling until the
// condition holds, but give up after N milliseconds". That deadline only
// means "this is a hang" if the process gets the CPU the wait assumes.
//
// On a shared or oversubscribed host a wait that needs 2.5s of CPU can take
// 12s of wall time while the condition is approaching normally. The deadline
// fires and the gate reports a healthy system as broken. This happened for
// real: a release gate on a 43-user workstation failed its own healthy tests
// with "settlement timeout" and "timed out after 60000ms", and every one of
// those tests passed when its file was run alone.
//
// So the budget is scaled by the host's measured CPU contention. On an idle
// host the factor is 1.0 and the deadline is EXACTLY the value the test
// asked for — no behaviour change at all, and CI is unaffected. On a
// contended host the budget grows in proportion to the slowdown the process
// is really experiencing.
//
// What this does NOT do: it never treats elapsed time as success, and it
// never stops failing. A predicate that never becomes true still fails the
// test; it just gets a budget that matches the CPU it is actually getting.
// The hang is still a hang.

import { contentionFactor } from "../../scripts/host-contention.mjs";

/** How long a measured contention factor stays fresh. Contention moves on a
 * scale of seconds, and a wait that starts now must be sized for the host
 * as it is now — not as it was when the suite started, and not as it will be
 * when the wait ends. A short TTL keeps the budget tracking the host. */
export const HOST_BUDGET_MAX_AGE_MS = 2_000;

/** CPU the per-wait probe spends. A wait is a hot path: the probe must size
 * the budget without becoming a load problem of its own. */
export const HOST_BUDGET_PROBE_CPU_MS = 25;

/**
 * The wall-clock budget for a wait that asked for `baseMs`.
 *
 * On an idle host this is `baseMs` exactly. On a contended host it is
 * `baseMs` scaled by the measured slowdown, so the wait is given the CPU
 * time it would have had on an idle machine.
 */
export function hangDeadlineMs(baseMs: number, options: { maxAgeMs?: number; factor?: number } = {}): number {
	if (!Number.isFinite(baseMs) || baseMs <= 0) return baseMs;
	const factor = options.factor ?? contentionFactor({
		maxAgeMs: options.maxAgeMs ?? HOST_BUDGET_MAX_AGE_MS,
		probeCpuMs: HOST_BUDGET_PROBE_CPU_MS,
	});
	return Math.ceil(baseMs * factor);
}

/**
 * The absolute deadline for a wait that asked for `baseMs`.
 *
 * This is the drop-in replacement for `Date.now() + baseMs` in a wait loop.
 * The loop, its predicate, its poll interval and its failure message are
 * unchanged — only the budget is sized for the host the suite is running on.
 */
export function untilMs(baseMs: number, options: { maxAgeMs?: number; factor?: number } = {}): number {
	return Date.now() + hangDeadlineMs(baseMs, options);
}

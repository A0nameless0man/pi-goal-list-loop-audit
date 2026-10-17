// pi-goal-list-loop-audit — shared worker budget ceilings.
//
// The detached auditor worker (scripts/goal-auditor-worker.mjs) reads raw
// env knobs, bypassing the settings-load clamps in
// extensions/goal-loop-auditor-process.ts. Every budget parsed here must be
// floored AND capped at the same ceiling the user-facing setting enforces,
// or a huge env value defeats bounded verification and the stall brakes
// (and overflows setTimeout past 2^31-1 into an immediate fire).
//
// Pure module (no process/env access except through arguments) so tests can
// pin the clamp schedule directly — the worker cannot be imported (main()
// runs at load).

// Mirror of MAX_AUDITOR_TOOL_TIMEOUT_MS in
// extensions/goal-loop-auditor-process.ts.
export const MAX_TOOL_TIMEOUT_MS = 6 * 3_600_000;
// Mirror of MAX_AUDITOR_STALL_MS in
// extensions/goal-loop-auditor-process.ts.
export const MAX_STALL_TIMEOUT_MS = 24 * 3_600_000;
export const MIN_BUDGET_MS = 50;

/** Floor + ceiling clamp for an already-parsed numeric budget. */
export function clampBudget(valueMs, { floor = MIN_BUDGET_MS, ceiling = MAX_TOOL_TIMEOUT_MS } = {}) {
  if (!Number.isFinite(valueMs)) return undefined;
  return Math.min(ceiling, Math.max(floor, Math.floor(valueMs)));
}

/** Parse one env knob into a bounded budget; non-finite input degrades to
 * the fallback (never to unbounded, never to zero). */
export function resolveBudget(envValue, fallbackMs, options) {
  const parsed = Number(envValue ?? fallbackMs);
  return clampBudget(parsed, options) ?? fallbackMs;
}

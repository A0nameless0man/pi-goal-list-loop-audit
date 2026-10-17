// pi-goal-list-loop-audit — blank-until-resume auditor surface
//
// A cold session load may restore an unfinished objective without granting the
// supervisor permission to continue it. Keep the durable objective/list card
// visible, but do not re-surface the previous auditor report in newly built
// continuation context or feedback UI until a continuation consent path is
// admitted. The existing transcript is historical and is intentionally not
// edited.
//
// v0.39.38 (audit MEDIUM finding): the gate was a single process-local
// boolean, so a cold restore in one co-resident session suppressed every
// other session in the same process, and any single session's resume
// released the surface for everyone. The gate is now keyed by the surface
// identity (goal id, list item id, or owner session id) so each
// session/goal's consent decision stays local. A goal-keyed entry persists
// for the lifetime of the process; a session-only key (when no goal or
// list item is loaded) is bounded to the session's owner id.
//
// The lifecycle layer sets the current key on every session_start. Display
// and continuation paths read the current key when no goal is in hand
// (e.g. a loop-only state). Goal-aware readers use the keyed variant
// directly. This module is dependency-free because the display,
// continuation, command, and lifecycle slices all need the same per-key
// gate.

const suppressedByKey = new Map<string, boolean>();
/** Key used by the no-arg readers when the lifecycle has not set a current
 * key (e.g. tests that exercise the module in isolation). Distinct from
 * any real session/goal so test isolation stays clean. */
const GLOBAL_FALLBACK_KEY = "__glla_auditor_surface_global__";
let currentAuditorSurfaceKey: string = GLOBAL_FALLBACK_KEY;

function normalizeKey(parts: ReadonlyArray<string | undefined | null>): string {
  for (const part of parts) {
    if (typeof part === "string" && part) return part;
  }
  return GLOBAL_FALLBACK_KEY;
}

/** Build the surface key from a goal / list item / owner session.
 * Goal keys always win — the auditor report is keyed to the goal. List
 * items use their own id, then the owner session. */
export function auditorSurfaceKey(input: {
  goalId?: string | null;
  listItemId?: string | null;
  ownerSessionId?: string | null;
}): string {
  return normalizeKey([input.goalId, input.listItemId, input.ownerSessionId]);
}

/** Set the current surface key. The lifecycle layer calls this on every
 * session_start so no-arg readers (display paths without a goal) see the
 * right key. Goal-aware readers can ignore this and use the keyed API. */
export function setCurrentAuditorSurfaceKey(key: string): void {
  if (key) currentAuditorSurfaceKey = key;
}

/** Hide only newly projected auditor feedback after a no-consent cold load. */
export function suppressAuditorSurfaceAfterColdRestore(key: string): void {
  suppressedByKey.set(key, true);
}

/** Release the gate after an actual explicit/automatic continuation consent. */
export function releaseAuditorSurface(key: string): void {
  suppressedByKey.delete(key);
}

/** Goal-aware release for consent paths (/goal resume, /list resume,
 * /loop resume, /glla resume, resume_goal, main-model recovery resume).
 * Mirrors the lifecycle's key contract exactly: the goal id when one is
 * loaded (the key goal-aware readers use), else the owner session id
 * extracted from ctx.sessionManager (the lifecycle's fallback). A stale
 * or foreign session must return before calling — same fence as before.
 * v0.39.38 fix for the auditor's residual-leak repro: the previous
 * releaseCurrentAuditorSurface() deleted a single process-global current
 * pointer (last session_start wins), so co-resident A's resume released
 * B's key and left A suppressed. */
export function releaseAuditorSurfaceForGoal(goalId?: string | null, sessionManager?: unknown): void {
  let owner = "unknown-session";
  try {
    const getId = (sessionManager as { getSessionId?: () => string } | undefined)?.getSessionId;
    if (typeof getId === "function") owner = String(getId.call(sessionManager)) || owner;
  } catch { /* keep the unknown-session fallback, mirroring sessionManagerId */ }
  releaseAuditorSurface(auditorSurfaceKey({ goalId, ownerSessionId: owner }));
}

export function auditorSurfaceSuppressed(key?: string): boolean {
  const effective = key ?? currentAuditorSurfaceKey;
  return suppressedByKey.get(effective) === true;
}

/** Test hook: prevent module state leaking between co-resident fixtures. */
export function __testOnlyResetAuditorSurface(): void {
  suppressedByKey.clear();
  currentAuditorSurfaceKey = GLOBAL_FALLBACK_KEY;
}

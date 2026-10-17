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
// Every suppress/read/release call takes an explicit key — there is no
// process-global current pointer (removed v0.39.38 after the detached
// audit proved last-session_start-wins released the wrong surface).
// Goal-aware paths pass the goal id; the lifecycle passes
// state.goal?.id ?? owner-session on session_start. This module is
// dependency-free because the display, continuation, command, and
// lifecycle slices all need the same per-key gate.

const suppressedByKey = new Map<string, boolean>();
/** Fallback key when no goal/list/owner identity is available. A plain
 * constant, not mutable process-global state — two keyless suppressions
 * share it, but every production caller passes an explicit key. */
const GLOBAL_FALLBACK_KEY = "__glla_auditor_surface_global__";

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

export function auditorSurfaceSuppressed(key: string): boolean {
  return suppressedByKey.get(key) === true;
}

/** Test hook: prevent module state leaking between co-resident fixtures. */
export function __testOnlyResetAuditorSurface(): void {
  suppressedByKey.clear();
}

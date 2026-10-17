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
// This module is dependency-free because the display, continuation, command,
// and lifecycle slices all need the same per-key gate.

const suppressedByKey = new Map<string, boolean>();

/** Default key when no goal/list/owner context is available. Used as a
 * safe fallback so the gate still works in tests and projection paths
 * that legitimately have no surface identity to attribute the suppression
 * to. Distinct from any real session/goal so test isolation stays clean. */
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

export function auditorSurfaceSuppressed(key: string): boolean {
  return suppressedByKey.get(key) === true;
}

/** Read the gate for the current surface (goal first, then list item,
 * then owner session). Use this from display / continuation / feedback
 * paths that do not already hold a single key. */
export function auditorSurfaceSuppressedFor(input: {
  goalId?: string | null;
  listItemId?: string | null;
  ownerSessionId?: string | null;
}): boolean {
  const key = auditorSurfaceKey(input);
  if (suppressedByKey.get(key) === true) return true;
  // The list-item path falls back to the owner session (a list item is
  // surfaced while a goal is being restored). A goal key never falls
  // through to a list item or owner session — a different goal's
  // suppression must not silence this goal's projection.
  if (input.goalId) return false;
  if (input.listItemId && input.ownerSessionId
    && suppressedByKey.get(input.ownerSessionId) === true) return true;
  if (!input.goalId && !input.listItemId && input.ownerSessionId
    && suppressedByKey.get(input.ownerSessionId) === true) return true;
  return false;
}

/** Test hook: prevent module state leaking between co-resident fixtures. */
export function __testOnlyResetAuditorSurface(): void {
  suppressedByKey.clear();
}

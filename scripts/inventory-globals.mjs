#!/usr/bin/env node
// pi-goal-list-loop-audit — v0.39.38
//
// Ambient-bridge-name extraction for scripts/generate-inventory.mjs. The
// lookup used to be an inline double-split that crashed with a bare
// TypeError when the globals export moved, and the audit-baseline count
// text rotted silently beside the live count. Both failure modes are loud
// now: a missing marker names the file and the rename suspicion, and a
// count/baseline mismatch names both numbers plus the bump procedure.

/** Opening line of the globals list in extensions/loops/goal-runtime-globals.ts. */
export const GLOBAL_NAMES_MARKER = "export const GOAL_RUNTIME_GLOBAL_NAMES = [";
/** Closing line of that list. */
export const GLOBAL_NAMES_TERMINATOR = "] as const";
/**
 * Audit 2026-10-17: ambient bridge names stood at 179. Bump this with the
 * audit date (not silently) when the bridge set legitimately changes — the
 * generator fails closed on drift so the baseline text can never rot.
 */
export const AUDIT_BASELINE_GLOBAL_NAMES = 179;

/** The quoted names inside the globals list; throws a named error when the shape moved. */
export function extractGlobalNames(source, fileLabel = "<source>") {
  const [, after] = source.split(GLOBAL_NAMES_MARKER);
  if (after === undefined) {
    throw new Error(
      `generate-inventory: marker ${JSON.stringify(GLOBAL_NAMES_MARKER)} not found in ${fileLabel} — was the globals export renamed?`,
    );
  }
  // Note: split with no match returns [whole], so absence needs an explicit
  // membership check — otherwise a lost terminator silently widens the scan.
  if (!after.includes(GLOBAL_NAMES_TERMINATOR)) {
    throw new Error(
      `generate-inventory: terminator ${JSON.stringify(GLOBAL_NAMES_TERMINATOR)} not found in ${fileLabel} — did the globals list shape change?`,
    );
  }
  const [list] = after.split(GLOBAL_NAMES_TERMINATOR);
  return [...(list ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/** Null when the live count matches the audit baseline, otherwise the drift report. */
export function baselineDrift(count) {
  if (count === AUDIT_BASELINE_GLOBAL_NAMES) return null;
  return (
    `generate-inventory: ambient bridge names stand at ${count} (audit baseline: ${AUDIT_BASELINE_GLOBAL_NAMES}) — ` +
    `review the delta, then bump AUDIT_BASELINE_GLOBAL_NAMES with the new audit date.`
  );
}

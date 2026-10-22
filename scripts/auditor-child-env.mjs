// pi-goal-list-loop-audit — auditor child env + binary fence.
//
// Two halves of one trust boundary at the worker→pi spawn:
//
// 1. The worker must never inherit full process.env into the auditor child.
//    The parent hashes the exact fenced key list into the request as
//    auditorEnvAllowlist; the child gets only those keys, copied from the
//    worker's own env. If the parent fence ever regresses and the worker
//    env carries host secrets, they stop here. A missing or malformed list
//    throws fail-closed (identity error) — never degrading to full env.
//    Tampering with the list breaks the request hash, which the worker
//    verifies at load. NOTE (v0.39.45, audit 2026-10-22): that hash is a
//    CONSISTENCY check, not an authenticity guarantee — it is unkeyed, so
//    anything that can write the job dir can recompute it. The verdict
//    artifact is protected separately by a per-attempt HMAC key that never
//    leaves the parent's memory and the worker's pipe.
// 2. GLLA_PI_BINARY must not redirect the auditor to an arbitrary
//    executable: unset means PATH-resolved `pi`; anything else must be an
//    absolute path to an existing file (operators needing a custom binary
//    use its absolute path).
//
// Pure except for the existence probe (injected default) so tests pin the
// fence without spawning children.

import { statSync } from "node:fs";

export const MAX_ENV_KEYS = 512;
export const MAX_ENV_NAME_CHARS = 256;
const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Shape gate for the hashed key list. Shared by the worker's load-time
 * identity check (exit-1 result-less) and the spawn path, so both fail
 * closed identically. */
export function assertAuditorEnvAllowlistShape(allowlist) {
  if (!Array.isArray(allowlist) || allowlist.length > MAX_ENV_KEYS) {
    throw new Error("auditor request auditorEnvAllowlist must be an array of at most 512 env names");
  }
  for (const name of allowlist) {
    if (typeof name !== "string" || name.length === 0 || name.length > MAX_ENV_NAME_CHARS || !ENV_NAME_RE.test(name)) {
      throw new Error("auditor request auditorEnvAllowlist contains an invalid env name");
    }
  }
}

/** Forward only allowlisted keys from source into a fresh env object. */
export function buildAuditorChildEnv(sourceEnv, allowlist) {
  assertAuditorEnvAllowlistShape(allowlist);
  const childEnv = {};
  for (const name of allowlist) {
    const value = sourceEnv?.[name];
    if (typeof value === "string") childEnv[name] = value;
  }
  return childEnv;
}

/** Resolve the auditor binary fail-closed: default `pi`, or an absolute
 * path to an existing file. Anything else is an identity error. */
export function resolveAuditorBinary(value, exists = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed === "pi") return "pi";
  if (trimmed.includes("\0")) throw new Error("auditor binary must be `pi` or an absolute path to an existing file");
  if (!trimmed.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(trimmed)) {
    throw new Error("auditor binary must be `pi` or an absolute path to an existing file (bare names are not accepted)");
  }
  let ok = false;
  try {
    ok = exists(trimmed);
  } catch {
    ok = false;
  }
  if (!ok) throw new Error("auditor binary must be `pi` or an absolute path to an existing file");
  return trimmed;
}

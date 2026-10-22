// pi-goal-list-loop-audit — worker-side extension-spec fence.
//
// The parent resolves the auditor extension allowlist to concrete existing
// paths at dispatch, but the worker re-reads the job dir at spawn. Its
// request validation was shape-only (array, <=32, non-empty string), so a
// corrupted or tampered request could pass arbitrary specs verbatim to
// `pi --extension <spec>` — scheme specs (npm:/git:/file:) with install or
// fetch side effects, flag-shaped values, or relative paths pi resolves
// against a different cwd.
//
// Provenance cannot be re-derived worker-side (the parent honors
// author-named absolute paths anywhere), so the enforceable contract is
// hygiene PLUS a root fence: a spec must be an absolute, existing,
// scheme-free path INSIDE one of the operator's own trees — the audited
// project and the pi agent directory. Anything else is dropped
// fail-closed (the auditor then runs fully isolated — the documented safe
// default) with a count for the worker's stderr diagnostic.
//
// v0.39.45 (audit 2026-10-22): the hygiene-only fence kept ANY absolute
// existing path, so a tampered job dir could name an extension file
// anywhere on the host and widen the auditor into foreign code. The root
// fence closes that: a tampered job dir can only reach the operator's own
// project/agent trees. No roots means no spec survives (fail-closed).
//
// Pure except for the existence probe (injected filesystem default) so
// tests pin the fence without touching the host.

import { existsSync } from "node:fs";
import * as path from "node:path";

export const MAX_EXTENSION_SPECS = 32;
export const MAX_EXTENSION_SPEC_CHARS = 1024;

/** True for `scheme:` prefixes except a win32 drive letter (`C:\…`). */
export function hasSchemePrefix(spec) {
  if (/^[A-Za-z]:[\\/]/.test(spec)) return false;
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(spec);
}

/** Is `spec` inside one of the roots? Path-boundary aware: `/ext` does not
 * contain `/extension`. */
export function isInsideRoot(spec, roots) {
  const list = Array.isArray(roots) ? roots : [];
  const target = path.resolve(spec);
  for (const root of list) {
    if (typeof root !== "string" || !root.trim()) continue;
    const base = path.resolve(root);
    if (target === base) return true;
    if (target.startsWith(base.endsWith(path.sep) ? base : base + path.sep)) return true;
  }
  return false;
}

/** Fail-closed filter: keep only loadable absolute paths inside the given
 * roots. Returns the kept specs plus a drop count for diagnostics. Never
 * throws on hostile input. */
export function filterLoadableExtensionSpecs(specs, exists = existsSync, roots = []) {
  const ok = [];
  let dropped = 0;
  const seen = new Set();
  const list = Array.isArray(specs) ? specs : [];
  for (const entry of list) {
    if (ok.length >= MAX_EXTENSION_SPECS) { dropped += 1; continue; }
    if (typeof entry !== "string") { dropped += 1; continue; }
    const spec = entry.trim();
    const key = spec.toLowerCase();
    if (!spec || seen.has(key)) { dropped += 1; continue; }
    seen.add(key);
    if (
      spec.length > MAX_EXTENSION_SPEC_CHARS
      || spec.includes("\0")
      || spec.startsWith("-")
      || hasSchemePrefix(spec)
      || !path.isAbsolute(spec)
    ) {
      dropped += 1;
      continue;
    }
    if (!isInsideRoot(spec, roots)) { dropped += 1; continue; }
    let loadable = false;
    try {
      loadable = exists(spec);
    } catch {
      loadable = false;
    }
    if (!loadable) { dropped += 1; continue; }
    ok.push(spec);
  }
  return { ok, dropped };
}

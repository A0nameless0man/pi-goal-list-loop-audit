// pi-goal-list-loop-audit — v0.38.82
// scripts/slow-files.mjs
//
// Files too slow for the default fast loop (each over ~8s standalone;
// the full serialized suite is ~7 minutes). `npm test` (fast) excludes
// these via bun --path-ignore-patterns; `npm run test:slow` runs them;
// `npm run test:all` / release:check still run everything, so nothing
// escapes the gate. Timings are standalone per-file runs on the
// maintainer rig, 2026-09-21, under 6-way parallel load (absolute
// numbers are inflated; relative ordering is what classified them).
// Re-time when the suite shape changes.
//
// v0.39.45 (audit 2026-10-22): this list moved HERE from
// tests/slow-files.mjs. The hardened runner (scripts/run-tests.mjs) is
// SHIPPED in the npm tarball, but `tests/` is not — so a runner that
// imported the list from tests/ could not be imported from an installed
// package at all (ERR_MODULE_NOT_FOUND). The list is runner policy, not
// test material, so it lives beside the runner that consumes it.
// tests/slow-files.mjs re-exports this module for the existing test
// imports.
//
// NOTE: this file is not *.test.* by design — bun never runs it.

export const SLOW_TEST_FILES = [
  "tests/behavioral-orchestrator.test.ts", // 106s — the whale: full-harness lifecycle matrix
  "tests/supervised-provider-exhaustion-runtime.test.ts", // ~110s — 2101-failure provider-exhaustion integration stress per mode
  "tests/drafting-handoff.test.ts", // 37s
  "tests/completion-communication.test.ts", // 33s
  "tests/auditor-process.test.ts", // 21s — real worker spawns
  "tests/auditor-retry-callback.test.ts", // 19s
  "tests/list-draft-handoff.test.ts", // 16s
  "tests/auditor-stall-watchdog.test.ts", // 15s — real watchdog windows
  "tests/compaction-containment.test.ts", // 13s
  "tests/revision-bound-audit.test.ts", // 11s
  "tests/subagent-hang-detection.test.ts", // 10s — real hang windows
  "tests/loop-error-exemption.test.ts", // 10s
  "tests/glla-stale-context.test.ts", // 8s
];

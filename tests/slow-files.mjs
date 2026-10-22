// pi-goal-list-loop-audit — v0.38.82
// tests/slow-files.mjs
//
// The slow-file list now lives in scripts/slow-files.mjs (v0.39.45, audit
// 2026-10-22): the hardened runner that CONSUMES it ships in the npm
// tarball, while `tests/` does not, so a runner importing the list from
// here could not be imported from an installed package. This module keeps
// the historical import path working for the test suite.
//
// NOTE: this file is not *.test.* by design — bun never runs it.

export { SLOW_TEST_FILES } from "../scripts/slow-files.mjs";

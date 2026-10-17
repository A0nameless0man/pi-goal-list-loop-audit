// pi-goal-list-loop-audit — v0.39.38
// The smoke lane and the release-contract lane parsed `npm pack --json`
// twice, differently, so one npm shape could green one lane and red the
// other. Both now share scripts/npm-pack-report.mjs; this pins the shape
// matrix and the cross-lane agreement on every shape.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  packReportEntries,
  packReportFiles,
  packReportFilename,
} from "../scripts/npm-pack-report.mjs";

const entry = (overrides = {}) => ({
  filename: "glla-0.0.0.tgz",
  files: [{ path: "package/README.md" }, { path: "extensions/goal-loop.ts" }],
  ...overrides,
});

test("v0.39.38: every historical npm pack shape normalizes to the same entries", () => {
  const e = entry();
  assert.deepEqual(packReportEntries([e]), [e], "array of reports");
  assert.deepEqual(packReportEntries(e), [e], "single report object");
  assert.deepEqual(packReportEntries({ id: e }), [e], "keyed object");
  assert.deepEqual(packReportEntries({}), [], "empty object ships nothing");
  assert.deepEqual(packReportEntries(null), [], "null ships nothing");
  assert.deepEqual(packReportEntries("garbage"), [], "non-object ships nothing");
});

test("v0.39.38: files and filename agree across shapes (no green/red split)", () => {
  const e = entry();
  for (const shape of [[e], e, { id: e }]) {
    assert.deepEqual(
      packReportFiles(shape),
      ["README.md", "extensions/goal-loop.ts"],
      "both lanes see the same file list",
    );
    assert.equal(packReportFilename(shape), "glla-0.0.0.tgz", "both lanes see the same tarball");
  }
  assert.throws(() => packReportFilename({}), /did not return a tarball filename/);
  assert.throws(() => packReportFilename([]), /did not return a tarball filename/);
});

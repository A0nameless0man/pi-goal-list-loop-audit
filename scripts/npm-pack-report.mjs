#!/usr/bin/env node
// pi-goal-list-loop-audit — v0.39.38
//
// Single parser for `npm pack --json` transport shapes, shared by the
// release smoke (scripts/release-pack-smoke.mjs) and the release contract
// (tests/release-contract.test.ts). npm has emitted a keyed object, a
// single report object, and an array of reports across versions, with
// root-relative and `package/...` paths — parsing that shape twice,
// differently, meant one lane could green while the other redded on the
// same npm version. Parse once, here, and share the verdict.

/** Normalize any `npm pack --json` shape to its report-entry list. */
export function packReportEntries(report) {
  if (Array.isArray(report)) return report;
  if (report && typeof report === "object") {
    if (Array.isArray(report.files)) return [report];
    const values = Object.values(report);
    if (values.length > 0 && values.every((value) => value && typeof value === "object")) return values;
    return [report];
  }
  return [];
}

/** Every shipped path across all entries, with the `package/` prefix stripped. */
export function packReportFiles(report) {
  return packReportEntries(report)
    .flatMap((entry) => (entry && typeof entry === "object" && Array.isArray(entry.files) ? entry.files : []))
    .filter((file) => file && typeof file.path === "string")
    .map((file) => file.path.replace(/^package\//, ""));
}

/** The tarball filename from the first entry; throws when no lane could pack. */
export function packReportFilename(report) {
  const [entry] = packReportEntries(report);
  if (!entry || typeof entry.filename !== "string") throw new Error("npm pack did not return a tarball filename");
  return entry.filename;
}

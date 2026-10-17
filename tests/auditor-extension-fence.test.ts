// pi-goal-list-loop-audit — extension-spec fence tests.
//
// Finding: the auditor extension allowlist check was shape-only, then specs
// were passed verbatim to `pi --extension`, widening the read/grep/find/ls/
// bash sandbox to arbitrary specs. The fence lives in
// scripts/auditor-extension-specs.mjs (pure + injected existence probe) so it
// is pinned here — the worker itself cannot be imported (main() runs at
// load), so worker wiring is source-pinned.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fence = await import(pathToFileURL(path.join(__dirname, "../scripts/auditor-extension-specs.mjs")).href);
const { filterLoadableExtensionSpecs, hasSchemePrefix, MAX_EXTENSION_SPECS } = fence;

const REAL = ["/ext/a", "/ext/b"];
const exists = (p: string) => REAL.includes(p);

test("v0.39.38: loadable absolute paths pass through trimmed", () => {
  assert.deepEqual(filterLoadableExtensionSpecs([" /ext/a ", "/ext/b"], exists), { ok: ["/ext/a", "/ext/b"], dropped: 0 });
});

test("v0.39.38: scheme specs with side effects are dropped (the finding's red case)", () => {
  const hostile = ["npm:evil-pkg", "github.com/org/repo", "file:///etc/passwd", "https://example.com/ext.zip", "node:fs"];
  const { ok, dropped } = filterLoadableExtensionSpecs(hostile, () => true);
  assert.deepEqual(ok, [], "even an 'everything exists' host keeps no scheme spec");
  assert.equal(dropped, hostile.length);
});

test("v0.39.38: flag-shaped and relative specs never reach the spawn", () => {
  const { ok, dropped } = filterLoadableExtensionSpecs(["--tools", "-e", "--no-extensions", "rel/path", "../up", "~/home"], exists);
  assert.deepEqual(ok, []);
  assert.equal(dropped, 6);
});

test("v0.39.38: missing, over-long, NUL and duplicate entries drop fail-closed", () => {
  assert.deepEqual(filterLoadableExtensionSpecs(["/ext/nope"], exists), { ok: [], dropped: 1 });
  assert.equal(filterLoadableExtensionSpecs([`/ext/a/${"x".repeat(2000)}`], () => true).dropped, 1);
  assert.equal(filterLoadableExtensionSpecs(["/ext/a\0--tools"], () => true).dropped, 1);
  assert.deepEqual(
    filterLoadableExtensionSpecs(["", "  ", "/ext/a", "/EXT/A", "/ext/b"], exists),
    { ok: ["/ext/a", "/ext/b"], dropped: 3 },
  );
  const flood = Array.from({ length: MAX_EXTENSION_SPECS + 8 }, (_, i) => `/ok/${i}`);
  const capped = filterLoadableExtensionSpecs(flood, () => true);
  assert.equal(capped.ok.length, MAX_EXTENSION_SPECS, "32-spec bound holds");
  assert.equal(capped.dropped, 8);
});

test("v0.39.38: real temp-dir extensions load; drive letters are not schemes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glla-ext-"));
  try {
    assert.deepEqual(filterLoadableExtensionSpecs([dir], undefined), { ok: [dir], dropped: 0 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(hasSchemePrefix("C:\\ext"), false, "win32 drive letter is a path, not a scheme");
  assert.equal(hasSchemePrefix("C:/ext"), false);
  assert.equal(hasSchemePrefix("npm:foo"), true);
});

test("v0.39.38: the worker fences specs instead of passing them verbatim", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../scripts/goal-auditor-worker.mjs"), "utf-8");
  assert.match(worker, /from "\.\/auditor-extension-specs\.mjs"/, "worker imports the fence");
  assert.match(worker, /filterLoadableExtensionSpecs\(request\.allowedExtensions\)/, "spawn path filters the job-dir list");
  assert.match(worker, /dropped .* unloadable allowedExtension/, "drops are diagnosed on stderr");
  assert.doesNotMatch(worker, /for \(const spec of request\.allowedExtensions \?\? \[\]\) piArgs\.push\("--extension", spec\)/, "verbatim push is gone");
});

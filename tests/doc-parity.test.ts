// Documentation-vs-code parity.
//
// v0.39.40 (audit 2026-10-19): a read-only audit pass found the shipped docs
// contradicting the code in four places — the README's settings table was
// missing the Designer tab (the code ships nine sections, the README said
// eight), docs/ARCHITECTURE.md said "12 slowest" where the slow-file list
// holds 13, it said "~340 event types" where the runtime emits ~410, and
// LIST-PHILOSOPHY.md pointed at an INSTALL.md "Reviewer" section that does
// not exist.
//
// Nothing guarded those numbers, so they drift silently on every release.
// This pins the ones that are DERIVED from the code: a doc that quotes a
// count must quote the current count, and a doc that lists the settings
// sections must list every section the menu actually ships.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { SETTINGS_SECTIONS } from "../extensions/settings-menu.js";
import { DEFAULT_REVIEWER_CONFIG } from "../extensions/reviewer.js";
import { SLOW_TEST_FILES } from "../tests/slow-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), "utf8");

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/** The distinct event-type names the runtime can journal. */
function ledgerEventTypes(): Set<string> {
  const names = new Set<string>();
  for (const file of fs.readdirSync(path.join(ROOT, "extensions"))) {
    const full = path.join(ROOT, "extensions", file);
    if (!fs.statSync(full).isDirectory()) {
      collect(full);
    } else {
      for (const nested of fs.readdirSync(full)) {
        if (nested.endsWith(".ts")) collect(path.join(full, nested));
      }
    }
  }
  return names;

  function collect(file: string): void {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/appendLedger\([^;]*?,\s*"([a-z0-9_]+)"/g)) {
      names.add(match[1]!);
    }
  }
}

test("the README settings table lists every section the menu ships", () => {
  const readme = read("README.md");
  const table = readme.split("\n").filter((line) => line.startsWith("| "));
  const listed = new Set(
    table
      .map((line) => line.split("|")[1]?.trim() ?? "")
      .filter((label) => label.length > 0 && label !== "Section" && label !== "---"),
  );
  for (const section of SETTINGS_SECTIONS) {
    assert.ok(listed.has(section.label), `the README settings table is missing the "${section.label}" section`);
  }
});

test("the README settings count matches the number of sections the menu ships", () => {
  const readme = read("README.md");
  const claim = readme.match(/switch between the (\w+) sections/);
  assert.ok(claim, "the README still states how many settings sections there are");
  const claimed = NUMBER_WORDS[claim[1]!.toLowerCase()];
  assert.ok(claimed !== undefined, `the README settings count "${claim[1]}" is a number this test can read`);
  assert.equal(claimed, SETTINGS_SECTIONS.length, "the README quotes a stale settings-section count");
});

test("docs/ARCHITECTURE.md quotes the current slow-file count", () => {
  const architecture = read("docs/ARCHITECTURE.md");
  const claim = architecture.match(/minus the (\d+) slowest/);
  assert.ok(claim, "docs/ARCHITECTURE.md still states how many test files are slow");
  assert.equal(Number(claim[1]), SLOW_TEST_FILES.length, "docs/ARCHITECTURE.md quotes a stale slow-file count");
});

test("docs/ARCHITECTURE.md quotes a ledger event-type count close to the runtime", () => {
  const architecture = read("docs/ARCHITECTURE.md");
  const claim = architecture.match(/~(\d+) event\s+types/);
  assert.ok(claim, "docs/ARCHITECTURE.md still states how many ledger event types exist");
  const actual = ledgerEventTypes().size;
  const claimed = Number(claim[1]);
  // The doc writes an approximation, so the check is a drift band rather than
  // equality: a number that is off by more than a fifth is stale.
  const drift = Math.abs(actual - claimed) / claimed;
  assert.ok(
    drift <= 0.2,
    `docs/ARCHITECTURE.md says ~${claimed} ledger event types but the runtime emits ${actual} (${Math.round(drift * 100)}% off)`,
  );
});

test("LIST-PHILOSOPHY.md does not point at a section that does not exist", () => {
  const philosophy = read("LIST-PHILOSOPHY.md");
  const references = [...philosophy.matchAll(/`(INSTALL\.md|README\.md|docs\/[A-Za-z0-9_.-]+\.md)`\s+"([^"]+)"/g)];
  for (const [, file, section] of references) {
    const target = read(file!);
    assert.ok(
      target.includes(section!),
      `LIST-PHILOSOPHY.md points at ${file} "${section}", which that file does not contain`,
    );
  }
});

// ---- v0.39.40: docs review (audit 2026-10-19) ----
//
// Three more doc claims that had drifted from the code. Each one is
// written so the DOC is checked against the CODE, not against a frozen
// copy of the doc: re-adding the behaviour to the code demands the
// matching doc change, and removing it demands the reverse.

test("LIST-PHILOSOPHY.md matches the reviewer's default cascade", () => {
  const philosophy = read("LIST-PHILOSOPHY.md");
  const paragraph = philosophy
    .split(/\n\s*\n/)
    .find((p) => p.includes("**Reviewer**") && p.includes("post-completion glue layer"));
  assert.ok(paragraph, "LIST-PHILOSOPHY.md still has the Reviewer paragraph");

  // The code is the authority. v0.29.0 removed the reflexive
  // `fire-audit-on-clean` step from the default cascade (it paid for
  // verification twice and was hydra fuel); the step survives only as an
  // explicit opt-in under /glla postaudit.
  const firesByDefault = DEFAULT_REVIEWER_CONFIG.cascade.includes("fire-audit-on-clean");
  if (firesByDefault) {
    assert.match(
      paragraph!,
      /fires a regression-scan audit on clean completions/i,
      "the default cascade fires the clean-completion audit, so LIST-PHILOSOPHY.md must say so",
    );
  } else {
    assert.doesNotMatch(
      paragraph!,
      /fires a regression-scan audit on clean completions/i,
      "the default cascade does NOT fire the clean-completion audit, but LIST-PHILOSOPHY.md still claims it does",
    );
    assert.match(
      paragraph!,
      /opt-in/i,
      "LIST-PHILOSOPHY.md must say the clean-completion audit is opt-in",
    );
  }
});

test("docs/INDEX.md names the oldest and newest release the CHANGELOG records", () => {
  const changelog = read("CHANGELOG.md");
  const versions = [
    ...changelog.matchAll(/^##\s+\[?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\]?/gm),
  ].map((m) => m[1]!);
  assert.ok(versions.length > 0, "CHANGELOG.md has release headings");

  const compare = (a: string, b: string): number => {
    const pa = a.split("-")[0]!.split(".").map(Number);
    const pb = b.split("-")[0]!.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    const preA = a.includes("-");
    const preB = b.includes("-");
    if (preA !== preB) return preA ? -1 : 1; // a prerelease sorts before its release
    if (preA && preB) return a < b ? -1 : a > b ? 1 : 0;
    return 0;
  };
  const oldest = versions.reduce((acc, v) => (compare(v, acc) < 0 ? v : acc));
  const newest = versions.reduce((acc, v) => (compare(v, acc) > 0 ? v : acc));

  const index = read("docs/INDEX.md");
  assert.ok(
    index.includes(oldest),
    `docs/INDEX.md does not mention the oldest CHANGELOG release (v${oldest}) — the changelog records more than the index claims`,
  );
  assert.ok(
    index.includes(newest),
    `docs/INDEX.md does not mention the newest CHANGELOG release (v${newest})`,
  );
});

test("the chunking hint names Pi's real stop-reason field", () => {
  // Pi's assistant message carries `stopReason: StopReason` ("length" is a
  // member). There is no `stop_reason` field anywhere in Pi or in GLLA —
  // naming one in a model-facing prompt sends an operator looking for a
  // handle that does not exist.
  const prompt = read("prompts/goal-loop-continuation.md");
  assert.match(prompt, /stopReason: "length"/, "the continuation prompt names Pi's stopReason field");
  assert.doesNotMatch(prompt, /stop_reason/, "the continuation prompt names a field that does not exist");

  const auditor = read("extensions/goal-loop-auditor.ts");
  assert.match(auditor, /stopReason: \\"length\\"/, "the auditor prompt names Pi's stopReason field");
  assert.doesNotMatch(auditor, /stop_reason/, "the auditor prompt names a field that does not exist");
});

test("docs/DESIGN.md names only identifiers that still exist in the code", () => {
  // A design doc that names a removed function, or a misspelled settings key,
  // sends a reader looking for something that is not there. The companion
  // (pi-subagents) owns the two external names below; every other identifier
  // the doc names must still resolve in extensions/ or schemas/.
  //
  // This class bit twice: `runGoalCompletionAuditor` (superseded by
  // runDetachedGoalCompletionAuditor in v0.34.108) and `tokenlimit` (the
  // setting is `tokenLimit`).
  const EXTERNAL = new Set(["modelScope", "outputSchema"]);

  let corpus = "";
  for (const dir of ["extensions", "schemas"]) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const full = path.join(ROOT, dir, entry.name);
      if (entry.isDirectory()) {
        for (const nested of fs.readdirSync(full)) {
          if (nested.endsWith(".ts") || nested.endsWith(".json")) corpus += read(`${dir}/${entry.name}/${nested}`);
        }
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".json")) {
        corpus += read(`${dir}/${entry.name}`);
      }
    }
  }

  const design = read("docs/DESIGN.md");
  const tokens = [...design.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/g)].map((m) => m[1]!);
  const missing = [...new Set(tokens)].filter((t) => !EXTERNAL.has(t) && !corpus.includes(t));
  assert.deepEqual(
    missing,
    [],
    `docs/DESIGN.md names identifiers that do not exist in the code: ${missing.join(", ")}`,
  );
});

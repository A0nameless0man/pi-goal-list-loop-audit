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

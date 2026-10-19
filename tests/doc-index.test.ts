// Documentation-index completeness and link integrity.
//
// v0.39.40 (audit 2026-10-19, docs review): docs/INDEX.md is the only map a
// reader of the published package has, and two CURRENT shipped docs were
// unreachable from it — docs/DESIGN-work-lifecycle.md and docs/UI-STATUS.md
// — while a third shipped doc, PLAN.md, was missing too. Nothing caught it:
// the index was prose, so a doc could be added, shipped and stay invisible.
//
// This test locks three properties:
//   1. Every shipped doc is reachable from docs/INDEX.md.
//   2. Every relative markdown link in the shipped docs resolves.
//   3. The index does not advertise a doc that does not exist.
//
// (The version trail in the index is covered by tests/release-contract.test.ts.)

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = path.join(ROOT, "docs/INDEX.md");
const indexSrc = fs.readFileSync(INDEX, "utf8");

/** Directories whose markdown ships in the npm package. */
const SHIPPED_DIRS = ["docs", "prompts", "skills", "examples"];
/** Repository-only trees that are not part of the published documentation. */
const NOT_SHIPPED = new Set([".research", ".pi-glla", "node_modules", ".git", "audit", ".commandcode"]);

function walk(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (NOT_SHIPPED.has(entry.name)) continue;
      out.push(...walk(path.join(rel, entry.name)));
    } else if (entry.name.endsWith(".md")) {
      out.push(path.join(rel, entry.name));
    }
  }
  return out;
}

test("every shipped doc is reachable from the documentation index", () => {
  const shippedDocs = fs
    .readdirSync(path.join(ROOT, "docs"))
    .filter((f) => f.endsWith(".md") && f !== "INDEX.md")
    .map((f) => `docs/${f}`);
  // Root-level documents that the package ships.
  const files = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    files?: string[];
  };
  const rootDocs = (files.files ?? []).filter(
    (entry) => entry.endsWith(".md") && fs.existsSync(path.join(ROOT, entry)),
  ) as string[];

  const unlinked = [...shippedDocs, ...rootDocs].filter((file) => {
    const name = path.basename(file);
    // The index may link the doc by its bare name or by a relative path.
    return !indexSrc.includes(name);
  });

  assert.deepEqual(
    unlinked,
    [],
    `docs/INDEX.md does not link these shipped documents: ${unlinked.join(", ")}`,
  );
});

test("every relative markdown link in the shipped docs resolves", () => {
  const files = [
    ...SHIPPED_DIRS.flatMap((dir) => walk(dir)),
    ...(fs.existsSync(path.join(ROOT, "README.md")) ? ["README.md"] : []),
    ...(fs.existsSync(path.join(ROOT, "INSTALL.md")) ? ["INSTALL.md"] : []),
    ...(fs.existsSync(path.join(ROOT, "LIST-PHILOSOPHY.md")) ? ["LIST-PHILOSOPHY.md"] : []),
  ];
  const broken: string[] = [];
  for (const file of files) {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const match of src.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1]!;
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const clean = target.split("#")[0];
      if (!clean) continue;
      const resolved = path.resolve(ROOT, path.dirname(file), clean);
      if (!fs.existsSync(resolved)) broken.push(`${file}: [${target}]`);
    }
  }
  assert.deepEqual(broken, [], `broken relative links:\n${broken.join("\n")}`);
});

test("the index does not link a document that does not exist", () => {
  const missing: string[] = [];
  for (const match of indexSrc.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1]!;
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const clean = target.split("#")[0];
    if (!clean) continue;
    const resolved = path.resolve(ROOT, path.dirname(INDEX), clean);
    if (!fs.existsSync(resolved)) missing.push(target);
  }
  assert.deepEqual(missing, [], `docs/INDEX.md links these missing targets: ${missing.join(", ")}`);
});

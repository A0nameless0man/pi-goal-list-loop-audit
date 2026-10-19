import { test } from "node:test";
import assert from "node:assert/strict";
import { missingPackagedMarkdownLinks } from "../scripts/packaged-markdown-links.mjs";

test("new shipped pages are checked automatically, including reference links", () => {
  const pages = new Map([
    ["README.md", "[guide](docs/new.md)"],
    ["docs/new.md", "[missing](../audit/proof.json) [evidence][proof]\n\n[proof]: ../audit/other.md"],
  ]);
  assert.deepEqual(missingPackagedMarkdownLinks(pages.keys(), file => pages.get(file)!), [
    { document: "docs/new.md", target: "../audit/proof.json", resolved: "audit/proof.json" },
    { document: "docs/new.md", target: "../audit/other.md", resolved: "audit/other.md" },
  ]);
});

test("links support directories, fragments, external targets and code examples", () => {
  const pages = new Map([
    ["docs/page.md", "[root](../README.md#intro) [dir](../examples/) [space](<../examples/a b.md>) [remote](https://example.com) [here](#intro) `illustration [label](url)`\n```md\n[example](missing.md)\n```"],
    ["README.md", ""], ["examples/a b.md", ""],
  ]);
  assert.deepEqual(missingPackagedMarkdownLinks(pages.keys(), file => pages.get(file)!), []);
});

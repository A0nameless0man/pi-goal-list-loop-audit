// Run from the repository: node audit/project-review-2026-10-19/scan-package-links.mjs
// Read-only pack inspection; this intentionally reports rather than repairs links.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const [pack] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"],
}));
const shipped = new Set(pack.files.map(file => file.path));
const broken = [];
for (const file of pack.files.filter(file => file.path.endsWith(".md"))) {
  // Ignore illustrative links in code. This is an inline-link survey, not a
  // complete CommonMark parser (reference-style links and anchors need a fuller gate).
  const prose = fs.readFileSync(file.path, "utf8")
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
  for (const match of prose.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), target));
    if (!shipped.has(resolved) && ![...shipped].some(candidate => candidate.startsWith(resolved.replace(/\/$/, "") + "/"))) {
      broken.push({ from: file.path, target: resolved, existsInRepo: fs.existsSync(resolved) });
    }
  }
}
console.log(JSON.stringify({ files: pack.files.length, unpackedBytes: pack.unpackedSize, compressedBytes: pack.size, broken }, null, 2));

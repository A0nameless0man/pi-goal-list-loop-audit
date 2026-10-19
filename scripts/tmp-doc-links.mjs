// TEMP — documentation link + index completeness checker (not a committed test)
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIRS = ["", "docs", "prompts", "skills", "examples", "audit"];

function walk(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      out.push(...walk(childRel));
    } else if (entry.name.endsWith(".md")) {
      out.push(childRel);
    }
  }
  return out;
}

const files = DIRS.flatMap(walk);
const broken = [];
let checked = 0;

for (const file of files) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  // inline markdown links: [text](target)
  for (const m of src.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    checked++;
    const clean = target.split("#")[0];
    if (!clean) continue;
    const resolved = path.resolve(ROOT, path.dirname(file), clean);
    if (!fs.existsSync(resolved)) {
      broken.push(`${file}: [${target}] -> missing ${path.relative(ROOT, resolved)}`);
    }
  }
}

console.log(`scanned ${files.length} markdown files, ${checked} relative links`);
if (broken.length) {
  console.log(`\nBROKEN RELATIVE LINKS (${broken.length}):`);
  for (const b of broken) console.log("  " + b);
} else {
  console.log("\nno broken relative links");
}

// ---- index completeness: does docs/INDEX.md link every shipped doc? ----
const shipped = fs.readdirSync(path.join(ROOT, "docs")).filter((f) => f.endsWith(".md") && f !== "INDEX.md");
const indexSrc = fs.readFileSync(path.join(ROOT, "docs/INDEX.md"), "utf8");
const unlinked = shipped.filter((f) => !indexSrc.includes(f));
console.log(`\nshipped docs: ${shipped.length}; NOT linked from docs/INDEX.md: ${unlinked.length ? unlinked.join(", ") : "none"}`);

// ---- root docs not linked from the index either ----
const rootDocs = ["README.md", "INSTALL.md", "PLAN.md", "LIST-PHILOSOPHY.md", "CHANGELOG.md", "AGENTS.md"];
console.log(`root docs not linked from docs/INDEX.md: ${rootDocs.filter((f) => !indexSrc.includes(f)).join(", ") || "none"}`);

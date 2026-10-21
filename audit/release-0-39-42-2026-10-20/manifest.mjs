// Hash manifest of the source/test/shipped-document tree, computed from a git
// ref rather than the working directory, so the gated tree and the tagged tree
// are compared against the same definition.
//
//   node audit/release-0-39-40-2026-10-20/manifest.mjs <ref>
//
// The audit/ tree and machine-local .pi-glla/ runtime state are deliberately
// OUT of scope: audit records are evidence about a release, not part of the
// released artifact, and they are added after the gate by construction.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ref = process.argv[2];
if (!ref) {
	console.error("usage: node manifest.mjs <git-ref>");
	process.exit(2);
}

const PATHS = [
	"extensions",
	"scripts",
	"tests",
	"prompts",
	"schemas",
	"docs",
	"skills",
	"examples",
	"media",
	"package.json",
	"package-lock.json",
	"CHANGELOG.md",
	"README.md",
	"INSTALL.md",
	"PLAN.md",
	"LIST-PHILOSOPHY.md",
	"LICENSE",
	".github/workflows/publish.yml",
];

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const names = git("ls-tree", "-r", "--name-only", ref, "--", ...PATHS)
	.split("\n")
	.map((l) => l.trim())
	.filter(Boolean)
	.sort();

const files = {};
for (const name of names) {
	const blob = execFileSync("git", ["show", `${ref}:${name}`], { maxBuffer: 64 * 1024 * 1024 });
	files[name] = createHash("sha256").update(blob).digest("hex");
}

const aggregate = createHash("sha256")
	.update(names.map((n) => `${n} ${files[n]}`).join("\n"))
	.digest("hex");

console.log(JSON.stringify({ ref, fileCount: names.length, aggregate, files }, null, 2));

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadSkills } from "@earendil-works/pi-coding-agent";
import { packReportFiles } from "../scripts/npm-pack-report.mjs";
import { missingPackagedMarkdownLinks } from "../scripts/packaged-markdown-links.mjs";
import { scaledBudgetMs } from "../scripts/host-contention.mjs";

function dryRunFiles(): Set<string> {
  const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf-8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Transport-shape parsing lives in scripts/npm-pack-report.mjs, shared
  // with the smoke lane so both lanes read the same npm version alike.
  return new Set(packReportFiles(JSON.parse(raw) as unknown));
}

test("release contract: published documentation links are covered by the npm tarball", { timeout: scaledBudgetMs(60_000) }, () => {
  const files = dryRunFiles();
  for (const required of ["README.md", "INSTALL.md", "PLAN.md", "LIST-PHILOSOPHY.md", "CHANGELOG.md", "docs/INDEX.md", "docs/SETTINGS.md", "media/glla2.png", "examples/example-objective.md", "scripts/release-pack-smoke.mjs", "skills/glla-delegate/SKILL.md"]) {
    assert.ok(files.has(required), `${required} must be shipped`);
  }
  assert.deepEqual(missingPackagedMarkdownLinks(files, document => fs.readFileSync(document, "utf8")), [],
    "every shipped Markdown page must navigate to packaged files or explicit external evidence");
});

test("release contract: the release gate exercises the packed artifact", () => {
  const packageJson = fs.readFileSync("package.json", "utf-8");
  assert.match(packageJson, /release:check[\s\S]*release-pack-smoke\.mjs/);
  assert.match(fs.readFileSync("scripts/release-pack-smoke.mjs", "utf-8"), /npm pack/);
  assert.match(fs.readFileSync("scripts/release-pack-smoke.mjs", "utf-8"), /goal\.ts/);
  assert.match(fs.readFileSync("scripts/release-pack-smoke.mjs", "utf-8"), /loadSkills\(/);
  const smoke = fs.readFileSync("scripts/release-pack-smoke.mjs", "utf-8");
  assert.match(smoke, /installedPackage/);
  assert.match(smoke, /packedLauncher/);
  assert.match(smoke, /workerPath/);
  assert.match(smoke, /result\.json/);
  assert.match(smoke, /detached:\s*true/, "the direct worker probe must isolate its process group");
  assert.doesNotMatch(smoke, /legacy-peer-deps/, "the smoke must not skip declared peer resolution");
  assert.doesNotMatch(smoke, /alias\s*:/, "the smoke must not alias peers back to the source tree");
  assert.match(smoke, /cwd: workerProbe/, "the probe request runs in the disposable probe directory");
  assert.doesNotMatch(smoke, /attemptId,\n    cwd: repoRoot/, "the probe request must never point at the live checkout");
  assert.match(smoke, /auditorEnvAllowlistFor/, "the probe request carries the fenced env allowlist built by the packed tree");
});

test("release contract: packed prompts, schema, and workers ship in the dry-run list", { timeout: scaledBudgetMs(60_000) }, () => {
  const files = dryRunFiles();
  for (const required of [
    "scripts/goal-compactor-worker.mjs",
    "scripts/durable-wait.mjs",
    "prompts/goal-loop-continuation.md",
    "prompts/goal-loop-draft.md",
    "prompts/goal-loop-forever-draft.md",
    "prompts/goal-loop-forever-metricless.md",
    "prompts/goal-loop-forever.md",
    "prompts/goal-loop-plan-loop.md",
    "prompts/goal-loop-plan.md",
    "prompts/goal-loop-respec-builder.md",
    "prompts/goal-loop-respec-draft.md",
    "schemas/goal.schema.json",
  ]) {
    assert.ok(files.has(required), `${required} must be shipped`);
  }
});

test("release contract: changed tests ride the hardened runner", { timeout: scaledBudgetMs(60_000) }, () => {
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf-8")) as { scripts?: Record<string, string> };
  const changed = manifest.scripts?.["test:changed"] ?? "";
  assert.match(changed, /scripts\/run-tests\.mjs/, "test:changed must route through the hardened runner");
  assert.match(changed, /--changed/, "test:changed must keep the changed-file filter");
  assert.doesNotMatch(changed, /bun test/, "test:changed must not invoke bare bun test");
  assert.ok(dryRunFiles().has("scripts/run-tests.mjs"), "the hardened runner must ship in the tarball");
});

test("release contract: the release lane refuses an unreviewed tag and the canary never runs dispatched code with provider keys", () => {
  // v0.39.45 (audit 2026-10-22): the publish lane compared the tag STRING
  // with package.json only, so any commit could be published under a
  // matching tag (docs/RELEASING.md requires the reviewed source). The
  // canary handed provider API keys to whatever ref was dispatched.
  const publish = fs.readFileSync(".github/workflows/publish.yml", "utf-8");
  assert.match(publish, /merge-base --is-ancestor/, "the publish lane must check the tag is reachable from the default branch");
  assert.match(publish, /Verify the tag points at reviewed source/);
  const canary = fs.readFileSync(".github/workflows/real-host-canary.yml", "utf-8");
  // github.default_branch is NOT a GitHub context property: it resolves
  // empty and checkout then falls back to the dispatch-selected ref.
  const pinsDefaultBranch = (workflow: string) =>
    /^\s*ref:\s*\$\{\{\s*github\.event\.repository\.default_branch\s*\}\}\s*$/m.test(workflow);
  assert.ok(pinsDefaultBranch(canary),
    "the canary must use the repository event's default branch, never a dispatched ref");
  assert.ok(pinsDefaultBranch(canary.replace("${{ github.event.repository.default_branch }}", "${{github.event.repository.default_branch}}")),
    "harmless expression whitespace must not invalidate the fence");
  assert.equal(pinsDefaultBranch(canary.replace("github.event.repository.default_branch", "github.default_branch")), false,
    "an undefined context property must not masquerade as a default-branch fence");
  assert.match(canary, /OPENAI_API_KEY/);
});

test("release contract: the shipped runner's import graph resolves inside the package", { timeout: scaledBudgetMs(60_000) }, () => {
  // v0.39.45 (audit 2026-10-22): the runner shipped while the module it
  // imported (tests/slow-files.mjs) did not, so the packaged runner could
  // not be imported at all (ERR_MODULE_NOT_FOUND) — and the gate certified
  // that it ships. Presence is not loadability: every relative import of a
  // SHIPPED script must resolve to a file the package also ships.
  const files = dryRunFiles();
  const shipped = [...files].filter((file) => file.endsWith(".mjs") && !file.includes("node_modules"));
  for (const file of shipped) {
    const source = fs.readFileSync(file, "utf-8");
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]!));
      assert.ok(files.has(target), `${file} imports ${match[1]}, which the package does not ship (${target})`);
    }
  }
  assert.ok(files.has("scripts/slow-files.mjs"), "the runner's slow-file policy must ship beside it");
  assert.match(fs.readFileSync("scripts/release-pack-smoke.mjs", "utf-8"), /scripts\/run-tests\.mjs/,
    "the pack smoke must import the installed runner, not only list it");
});

test("release contract: glla-delegate skill loads without diagnostics (source-tree fast tier)", () => {
  // Audit 2026-09-13: this is the fast source-tree tier only. The packed-
  // tarball tier lives in scripts/release-pack-smoke.mjs (loadSkills
  // against the installed tree) — the pin below keeps the two linked.
  const result = loadSkills({
    cwd: process.cwd(),
    agentDir: process.cwd(),
    skillPaths: ["skills/glla-delegate"],
    includeDefaults: false,
  });
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.skills.some((skill) => skill.name === "glla-delegate"), "glla-delegate must be discoverable by Pi");
});

test("release contract: docs index tracks the package version", () => {
  const version = (JSON.parse(fs.readFileSync("package.json", "utf-8")) as { version: string }).version;
  const index = fs.readFileSync("docs/INDEX.md", "utf-8");
  // v0.39.40 (docs review): this used to assert the literal `v0.35.14–v<version>`
  // in the index, which pinned the START of the changelog trail to a hardcoded
  // release — and that trail's start was wrong (the changelog records back to
  // v0.1.0-alpha.1, not v0.35.14). The contract this test actually declares is
  // "the active-focus trail must reach the current package version", so the
  // test now asserts exactly that. The trail's endpoints are pinned against
  // CHANGELOG.md itself by tests/doc-parity.test.ts, which is stronger than a
  // frozen literal.
  assert.match(
    index,
    new RegExp(`\\bv${version.replaceAll(".", "\\.")}\\b`),
    "the active-focus trail must reach the current package version",
  );
});

test("release contract: package is discoverable as a Pi extension and skill", { timeout: scaledBudgetMs(60_000) }, () => {
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf-8")) as {
    keywords?: string[];
    pi?: { extensions?: string[]; skills?: string[]; image?: string };
  };
  assert.ok(manifest.keywords?.includes("pi-package"), "pi-package makes the release eligible for the Pi gallery");
  assert.deepEqual(manifest.pi?.extensions, ["extensions/loops/goal.ts"]);
  assert.deepEqual(manifest.pi?.skills, ["skills/glla-delegate"]);
  // v0.38.99: the gallery image is derived from the manifest instead of a
  // pinned filename — commit 917949e7 repointed `pi.image` at the new
  // thumbnail and this test kept asserting the old one, so the release gate
  // went red for a rename. The contract that actually matters is stronger
  // than the filename: the URL must be the raw gallery form, the file it
  // names must exist, be a real image (not a placeholder), and SHIP in the
  // tarball (a manifest pointing at an unshipped file breaks the gallery).
  const imageUrl = manifest.pi?.image ?? "";
  assert.match(imageUrl, /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/(?:main|master)\/media\/[A-Za-z0-9._-]+\.png$/, `the gallery image must be the raw main-branch media URL: ${imageUrl}`);
  const imagePath = imageUrl.replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/(?:main|master)\//, "");
  assert.ok(fs.existsSync(imagePath), `${imagePath} must exist in the repository`);
  assert.ok(fs.statSync(imagePath).size > 10_000, `${imagePath} must be a real image, not a placeholder`);
  assert.ok(dryRunFiles().has(imagePath), `${imagePath} must ship in the npm tarball`);
});

test("release contract: README package contents claim matches the files allowlist", { timeout: scaledBudgetMs(60_000) }, () => {
  const readme = fs.readFileSync("README.md", "utf-8");
  assert.match(readme, /full test suite remains\s+repository material/);
  assert.doesNotMatch(readme, /and the full test suite\. `audit/);
  assert.equal([...dryRunFiles()].some((file) => file === "tests" || file.startsWith("tests/")), false, "tests remain repository-only material");
});

test("release contract: first-use README guidance matches current behavior", () => {
  const readme = fs.readFileSync("README.md", "utf-8");
  assert.match(readme, /State root.*workingDir.*sessionDir/s);
  assert.match(readme, /propose_task_list/);
  assert.match(readme, /`\/list resume`/);
  assert.match(readme, /npm run release:check/);
  assert.doesNotMatch(readme, /Expected output at v0\.35\.3/);
  assert.doesNotMatch(readme, /cargo test/);
});

test("release contract: smoke waits use durable or literal transition markers", () => {
  const smoke = fs.readFileSync("scripts/smoke.sh", "utf-8");
  assert.match(smoke, /wait_for\(\) \{ # wait_for <literal marker>/);
  assert.match(smoke, /grep -Fq -- "\$pat"/);
  assert.match(smoke, /ledger_has '\"approved\":true'/);
  assert.doesNotMatch(smoke, /wait_for "\?"/);
  assert.doesNotMatch(smoke, /wait_for "Yes"/);
});

test("release workflow scopes trusted-publishing OIDC to the publish job", () => {
  const workflow = fs.readFileSync(".github/workflows/publish.yml", "utf-8");
  const jobsAt = workflow.indexOf("jobs:\n");
  assert.ok(jobsAt > 0, "publish workflow has a jobs section");
  const globalPermissions = workflow.slice(0, jobsAt);
  assert.doesNotMatch(globalPermissions, /id-token:\s*write/, "quality must not inherit publish OIDC permission");
  const qualityAt = workflow.indexOf("  quality:", jobsAt);
  const publishAt = workflow.indexOf("  publish:", qualityAt);
  assert.ok(qualityAt > jobsAt && publishAt > qualityAt, "quality and publish jobs are present");
  assert.doesNotMatch(workflow.slice(qualityAt, publishAt), /id-token:\s*write/, "quality has no OIDC permission");
  assert.match(workflow.slice(publishAt), /permissions:\n\s+contents: read\n\s+id-token: write/, "publish retains trusted publishing OIDC");
});

test("v0.38.32: release runs never share the push-churn concurrency group", () => {
  // Field: v0.38.28/.30/.31/.32 release runs died with zero jobs — the
  // run-level group pooled release events with per-push quality churn and
  // GitHub supersede-cancels queued-never-started runs when a newer run
  // enters the group. The run-level group must key on the event.
  const workflow = fs.readFileSync(".github/workflows/publish.yml", "utf-8");
  const runConcurrency = workflow.slice(0, workflow.indexOf("jobs:\n"));
  assert.doesNotMatch(runConcurrency, /^\s*group: glla-quality\s*$/m, "no shared static run-level group");
  assert.match(runConcurrency, /github\.event_name == 'release'/, "run-level group keys on the event");
});

test("release contract: changelog has one heading for the current package version", () => {
  const version = (JSON.parse(fs.readFileSync("package.json", "utf-8")) as { version: string }).version;
  const changelog = fs.readFileSync("CHANGELOG.md", "utf-8");
  const headings = changelog.split(/\r?\n/).filter((line) => line.startsWith(`## ${version} `));
  assert.equal(headings.length, 1, `${version} release notes must have one unambiguous heading`);
});

test("release contract: untagged source work has an Unreleased changelog section to promote", () => {
  const version = (JSON.parse(fs.readFileSync("package.json", "utf-8")) as { version: string }).version;
  const [major, minor, patch] = version.split(".").map(Number) as [number, number, number];
  const rank = (m: number, n: number, p: number): number => m * 1_000_000 + n * 1_000 + p;
  const current = rank(major, minor, patch);
  const sources = [
    ...fs.readdirSync("extensions").filter((f) => f.endsWith(".ts")).map((f) => `extensions/${f}`),
    ...fs.readdirSync("extensions/loops").filter((f) => f.endsWith(".ts")).map((f) => `extensions/loops/${f}`),
    ...fs.readdirSync("scripts").filter((f) => f.endsWith(".mjs") || f.endsWith(".mts")).map((f) => `scripts/${f}`),
  ];
  let newest = current;
  let newestAt = "";
  for (const file of sources) {
    const text = fs.readFileSync(file, "utf-8");
    for (const match of text.matchAll(/\bv?(\d+)\.(\d+)\.(\d+)\b/g)) {
      const found = rank(Number(match[1]), Number(match[2]), Number(match[3]));
      // Only the same major.minor line counts: an unrelated pinned
      // dependency version in a comment is not untagged work.
      if (match[1] === String(major) && match[2] === String(minor) && found > newest) {
        newest = found;
        newestAt = `${file}:${match[0]}`;
      }
    }
  }
  const changelog = fs.readFileSync("CHANGELOG.md", "utf-8");
  if (newest > current) {
    assert.ok(
      changelog.includes("## Unreleased"),
      `source carries untagged work newer than ${version} (${newestAt}) but CHANGELOG.md has no '## Unreleased' section for the release commit to promote`,
    );
  }
  assert.equal(
    changelog.split(/\r?\n/).filter((line) => line.startsWith("## Unreleased")).length,
    1,
    "there is exactly one Unreleased section to rename",
  );
});

test("v0.39.38: every release-check lane uploads its $TMPDIR failure diagnostics", () => {
  const workflow = fs.readFileSync(".github/workflows/publish.yml", "utf-8");
  const jobsAt = workflow.indexOf("jobs:\n");
  const qualityAt = workflow.indexOf("  quality:", jobsAt);
  const publishAt = workflow.indexOf("  publish:", qualityAt);
  assert.ok(qualityAt > jobsAt && publishAt > qualityAt, "quality and publish jobs are present");
  for (const [name, section] of [["quality", workflow.slice(qualityAt, publishAt)], ["publish", workflow.slice(publishAt)]] as const) {
    assert.match(section, /uses:\s*actions\/upload-artifact@v4/, `${name} uploads artifacts`);
    assert.match(section, /if:\s*failure\(\)/, `${name} uploads on failure, not on success`);
    assert.match(section, /runner\.temp.*glla-test-processes-\*/, `${name} collects under runner.temp`);
    assert.match(section, /actions:\s*write/, `${name} grants the upload permission`);
    // Producer (scripts/run-tests.mjs) writes via os.tmpdir(), which ignores
    // RUNNER_TEMP unless TMPDIR is set — the lane must pin os.tmpdir() to
    // runner.temp or the upload collects an empty dir (warn-and-lose).
    for (const variable of ["TMPDIR", "TEMP", "TMP"] as const) {
      assert.match(section, new RegExp(`${variable}: \\$\\{\\{ runner\\.temp \\}\\}`), `${name} pins os.tmpdir() to runner.temp via ${variable}`);
    }
  }
  assert.doesNotMatch(workflow.slice(qualityAt, publishAt), /id-token:\s*write/, "the upload permission does not widen quality OIDC");
});

test("release contract: the declared Pi peer range covers the 1.x line", () => {
  // A peer range that stops at `<0.100.0` tells a Pi 1.x user their install is
  // unsupported, even though the extension API GLLA uses is unchanged — Pi 1.0
  // added only optional render-context fields. The range is the published
  // contract a package manager enforces, so it must cover the current line or
  // it becomes a false compatibility claim in the other direction.
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf-8")) as {
    engines?: { node?: string };
    peerDependencies?: Record<string, string>;
  };
  const peers = manifest.peerDependencies ?? {};
  const piPeers = ["@earendil-works/pi-agent-core", "@earendil-works/pi-ai", "@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"];
  for (const name of piPeers) {
    const range = peers[name];
    assert.ok(range, `${name} must declare a peer range`);
    // A 1.x release must satisfy the range: an upper bound below 1.0 would
    // reject every current Pi.
    assert.match(range, /<(\d+)/, `${name} range must declare an upper bound: ${range}`);
    const upper = Number(/<(\d+)/.exec(range)![1]);
    assert.ok(upper >= 2, `${name} peer range must admit Pi 1.x (upper bound ${upper}.x): ${range}`);
    // The oldest supported boundary must still be declared.
    assert.match(range, />=0\.84\.2/, `${name} must keep the 0.84.2 floor: ${range}`);
  }
  assert.match(peers.typebox ?? "", /<2\.0\.0/, "typebox must admit its 1.4.x line");
  assert.match(manifest.engines?.node ?? "", /22\.19/, "Node floor stays declared");
});

test("release contract: the docs state the supported Pi range and do not contradict it", () => {
  // The complaint that started this: nothing in the user-facing docs said which
  // Pi versions work, and the only range on disk excluded 1.x. Pin the claim
  // where a user actually looks, and make sure the compatibility doc agrees.
  const readme = fs.readFileSync("README.md", "utf-8");
  const compat = fs.readFileSync("docs/COMPATIBILITY.md", "utf-8");
  assert.match(readme, /## Requirements/, "the README must state its requirements");
  assert.match(readme, /Pi `>=0\.84\.2 <2\.0\.0`/, "the README must name the supported Pi range");
  assert.match(compat, /## Supported Pi versions/, "the compatibility doc must have a discoverable section");
  assert.match(compat, /`>=0\.84\.2 <2\.0\.0`/, "the compatibility doc must declare the same range");
  // The two docs must not disagree about the upper bound.
  for (const doc of [readme, compat]) {
    assert.doesNotMatch(doc, /<0\.100\.0/, "no stale 0.x-only upper bound may remain in the docs");
  }
});

test("release contract: the compatibility matrix actually exercises 1.x, not just the range", () => {
  // Declaring `>=0.84.2 <2.0.0` while CI only ever installs 0.x would make the
  // 1.x claim untested. Pin the matrix so a future range widening cannot ship
  // without a lane that installs that line.
  const workflow = fs.readFileSync(".github/workflows/compatibility.yml", "utf-8");
  assert.match(workflow, /pi:\s*\[[^\]]*"1\.\d+\.\d+"/, "the matrix must include a 1.x Pi version");
  assert.match(workflow, /pi:\s*\[[^\]]*"0\.84\.2"/, "the oldest supported boundary must stay in the matrix");
  // Every matrix Pi version needs its own pi-subagents fixture; a missing
  // include silently falls back to npm's peer resolution and can fail the lane
  // for a reason unrelated to GLLA.
  const versions = [...(/pi:\s*\[([^\]]*)\]/.exec(workflow)![1]!.matchAll(/"([^"]+)"/g))].map((m) => m[1]!);
  for (const v of versions) {
    assert.match(workflow, new RegExp(`- pi: "${v.replace(/\./g, "\\.")}"\\s*\\n\\s*subagents:`), `matrix pi ${v} must pin a pi-subagents fixture`);
  }
});

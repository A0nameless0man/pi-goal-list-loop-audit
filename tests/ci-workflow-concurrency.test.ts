// These inspect the repository's declarative workflow contract, not GitHub
// execution. Ignore YAML comment-only lines: explanations are not config.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";

const publish = fs.readFileSync(".github/workflows/publish.yml", "utf-8");
const compat = fs.readFileSync(".github/workflows/compatibility.yml", "utf-8");

function configuration(text: string): string {
  return text.replace(/\r\n/g, "\n").split("\n").filter(line => !/^\s*#/.test(line)).join("\n");
}
function runLevel(text: string): string {
  const config = configuration(text);
  const jobsAt = config.search(/^jobs:\s*$/m);
  assert.ok(jobsAt > 0, "workflow has a jobs section");
  return config.slice(0, jobsAt);
}
function jobSection(text: string, name: string): string {
  const config = configuration(text);
  const jobsAt = config.search(/^jobs:\s*$/m);
  assert.ok(jobsAt > 0, "workflow has a jobs section");
  const jobs = config.slice(jobsAt);
  const match = new RegExp(`^  ${name}:\\s*$`, "m").exec(jobs);
  assert.ok(match, `job ${name} is present`);
  const body = jobs.slice(match.index + match[0].length);
  const next = body.search(/^  [\w-]+:\s*$/m);
  return next < 0 ? body : body.slice(0, next);
}

function assertFailureTempScope(text: string): void {
  for (const name of ['quality', 'publish']) {
    const job = jobSection(text, name);
    const jobEnv = /^    env:[^\n]*(?:\n(?: {6}[^\n]*|[ \t]*))*/m.exec(job)?.[0] ?? '';
    assert.doesNotMatch(jobEnv, /\$\{\{\s*runner\./, `${name}: runner context is invalid in job-level env`);
    const checkStep = job.split(/^      - /m).find(step => /run:\s*npm run release:check/.test(step));
    assert.ok(checkStep, `${name} release-check step exists`);
    for (const key of ['TMPDIR', 'TEMP', 'TMP']) {
      assert.match(checkStep, new RegExp(`${key}:\\s*\\$\\{\\{\\s*runner\\.temp\\s*\\}\\}`), `${name}: ${key} is set on the producer step`);
    }
  }
}

function assertReleaseIsolation(text: string): void {
  const head = runLevel(text);
  assert.match(head, /github\.event_name == 'release'/, "run-level group separates release events");
  assert.match(head, /'glla-publish-run'/, "release events keep an independent lane");
  assert.match(head, /glla-quality-.*github\.ref/, "quality lane is per-ref");
  assert.doesNotMatch(head, /^\s*group: glla-quality\s*$/m, "no shared static run-level group");
  assert.match(head, /cancel-in-progress:\s*\$\{\{\s*github\.event_name != 'release'\s*\}\}/,
    "push churn cannot cancel release at run level");
  const job = jobSection(text, "publish");
  assert.match(job, /group:\s*npm-publish/, "publish has its own lane");
  assert.match(job, /cancel-in-progress:\s*false/, "publish job cannot cancel active publication");
  assert.match(job, /if:\s*github\.event_name == 'release'/, "publish runs only on release");
}
function assertReleaseGates(text: string): void {
  const job = jobSection(text, "publish");
  // Protect the actual tag comparison, not the error message's wording.
  assert.match(job, /process\.env\.RELEASE_TAG\s*!==\s*expected/, "tag must match the expected package version");
  assert.match(job, /const expected\s*=\s*`v\$\{version\}`/, "expected tag derives from package version");
  assert.match(job, /run:\s*npm run release:check/, "release contract remains mandatory");
  assert.match(job, /run:\s*npm publish --provenance --access public/, "provenance publish remains mandatory");
  assert.match(job, /id-token:\s*write/, "publish retains OIDC permission");
}
function assertQuality(text: string): void {
  const quality = jobSection(text, "quality");
  assert.match(quality, /if:\s*github\.event_name == 'push' \|\| github\.event_name == 'pull_request'/,
    "quality runs only on push/PR");
  assert.match(quality, /run:\s*npm run release:check/, "quality runs release checks");
  assert.doesNotMatch(quality, /npm publish/, "quality cannot publish");
  assert.doesNotMatch(quality, /id-token:\s*write/, "quality has no OIDC write permission");
}
function assertCompatibility(text: string): void {
  const config = configuration(text);
  assert.match(runLevel(text), /group:\s*glla-compatibility-\$\{\{\s*github\.ref\s*\}\}/, "compat lane stays per-ref");
  assert.match(runLevel(text), /cancel-in-progress:\s*true/, "compat cancels superseded runs");
  assert.match(config, /os:\s*\[ubuntu-latest, macos-latest, windows-latest\]/, "cross-platform coverage remains");
  assert.match(config, /run:\s*npm run check/, "typecheck remains");
  assert.match(config, /tests\/contained-child-platform\.test\.ts/, "platform behavior remains checked");
  assert.match(config, /repro-jiti-state-split\.test\.mjs/, "host loader remains checked");
  assert.doesNotMatch(config, /github\.event_name == 'release'/, "compat has no release condition");
  assert.doesNotMatch(config, /npm publish/, "compat never publishes");
}

test("release isolation, gates and quality permissions remain configured", () => {
  assertReleaseIsolation(publish);
  assertReleaseGates(publish);
  assertQuality(publish);
  assertFailureTempScope(publish);
  assertCompatibility(compat);
});

test("harmless comment edits, error prose and line endings do not change the contract", () => {
  const comments = "# Historical misconception: newest QUEUED; even with cancel-in-progress:false\n# npm publish / id-token: write are forbidden in quality, not executable here.\n";
  const edited = publish.replace(/^\s*#.*$/gm, "").replace("does not match package.json", "is inconsistent with the package version");
  assertReleaseIsolation(comments + edited.replace(/\n/g, "\r\n"));
  assertReleaseGates(comments + edited);
  assertQuality(edited.replace("  quality:\n", "  quality:\n    # npm publish; id-token: write are not allowed here\n"));
  assertCompatibility(comments + compat.replace(/^\s*#.*$/gm, ""));
  assertFailureTempScope(comments + edited.replace(/\n/g, "\r\n"));
});

for (const [risk, before, after, check] of [
  ["release run cancellation", "cancel-in-progress: ${{ github.event_name != 'release' }}", "cancel-in-progress: true", assertReleaseIsolation],
  ["shared release lane", "'glla-publish-run'", "'glla-quality'", assertReleaseIsolation],
  ["publish job cancellation", "cancel-in-progress: false", "cancel-in-progress: true", assertReleaseIsolation],
  ["release verification removed", "run: npm run release:check", "run: echo skipped", assertReleaseGates],
  ["provenance removed", "npm publish --provenance --access public", "npm publish --access public", assertReleaseGates],
  ["OIDC removed", "id-token: write", "id-token: read", assertReleaseGates],
  ["tag comparison inverted", "process.env.RELEASE_TAG !== expected", "process.env.RELEASE_TAG === expected", assertReleaseGates],
  ["invalid job-level runner context", "    steps:", "    env:\n      TMPDIR: ${{ runner.temp }}\n    steps:", assertFailureTempScope],
] as const) {
  test(`meaningful invalid configuration is rejected: ${risk}`, () => {
    assert.ok(publish.includes(before), "mutation applies to the fixture");
    // replaceAll is needed for the shared quality/publish verification command.
    const invalid = publish.replaceAll(before, after);
    assert.throws(() => check(invalid), { name: "AssertionError" });
  });
}

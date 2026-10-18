// pi-goal-list-loop-audit
// tests/ci-workflow-concurrency.test.ts
//
// v0.39.x (chosen 2026-10-17): cancel superseded push-quality CI runs while
// keeping release publication protected. These pin the workflow CONFIG
// (event-specific cancellation/concurrency, the independent publish lane,
// unchanged release gates) with the same raw-text section-slice style as
// tests/release-contract.test.ts — they assert what the YAML says, not
// GitHub's runtime behavior.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";

const publish = fs.readFileSync(".github/workflows/publish.yml", "utf-8");
const compat = fs.readFileSync(".github/workflows/compatibility.yml", "utf-8");

function runLevel(text: string): string {
  const jobsAt = text.indexOf("jobs:\n");
  assert.ok(jobsAt > 0, "workflow has a jobs section");
  return text.slice(0, jobsAt);
}

function jobSection(text: string, name: string, next: string | null): string {
  const jobsAt = text.indexOf("jobs:\n");
  const start = text.indexOf(`  ${name}:`, jobsAt);
  assert.ok(start > jobsAt, `job ${name} is present`);
  if (next === null) return text.slice(start);
  const end = text.indexOf(`  ${next}:`, start);
  assert.ok(end > start, `job ${next} follows ${name}`);
  return text.slice(start, end);
}

test("run-level concurrency keys the group by event and cancels only non-release runs", () => {
  const head = runLevel(publish);
  // Release events own their lane; push/PR churn shares a per-ref quality lane.
  assert.match(head, /github\.event_name == 'release'/, "run-level group keys on the event");
  assert.match(head, /'glla-publish-run'/, "release events keep the publish-run lane");
  assert.match(head, /glla-quality-.*github\.ref/, "quality lane is per-ref so branches never cross-cancel");
  assert.doesNotMatch(head, /^\s*group: glla-quality\s*$/m, "no shared static run-level group (v0.38.32 regression)");
  // Event-specific cancellation: the cancel flag excludes release, so a
  // daemon push can never cancel an active release publish at run level.
  assert.match(head, /cancel-in-progress:\s*\$\{\{\s*github\.event_name != 'release'\s*\}\}/,
    "run-level cancellation applies to push/PR churn, never to release events");
});

test("quality job keeps its push/PR gate and gains no release trigger", () => {
  const quality = jobSection(publish, "quality", "publish");
  assert.match(quality, /if:\s*github\.event_name == 'push' \|\| github\.event_name == 'pull_request'/,
    "quality still runs only on push/PR");
  assert.match(quality, /run:\s*npm run release:check/, "quality still runs the release contract");
  assert.doesNotMatch(quality, /npm publish/, "quality never publishes");
  assert.doesNotMatch(quality, /id-token:\s*write/, "quality has no publish OIDC permission");
});

test("publish lane stays independent with cancel off and gates unchanged", () => {
  const job = jobSection(publish, "publish", null);
  assert.match(job, /group:\s*npm-publish/, "publish keeps its own lane");
  assert.match(job, /cancel-in-progress:\s*false/, "the publish lane never cancels");
  assert.match(job, /if:\s*github\.event_name == 'release'/, "publish still fires only on release");
  assert.match(job, /RELEASE_TAG.*does not match package\.json/s, "tag-must-match-package.json gate unchanged");
  assert.match(job, /run:\s*npm run release:check/, "publish still runs the release contract before publishing");
  assert.match(job, /run:\s*npm publish --provenance --access public/, "provenance publish unchanged");
  assert.match(job, /id-token:\s*write/, "publish retains trusted-publishing OIDC");
});

test("the inaccurate unlimited-queue premise is gone, corrected in place", () => {
  const head = runLevel(publish);
  assert.doesNotMatch(head, /newest QUEUED/i, "stale newest-queued-run claim removed");
  assert.doesNotMatch(head, /even with cancel-in-progress:false/i, "stale supersede-cancels-queued claim removed");
  assert.match(head, /ONE running and ONE pending/i, "corrected one-running-one-pending premise stated");
});

test("compatibility cancels superseded same-ref churn with gates unchanged", () => {
  const head = runLevel(compat);
  assert.match(head, /group:\s*glla-compatibility-\$\{\{\s*github\.ref\s*\}\}/, "compat lane stays per-ref");
  assert.match(head, /cancel-in-progress:\s*true/, "compat cancels superseded same-ref runs");
  assert.match(compat, /os:\s*\[ubuntu-latest, macos-latest, windows-latest\]/, "3-OS matrix unchanged");
  assert.match(compat, /run:\s*npm run check/, "compat still runs the typecheck gate");
  assert.match(compat, /tests\/contained-child-platform\.test\.ts/, "compat platform-behavior tests unchanged");
  assert.match(compat, /repro-jiti-state-split\.test\.mjs/, "compat host-loader check unchanged");
});

test("no workflow cancels a release publish from push churn", () => {
  // publish.yml: release run-level group has cancel off via the event guard.
  assert.match(runLevel(publish), /github\.event_name != 'release'/, "release excluded from run-level cancellation");
  // The publish job's own lane is cancel-off regardless of the run level.
  assert.match(jobSection(publish, "publish", null), /cancel-in-progress:\s*false/, "publish job lane cancel-off");
  // compatibility.yml has no release trigger at all.
  assert.doesNotMatch(compat, /github\.event_name == 'release'/, "compat never fires on release");
  assert.doesNotMatch(compat, /npm publish/, "compat never publishes");
});

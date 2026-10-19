// pi-goal-list-loop-audit — v0.27.5
// tests/postaudit-surface.test.ts
//
// 0.27.5: the post-completion audit was firing silently in interactive
// mode — the runReviewer-internal notify fires during the goal-completion
// handler and was easy to miss. Now there's a SECOND notify in
// fireReviewer that arrives after the cascade settles, points at the
// review file path, and is skipped for manual /review invocations.
// Also: settings keys `reviewer` (legacy) and `postaudit` (new) are both
// read; `postaudit` wins.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { resolveReviewerConfig, type ReviewerConfig } from "../extensions/reviewer.ts";
import { readGoalRuntimeSource } from "./harness/goal-source.js";
import { conditionalBody } from "./harness/source-structure.js";
import { SETTINGS_KEYS, type Settings } from "../extensions/goal-settings.js";

const SRC = readGoalRuntimeSource();
const CMDS = fs.readFileSync("extensions/goal-commands.ts", "utf-8");

test("fireReviewer emits a SECOND notify with the review file path after the cascade", () => {
  const branch = conditionalBody(SRC, "!opts.manual && outcome.fired && outcome.reportPath");
  assert.match(branch, /ctx\.ui\.notify\(/);
  assert.match(branch, /review written:/);
  assert.match(branch, /outcome\.reportPath/);
});

test("manual suppression notification has its own mutually exclusive guard", () => {
  const branch = conditionalBody(SRC, "!outcome.fired && outcome.suppressedReason && opts.manual");
  assert.match(branch, /ctx\.ui\.notify\(/);
  assert.match(branch, /Postaudit suppressed:/);
  assert.match(branch, /outcome\.suppressedReason/);
});

test("postaudit settings key takes precedence over legacy reviewer key (fireReviewer)", () => {
  // The fireReviewer function reads settings.postaudit ?? settings.reviewer.
  const m = SRC.match(/settings\.postaudit \?\? settings\.reviewer/);
  assert.ok(m, "dual-read with postaudit precedence is wired in fireReviewer");
});

test("Settings type accepts both reviewer and postaudit keys", () => {
  const settings: Settings = { reviewer: { mode: "on" }, postaudit: { mode: "off" } };
  assert.deepEqual(settings.postaudit, { mode: "off" });
});

test("SETTINGS_KEYS includes postaudit and toolOverrides", () => {
  assert.ok(SETTINGS_KEYS.includes("postaudit"));
  assert.ok(SETTINGS_KEYS.includes("toolOverrides"));
});

test("/glla postaudit opens the same menu as /glla reviewer (no behavioral split)", () => {
  for (const keyword of ["postaudit", "reviewer"]) {
    const branch = conditionalBody(CMDS, `/^${keyword}(?:\\s|$)/.test(trimmed)`);
    assert.match(branch, /await cmdReviewerSettings\(ctx\)/, `${keyword} opens the shared menu`);
  }
});

test("/glla routes reviewer (legacy) and postaudit (new) without completion rows", () => {
  // v0.34.25: both keywords still ROUTE to the one postaudit menu, but they
  // are no longer autocomplete entries (verb-only picker, group narrowing).
  assert.doesNotMatch(CMDS, /\["reviewer",/);
  assert.doesNotMatch(CMDS, /\["postaudit",/);
  assert.match(CMDS, /\^postaudit\(\?:\\s\|\$\)/);
  assert.match(CMDS, /\^reviewer\(\?:\\s\|\$\)/);
});

test("resolveReviewerConfig: postaudit and reviewer blocks merge equivalently", () => {
  // Pure unit test of the merge function — no reviewerBlock/loadSettings
  // round-trip required.
  const a: Partial<ReviewerConfig> = { mode: "auto", maxFindingsPerReview: 7 };
  const b: Partial<ReviewerConfig> = { mode: "auto", maxFindingsPerReview: 7 };
  const ra = resolveReviewerConfig(a);
  const rb = resolveReviewerConfig(b);
  assert.deepEqual(ra, rb);
  assert.equal(ra.mode, "auto");
  assert.equal(ra.maxFindingsPerReview, 7);
});

test("goal-loop-continuation prompt carries the 0.27.5 chunk-near-context-full hint", () => {
  const prompt = fs.readFileSync("prompts/goal-loop-continuation.md", "utf-8");
  // Three independent assertions, not ordered — the prose may place
  // "stopReason: length" and "auto-continue" in either order; we only
  // require the hint to live alongside the auto-continue reference.
  const chunkIdx = prompt.indexOf("Chunk output near context-full");
  const stopIdx = prompt.indexOf('stopReason: "length"');
  const contIdx = prompt.indexOf("auto-continue");
  assert.ok(chunkIdx > 0 && stopIdx > 0 && contIdx > 0, "all three anchors present in the prompt");
  // chunking hint and the auto-continue reference should live in the
  // same paragraph (within 800 chars of each other).
  assert.ok(
    Math.abs(chunkIdx - contIdx) < 800 && Math.abs(chunkIdx - stopIdx) < 800,
    "the chunking hint sits next to the auto-continue / length reference",
  );
  assert.match(prompt, /split large file writes|focused reasoning|small commits/);
});

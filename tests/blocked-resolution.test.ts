// pi-goal-list-loop-audit — v0.39.31
// tests/blocked-resolution.test.ts
//
// Regression suite for the Screenshot_20261012_111955 incident:
//   1. A blocked pause whose suggestedAction proposes a verification-
//      contract amendment (the screenshot's "amend item 8 to ... ")
//      is promoted to a decision pause with Accept/Decline options.
//   2. A blocked pause whose proposed command is unsafe (quoted,
//      shell-metacharactered) is NOT promoted; the surface records
//      the unsafe reason for the audit trail.
//   3. The "This operation was aborted" error is classified as a
//      non-recoverable user abort by the main-model classifier.
//   4. `maybeScheduleUnsupervisedErrorRetry` refuses the retry when
//      the goal is paused with `pauseKind: "blocked"` (the explicit
//      user hold the agent issued).
//   5. The mechanical-command allowlist isSafeMechanicalCommand
//      already distinguishes unsafe quoted filters, safe literal
//      arguments, and rejected injection/shell syntax; the tests pin
//      the contract from the verification contract item 2.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contractAmendmentPromotion,
  extractContractAmendment,
  extractSuggestedCommand,
  suggestionAcceptancePromotion,
} from "../extensions/goal-loop-core.js";
import { classifyMainModelFailure } from "../extensions/main-model-recovery.js";
import { isSafeMechanicalCommand } from "../extensions/goal-loop-shield.js";

// =================================================================
// 1. Verification-contract amendment is promoted to a decision.
// =================================================================

const SCREENSHOT_CONTRACT = [
  "1. package compiles with 0 errors",
  "2. lint exits 0",
  "3. full test suite exits 0",
  "4. browser suite exits 0",
  "5. cdp suite passes",
  "6. pin-lock + selftest both pass",
  "7. bench-offer 16 expects pass",
  "8. `bun test src/lib/auditCensus.test.ts -t \"SPEC states the figures the tree produces\"` exits 0",
  "9. assets+generatedAssets 59 pass",
].join("\n");

const SCREENSHOT_SUGGESTED = [
  "The deterministic gate rejects contract item 8's quoted filter `bun test src/lib/auditCensus.test.ts -t \"SPEC states the figures the tree produces\"` (harness policy: single executable + literal args, no quotes).",
  "Fresh evidence on the untouched tree proves everything else is green: check 0 errors, lint 0, full test 3711 pass/0 fail, browser 212 pass/0 fail, cdp 7 pass, pin-lock HELD + selftest PASS, bench-offer 16 expects pass, assets+generatedAssets 59 pass, auditCensus whole file 40 pass AND the exact quoted -t spelling passes (1 test, 122 expects) — the test is fine, only the harness's quote policy blocks.",
  "Proposed one-line amendment to item 8 (same test, quoteless, strictly stronger evidence, verified exit 0 just now): replace the quoted -t command with `bun test src/lib/auditCensus.test.ts`. Apply that amendment and reply 'amended' and I will resume and re-call complete_goal immediately. Tasks are 9/9 complete; no code changes are needed.",
].join(" ");

test("contract amendment extraction names item 8 and the safe proposed command", () => {
  const amendment = extractContractAmendment(SCREENSHOT_SUGGESTED, SCREENSHOT_CONTRACT);
  assert.ok(amendment, "the screenshot-shaped prose must yield an amendment");
  assert.equal(amendment?.itemNumber, 8, "the item number is parsed from the proposal");
  assert.equal(amendment?.command, "bun test src/lib/auditCensus.test.ts", "the LAST backticked command is the proposed quoteless form");
  assert.equal(amendment?.kind, "safe", "the proposed form passes the mechanical-command allowlist");
  assert.match(amendment?.proposedContract ?? "", /^8\. bun test src\/lib\/auditCensus\.test\.ts$/m, "the proposed contract replaces item 8 verbatim");
});

test("contract amendment promotion builds Accept/Decline options on a safe proposal", () => {
  const promotion = contractAmendmentPromotion(SCREENSHOT_SUGGESTED, SCREENSHOT_CONTRACT, "goal");
  assert.ok(promotion, "the safe proposal is promoted");
  assert.equal(promotion?.amendment.itemNumber, 8);
  assert.equal(promotion?.amendment.kind, "safe");
  assert.equal(promotion?.recommended, 1, "the Accept option is recommended");
  assert.equal(promotion?.unattendedDefault, 2, "the unattended default is the decline path, not Accept");
  const options = promotion?.options ?? [];
  assert.equal(options.length, 3, "exactly three options: Accept, Continue without it, Cancel");
  assert.match(options[0] ?? "", /Accept — apply the amendment/);
  assert.match(options[0] ?? "", /replace contract item 8 with `bun test src\/lib\/auditCensus\.test\.ts`/);
  assert.match(options[1] ?? "", /Continue without it \(/);
  assert.match(options[2] ?? "", /Cancel \(/);
});

test("contract amendment extraction is a no-op when no item number is named", () => {
  const prose = "Please run `bun test src/lib/auditCensus.test.ts` to verify the change; tasks 9/9 complete.";
  const amendment = extractContractAmendment(prose, SCREENSHOT_CONTRACT);
  assert.equal(amendment, undefined, "prose without an explicit item N does NOT promote");
});

test("contract amendment extraction flags an unsafe quoted proposal as kind=unsafe", () => {
  const prose = "Amend verification-contract item 8 to the quoted form `bun test src/lib/auditCensus.test.ts -t \"SPEC states the figures the tree produces\"`. The harness policy accepts literal args only.";
  const amendment = extractContractAmendment(prose, SCREENSHOT_CONTRACT);
  assert.ok(amendment, "the proposal IS detected even when unsafe");
  assert.equal(amendment?.kind, "unsafe", "the proposed form contains a quote and the allowlist rejects it");
  assert.ok(amendment?.unsafeReason, "an unsafe reason is recorded for the audit trail");
  const promotion = contractAmendmentPromotion(prose, SCREENSHOT_CONTRACT, "goal");
  assert.equal(promotion, undefined, "an unsafe proposal does NOT promote — the user must hand-fix it first");
});

// =================================================================
// 2. Intentional-abort classification.
// =================================================================

test("'This operation was aborted' is classified as non-recoverable user-abort", () => {
  const failure = classifyMainModelFailure("Error: This operation was aborted");
  assert.equal(failure.kind, "non-recoverable", "the recovery loop must NOT auto-retry after an intentional abort");
  assert.equal(failure.nonRecoverableReason, "user-abort", "the durable reason is the user-abort branch");
});

test("'operation was aborted' (without 'this') is also classified as non-recoverable", () => {
  const failure = classifyMainModelFailure("operation was aborted");
  assert.equal(failure.kind, "non-recoverable");
  assert.equal(failure.nonRecoverableReason, "user-abort");
});

test("the existing 'user abort' / 'cancelled by user' regex still works", () => {
  assert.equal(classifyMainModelFailure("user abort").kind, "non-recoverable");
  assert.equal(classifyMainModelFailure("cancelled by user").kind, "non-recoverable");
  assert.equal(classifyMainModelFailure("user interrupt").kind, "non-recoverable");
});

test("a transient 503 still classifies as transient (regression pin)", () => {
  const failure = classifyMainModelFailure("503 upstream unavailable");
  assert.equal(failure.kind, "transient", "the abort widening does not swallow transient signals");
});

// =================================================================
// 3. Mechanical-command allowlist distinguishes the three categories
//    (verification contract item 1 + 2).
// =================================================================

const UNSAFE_QUOTED = "bun test src/lib/auditCensus.test.ts -t \"SPEC states the figures the tree produces\"";
const SAFE_QUOTELESS = "bun test src/lib/auditCensus.test.ts";
const INJECTION_PIPELINE = "bun test src/lib/auditCensus.test.ts | rm -rf /";
const INJECTION_SEMICOLON = "bun test; printf boom";
const INJECTION_BACKTICK = "bun test `cat /etc/passwd`";

for (const [label, command, expected] of [
  ["the screenshot's unsafe quoted form", UNSAFE_QUOTED, false],
  ["the screenshot's safe quoteless proposal", SAFE_QUOTELESS, true],
  ["a rejected pipeline injection", INJECTION_PIPELINE, false],
  ["a rejected semicolon injection", INJECTION_SEMICOLON, false],
  ["a rejected backtick injection", INJECTION_BACKTICK, false],
  ["a tail-filter pipeline head is still safe", "bun test src/lib/x.test.ts", true],
  ["a tail-filter with grep is still safe", "grep -q marker src/lib/x.test.ts", true],
  ["a numbered safe command with path is still safe", "node --version", true],
  ["a cd-prefixed path is still safe", "/usr/bin/node --version", true],
] as const) {
  test(`isSafeMechanicalCommand: ${label} → ${expected}`, () => {
    assert.equal(isSafeMechanicalCommand(command), expected);
  });
}

// =================================================================
// 4. No regression to the existing slash-command promotion.
// =================================================================

test("a screenshot-shaped /goal tweak suggestion still extracts to /goal tweak", () => {
  const cmd = extractSuggestedCommand(
    'Run /goal tweak "Restore the original selective automatic Git LFS implementation." This changes scope explicitly.',
  );
  assert.equal(cmd, '/goal tweak "Restore the original selective automatic Git LFS implementation."');
});

test("a /goal resume suggestion still does NOT promote (resume is a decline path)", () => {
  const promotion = suggestionAcceptancePromotion("Then /goal resume retries the parked work.", "goal");
  assert.equal(promotion, undefined);
});

// =================================================================
// 5. The promotion surfaces the unsafe reason in the audit trail.
// =================================================================

test("the unsafe proposal is recorded with its reason for the audit trail", () => {
  const prose = "Amend verification-contract item 8 to the quoted form `bun test src/lib/auditCensus.test.ts -t \"SPEC states the figures the tree produces\"`.";
  const amendment = extractContractAmendment(prose, SCREENSHOT_CONTRACT);
  assert.ok(amendment);
  assert.equal(amendment?.kind, "unsafe");
  // The reason must name the actual rejector — a quote, a metacharacter,
  // or the allowlist — so a reviewer can diagnose without re-running.
  const reason = amendment?.unsafeReason ?? "";
  const named = /quote|shell metacharacter|allowlist/.test(reason);
  assert.ok(named, `unsafe reason must name the rejector: ${reason}`);
});

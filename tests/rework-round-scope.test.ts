// pi-goal-list-loop-audit — v0.39.43
// tests/rework-round-scope.test.ts
//
// What a rework round costs, and what a transient provider blip does to it.
//
// Field 2026-10-20/21 (browser-extensions-shared/clean-web, eve,
// youtube-filter): the final audit kept re-running the project's WHOLE
// verification — its browser-test harness, its full test run — and each
// round was then destroyed by a transient provider blip ("Provider returned an
// empty response"). The auditor lane had no rule for that string, so it fell
// to "no-verdict" — the one auditor failure class with NO identical-failure
// brake: the claim parked and a FRESH full audit round started immediately.
// The loop re-paid the whole cost every time, the projects' test suites
// churned, and the host saturated, which made the next blip more likely.
//
// These tests pin the contracts the fix rests on:
//   1. a rework round verifies the OPEN OBJECTIONS, not the whole change;
//   2. a round that lost a tool call at its budget still ends with a verdict;
//   3. the two parallel dispatch branches agree on all of it;
// plus the classification that broke the loop: an empty provider response is
// a transient provider failure, not a missing verdict.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildGoalAuditorPrompt, isReworkRound } from "../extensions/goal-loop-auditor.js";
import { validateCompletedAuditorResult } from "../extensions/goal-loop-auditor-process.js";
import { buildChallengePrompt, buildContinuationPrompt, REWORK_SCOPE_RULES } from "../scripts/auditor-round-prompts.mjs";
import type { Goal } from "../extensions/goal-loop-core.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

/** A goal whose claim was disapproved once — the rework-round shape. */
function goalWith(entries: Array<Record<string, unknown>>): Goal {
  return {
    id: "g", objective: "ship the change", verificationContract: "Done when:\n- the fix lands",
    status: "active", policy: "goal", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    usage: { tokensUsed: 0, tokensLimit: 0 }, auditHistory: entries,
  } as unknown as Goal;
}

const DISAPPROVED = { at: "2026-10-20T00:00:00.000Z", disapproved: true, output: "gap: the marker crashes\n<disapproved/>" };
const APPROVED = { at: "2026-10-20T00:00:00.000Z", approved: true, output: "fine\n<approved/>" };

test("a rework round's brief bounds its verification to the open objections", () => {
  const rework = buildGoalAuditorPrompt(goalWith([DISAPPROVED]), "done", "verified");
  assert.match(rework, /REWORK ROUND — this claim was disapproved 1 time before\./);
  for (const rule of REWORK_SCOPE_RULES) {
    assert.ok(rework.includes(rule), `the rework brief carries the scope rule: ${rule.slice(0, 60)}`);
  }
  // The bound must not narrow what may BLOCK: a new defect inside the change
  // still blocks, and the reviewer still has to approve on evidence.
  assert.match(rework, /A genuinely new defect in the change is still valid and still blocks\./);
  assert.match(rework, /every verification-contract item is verified by evidence you personally inspected/);
});

test("a first round carries no rework scope bound", () => {
  const first = buildGoalAuditorPrompt(goalWith([APPROVED]), "done", "verified");
  assert.doesNotMatch(first, /REWORK ROUND —/);
  for (const rule of REWORK_SCOPE_RULES) {
    assert.ok(!first.includes(rule), "a first round is not a rework round");
  }
});

test("the falsification pass of a rework round is scoped to the open objections", () => {
  const brief = buildGoalAuditorPrompt(goalWith([DISAPPROVED]), "done", "verified");
  const rework = buildChallengePrompt(brief, "round 1 report\n<approved/>", true);
  assert.match(rework, /Your primary target is the OPEN OBJECTIONS/);
  assert.match(rework, /do NOT re-run the project's full verification suite/);
  // The pass is still adversarial: scoping the target is not softening it.
  assert.match(rework, /If you find ANY genuine gap between the completion claim and the evidence/);
  assert.match(rework, /your job is to try to prove this one wrong/);
});

test("a first round's falsification pass keeps its full breadth", () => {
  const brief = buildGoalAuditorPrompt(goalWith([APPROVED]), "done", "verified");
  const challenge = buildChallengePrompt(brief, "round 1 report\n<approved/>", false);
  assert.doesNotMatch(challenge, /Your primary target is the OPEN OBJECTIONS/);
  assert.match(challenge, /Re-verify the load-bearing claims with your own tool calls/);
});

test("a tool call cancelled at its budget still ends the round with a verdict", () => {
  const brief = buildGoalAuditorPrompt(goalWith([DISAPPROVED]), "done", "verified");
  const continuation = buildContinuationPrompt({
    originalPrompt: brief,
    completedToolCalls: [{ name: "bash", argsPrefix: '{"command":"ls scripts/browser-test"}' }],
    cancelled: { name: "bash", argsPrefix: '{"command":"node scripts/browser-test/launch.mjs"}' },
    timeoutLabel: "5m",
  });
  // The cancelled call produced no result: it is UNKNOWN, not a failed check.
  assert.match(continuation, /Treat that specific piece of verification as UNKNOWN/);
  // Everything else stands, and the round must not start over.
  assert.match(continuation, /Everything else you already established stands\. Do not restart the whole audit from scratch\./);
  // And the round still owes a verdict — this is what stops a cancelled tool
  // from costing a whole round (and the host) a second time.
  assert.match(continuation, /End with a single final line exactly: <approved\/> or <disapproved\/>/);
  assert.match(continuation, /cancelled after 5m/);
  assert.match(continuation, /node scripts\/browser-test\/launch\.mjs/, "the cancelled call is named so the auditor can re-run it cheaply");
});

test("an empty provider response is a transient provider failure, not a missing verdict", () => {
  // The main lane has classified this string as transient since v0.38.104
  // (field 2026-09-27: seven empty responses parked our own repo goal for
  // 300m on the blind wall ladder). The auditor lane had no such rule, so the
  // same blip took the no-verdict path — the one path with no
  // identical-failure brake — and re-ran the whole audit.
  const goal = { id: "g", verificationContract: "" } as unknown as Goal;
  const classified = (error: string) => validateCompletedAuditorResult({
    result: {
      protocolVersion: 1, attemptId: "a", requestHash: "h", ok: false,
      output: "", model: "m", thinkingLevel: "low", toolCalls: [], error,
    },
    goal, model: "m", thinkingLevel: "low", strictChallenge: false,
    startedAt: Date.now() - 1000, nowMs: Date.now(),
    reportStall: () => {},
  }).infrastructureClass;

  assert.equal(classified("Provider returned an empty response"), "provider",
    "an empty provider response is a transient provider failure");
  assert.equal(classified("RPC stream failed: 503 upstream"), "provider");
  // LOCAL failures keep the no-verdict treatment: a dead worker, a missing
  // marker and a malformed result are not provider blips, and they must not
  // be pushed onto the provider ladder.
  assert.equal(classified("auditor produced no verdict marker"), "no-verdict");
  assert.equal(classified("auditor worker exited without an atomic result"), "no-verdict");
  assert.equal(classified("auditor produced no output"), "no-verdict");
});

test("the no-verdict recovery branch is gated on the failure class, so a provider blip cannot enter it", () => {
  // The branch that parks the claim and re-dispatches a FRESH full audit
  // round takes exactly the no-verdict / timeout / transport classes. A
  // provider-class failure must not reach it — that branch is the loop.
  const hooks = fs.readFileSync(path.join(ROOT, "extensions", "loops", "goal-auditor-hooks.ts"), "utf8");
  const branch = hooks.slice(
    hooks.indexOf("function isAuditorNoVerdictInfrastructureError"),
    hooks.indexOf("function isAuditorNoVerdictInfrastructureError") + 1200,
  );
  assert.match(branch, /infrastructureClass === "no-verdict"/);
  assert.match(branch, /infrastructureClass === "timeout"/);
  assert.match(branch, /infrastructureClass === "transport"/);
  assert.doesNotMatch(branch, /infrastructureClass === "provider"/,
    "a provider-class failure never enters the no-verdict recovery branch");
});

test("both dispatch branches agree on what a rework round is", () => {
  // The two parallel dispatch paths (the stored-claim retry and the
  // complete_goal path) have drifted before. They must derive the rework
  // flag from ONE shared predicate, and the predicate must be a pure
  // function of the goal's own audit history.
  for (const rel of ["extensions/loops/goal-auditor-hooks.ts", "extensions/loops/goal-tools.ts"]) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.match(src, /isReworkRound\(auditGoal\) \? \{ reworkRound: true \} : \{\}/,
      `${rel} passes the shared rework-round flag`);
    assert.match(src, /import \{ isReworkRound \} from "\.\.\/goal-loop-auditor\.js";/,
      `${rel} uses the shared predicate, not a local copy`);
  }
  // The predicate itself: a disapproval makes it a rework round, an approval
  // does not, and it is stable for the same goal.
  assert.equal(isReworkRound(goalWith([DISAPPROVED])), true);
  assert.equal(isReworkRound(goalWith([APPROVED])), false);
  assert.equal(isReworkRound(goalWith([APPROVED, DISAPPROVED])), true);
  assert.equal(isReworkRound(goalWith([])), false);
  assert.equal(isReworkRound(undefined), false);
  const goal = goalWith([DISAPPROVED]);
  assert.equal(isReworkRound(goal), isReworkRound(goal), "the same goal gives the same answer");
});

test("the rework flag reaches the worker only on a rework dispatch", () => {
  // The worker scopes the falsification pass from the request flag, so the
  // flag must be present in the request and the worker must read it. It is
  // present ONLY on rework dispatches, so every other request keeps its
  // byte-identical hash.
  const process = fs.readFileSync(path.join(ROOT, "extensions", "goal-loop-auditor-process.ts"), "utf8");
  assert.match(process, /\.\.\.\(args\.reworkRound \? \{ reworkRound: true \} : \{\}\)/);
  const worker = fs.readFileSync(path.join(ROOT, "scripts", "goal-auditor-worker.mjs"), "utf8");
  assert.match(worker, /buildChallengePrompt\(request\.prompt, round1Output, request\.reworkRound === true\)/);
});

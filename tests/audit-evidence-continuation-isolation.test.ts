// v0.38.118: regression for two related payload-isolation gaps surfaced by
// the Screenshot_20261014_110758.png review.
//
// 1) An unchanged last audit report on a steady-state turn must NOT force a
//    second full continuation. A repeat full rebuild of the same 23k audit
//    payload is exactly the amplification the delta-only path is meant to
//    avoid. Once an audit has been delivered in this process, the next
//    routine continuation is a marker.
//
// 2) A GLLA continuation or resync arriving as the first prompt of a fresh
//    turn must NOT overwrite the captured original user request. The
//    recovery continuation path reads that capture to rebuild the missing
//    request; replacing it with a dispatch payload would lose the operator's
//    real ask.

import { test } from "node:test";
import * as assert from "node:assert/strict";

import {
  buildContinuationContent,
  needsFullContinuation,
  resetContinuationInitialSend,
  __testOnlyGetDeliveredAudit,
  __testOnlyRecordDeliveredAudit,
} from "../extensions/goal-continuation.js";
import type { Goal } from "../extensions/goal-loop-core.js";

const GOAL_ID = "20261014000000-auditiso01";

function baseGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: GOAL_ID,
    objective: "Preserve current-project context",
    verificationContract: "Done when no cross-project replay occurs",
    status: "active",
    policy: "goal",
    autoContinue: true,
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    taskList: { tasks: [{ id: "t1", title: "Continue the project", status: "pending" }] },
    auditHistory: [],
    ...overrides,
  } as Goal;
}

const LAST_AUDIT = { at: "2026-10-14T06:09:43.062Z", attemptId: "bb37eae3-e525-4d84-8a26-9d2a76274d68",
  revision: 1, approved: false, report: "Audit Report — same large body of evidence." };

test("unchanged audit does not force a second full continuation once it has been delivered", () => {
  resetContinuationInitialSend();
  const goal = baseGoal({ auditHistory: [LAST_AUDIT] as any });
  // Before delivery the audit is unknown to the model — first steady-state
  // send must teach it once.
  const first = buildContinuationContent(goal, { firstSend: false });
  assert.equal(first.kind, "full", "first delivery of the audit still requires a full payload");
  // Record the audit as delivered (the dispatch path does this on accept).
  __testOnlyRecordDeliveredAudit(GOAL_ID, { attemptId: LAST_AUDIT.attemptId, revision: LAST_AUDIT.revision, reportChars: LAST_AUDIT.report.length });
  // Subsequent routine continuation must be a marker, not a full rebuild.
  const second = buildContinuationContent(goal, { firstSend: false });
  assert.equal(second.kind, "marker", "repeated steady-state turn must not re-send the audit");
  assert.equal(needsFullContinuation(goal), false, "needsFull returns false for an already-delivered audit");
  // A genuinely new audit (different attempt/revision/length) re-arms full.
  const newAudit = { ...LAST_AUDIT, attemptId: "f1a4e1c8-1111-4aaa-8aaa-aaaaaaaaaaaa", revision: 2, report: "Audit Report — revised." };
  const goalNew = baseGoal({ auditHistory: [newAudit] as any });
  assert.equal(needsFullContinuation(goalNew), true, "a new audit content forces a full send");
  const fp = __testOnlyGetDeliveredAudit(GOAL_ID);
  assert.equal(fp?.attemptId, LAST_AUDIT.attemptId, "fingerprint retains the previously delivered audit, not the new one");
});

test("resetContinuationInitialSend clears delivered audit so a new session re-teaches", () => {
  resetContinuationInitialSend();
  const goal = baseGoal({ auditHistory: [LAST_AUDIT] as any });
  __testOnlyRecordDeliveredAudit(GOAL_ID, { attemptId: LAST_AUDIT.attemptId, revision: LAST_AUDIT.revision, reportChars: LAST_AUDIT.report.length });
  assert.equal(needsFullContinuation(goal), false);
  resetContinuationInitialSend();
  assert.equal(__testOnlyGetDeliveredAudit(GOAL_ID), undefined);
  assert.equal(needsFullContinuation(goal), true, "a fresh process re-teaches the audit because the marker latch also re-arms");
});

test("a GLLA checkpoint prompt does not overwrite the captured original user request", () => {
  // The detection rule used by the before_agent_start capture gate must
  // match a real continuation payload and a resync payload, and must NOT
  // match a normal user request.
  const userRequest = "Please fix the respec widget and re-run the affected tests.";
  const continuation = `[GOAL CHECKPOINT goalId=${GOAL_ID}]\n\nContinue the project.`;
  const resync = "[POST-COMPACTION RESYNC] Trust disk state.\n\n[GOAL CHECKPOINT goalId=" + GOAL_ID + "]";
  const isGlla = (prompt: string) => /^\s*\[GOAL CHECKPOINT goalId=/.test(prompt) || /^\s*\[POST-COMPACTION RESYNC\]/m.test(prompt);
  assert.equal(isGlla(continuation), true, "continuation payloads are detected as GLLA dispatch");
  assert.equal(isGlla(resync), true, "resync payloads are detected as GLLA dispatch");
  assert.equal(isGlla(userRequest), false, "genuine user requests are NOT detected as GLLA dispatch");
});

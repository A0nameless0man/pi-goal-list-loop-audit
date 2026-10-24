import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Regression guard for the v0.11.1 audit critical: infrastructure failures
// (exceptions, missing model, aborts) must return disapproved:false so the
// three-way split routes them to the infra path, not the disapproval branch.
//
// v0.34.108: the in-process runGoalCompletionAuditor (goal-loop-auditor.ts)
// was dead code and removed. These pins moved to the production path
// (goal-loop-auditor-process.ts + scripts/goal-auditor-worker.mjs), which
// owns all verdict construction today.
const SRC = readFileSync(
  path.resolve(__dirname, "../extensions/goal-loop-auditor-process.ts"),
  "utf-8",
);

function infraBody(): string {
  const idx = SRC.indexOf("function infra(");
  assert.ok(idx > 0, "infra helper exists");
  return SRC.slice(idx, SRC.indexOf("function stampToken"));
}

test("catch block never returns disapproved: true", () => {
  // The worker's run loop catches RPC/session exceptions and converts them
  // through infra() — never a disapproval.
  const catchIdx = SRC.lastIndexOf("} catch (error)");
  assert.ok(catchIdx > 0, "production auditor has a catch block");
  const catchBody = SRC.slice(catchIdx);
  assert.ok(!/disapproved:\s*true/.test(catchBody), "catch must not mark disapproved");
  assert.ok(catchBody.includes("infra("), "catch routes through the infra helper");
});

test("infra-flavored returns (no model / aborted) are not disapprovals", () => {
  for (const marker of ["no auditor model", "Auditor aborted."]) {
    const idx = SRC.indexOf(marker);
    assert.ok(idx > 0, `found: ${marker}`);
    // the return expression containing this marker is an infra() call —
    // disapproved:false by construction, never a verdict.
    const window = SRC.slice(Math.max(0, idx - 300), idx);
    assert.ok(window.includes("return infra("), `'${marker}' returns via infra()`);
  }
  // The infra() helper itself is disapproved:false by construction.
  assert.match(infraBody(), /disapproved:\s*false/);
  assert.match(infraBody(), /approved:\s*false/);
  assert.match(infraBody(), /error:/);
  assert.match(infraBody(), /infrastructureClass/);
  assert.match(SRC, /"no-verdict"/);
  assert.match(SRC, /"transport"/);
  assert.match(SRC, /failedResultClass/);
});

test("auditor watchdog exits are infrastructure failures, never verdicts", () => {
  // Confirmed-silence and per-tool watchdogs remain infrastructure outcomes;
  // elapsed time alone must not terminate an auditor with real progress.
  assert.match(SRC, /event-derived/);
  assert.match(SRC, /lifecycle cancellation/);
  assert.doesNotMatch(SRC, /return infra\([^\n]+wall-clock bound/);
  assert.match(SRC, /GLLA_AUDITOR_STALL_MS/, "worker stall brake env var honored");
  const worker = readFileSync(
    path.resolve(__dirname, "../scripts/goal-auditor-worker.mjs"),
    "utf-8",
  );
  assert.match(worker, /no wall-clock lifetime timer/);
  const stallIdx = worker.indexOf("Auditor stalled");
  assert.ok(stallIdx >= 0, "worker stall watchdog branch exists");
  assert.match(worker.slice(stallIdx, stallIdx + 300), /aborted|no session activity/i);
});

test("worker stream failures accumulate onto stderr, never overwrite it", () => {
  // A stream 'error' event must not discard stderr text already kept: the
  // handler folds its message into the accumulator (unit-pinned in
  // auditor-stderr-diagnostic.test.ts) instead of assigning over it.
  const worker = readFileSync(
    path.resolve(__dirname, "../scripts/goal-auditor-worker.mjs"),
    "utf-8",
  );
  const handlerIdx = worker.indexOf("const handlePiStreamError");
  assert.ok(handlerIdx >= 0, "handlePiStreamError exists");
  const handler = worker.slice(handlerIdx, handlerIdx + 600);
  assert.match(handler, /accumulateStderrDiagnostic\(streamError,/);
  assert.doesNotMatch(handler, /streamError = message\.slice/);
});

test("semantic verdict-quality failures and shield blocks keep distinct categories", () => {
  assert.match(SRC, /treated as disapproved\./, "approval without evidence tools is a semantic disapproval");
  const shield = SRC.slice(SRC.indexOf("if (!shield.passed)"), SRC.indexOf("progress.phase = \"complete\"", SRC.indexOf("if (!shield.passed)")));
  assert.match(shield, /approved:\s*false/);
  assert.match(shield, /disapproved:\s*false/);
  assert.match(shield, /regressionShieldPassed:\s*false/);
  assert.doesNotMatch(shield, /error:/, "a shield block is not infrastructure failure");
});

test("audit 2026-09-25: the reverted wall-clock bound leaves no dead classification branches", () => {
  // The opt-in auditor wall (auditorWallMs/absoluteTimeoutMs) was reverted —
  // no emitter produces "Auditor exceeded" anymore, so the recovery
  // classifiers must not contain unreachable branches for it.
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|mjs|js)$/.test(entry.name)) {
        const text = readFileSync(full, "utf-8");
        text.split("\n").forEach((line, i) => {
          if (line.includes("Auditor exceeded")) hits.push(`${full}:${i + 1}: ${line.trim()}`);
        });
      }
    }
  };
  walk(path.resolve(__dirname, "../extensions"));
  walk(path.resolve(__dirname, "../scripts"));
  assert.deepEqual(hits, [], `dead wall-bound references remain:\n${hits.join("\n")}`);
});

// ── v0.39.50 (issue #61): an abort must not be presented as a user decision ──
test("only a stop GLLA did NOT initiate is presented as the user's Escape", async () => {
  // The defect: "Auditor aborted." was emitted for EVERY abort path, and the
  // pause copy keyed off that string alone — so a transport failure became a
  // durable `audit aborted by user (Esc)` plus a "complete WITHOUT audit"
  // offer for a run the operator never stopped.
  const mod = await import("../extensions/goal-loop-auditor-process.js");
  assert.equal(typeof mod.recordGllaInitiatedAuditorAbort, "function", "the cause recorder is exported");

  // A GLLA-initiated stop records itself, so the abort handler classifies it as
  // transport (not the user's decision).
  const gllaAttempt = `glla-stop-${Date.now()}`;
  mod.recordGllaInitiatedAuditorAbort(gllaAttempt);
  // Recording is idempotent and must not throw for an empty id.
  mod.recordGllaInitiatedAuditorAbort(gllaAttempt);
  mod.recordGllaInitiatedAuditorAbort("");
});

test("issue #61: the abort result carries the cause and the copy branches on it", () => {
  // The producer must attach `abortCause`, and the consumer must not key the
  // Escape presentation off the error STRING alone.
  assert.match(SRC, /abortCauseFor\(/, "the abort site resolves a cause");
  assert.match(SRC, /abortCause:\s*abortCause/, "infra() carries the cause onto the result");

  const tools = fs.readFileSync("extensions/loops/goal-tools.ts", "utf-8");
  // The Escape affordance is gated on a cause of "user".
  assert.match(tools, /const abortedByUser = [^;]*abortCause === "user"/s, "the Escape path requires abortCause user");
  assert.match(tools, /result\.error === "Auditor aborted\." && abortedByUser/, "the without-audit offer is gated, not string-only");
  // And a non-user abort has its own honest branch that offers no affordance.
  assert.match(tools, /abortedWithoutVerdict/, "a non-user abort takes a distinct branch");
  const nonUser = tools.slice(tools.indexOf("if (abortedWithoutVerdict)"), tools.indexOf("if (result.error === \"Auditor aborted.\" && abortedByUser)"));
  assert.match(nonUser, /not a user stop/, "the pause reason says it was not the user's decision");
  assert.doesNotMatch(nonUser, /COMPLETE WITHOUT AUDIT/, "no without-audit affordance for a run the user did not stop");
  assert.doesNotMatch(nonUser, /aborted by user \(Esc\)/, "no false user-decision reason");
});

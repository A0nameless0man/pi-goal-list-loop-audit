import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { isSessionModelTail, resolveAuditorThinkingLevel, resolveCandidateThinkingLevel } from "../extensions/auditor-thinking.js";
import { stallDecision } from "../scripts/run-tests.mjs";

const model = (over: Record<string, unknown> = {}): any => ({ reasoning: true, ...over });

test("supported requested level is used verbatim", () => {
  assert.equal(resolveAuditorThinkingLevel(model(), "high"), "high");
  // xhigh/max are opt-in per model: absent map support falls to high.
  assert.equal(resolveAuditorThinkingLevel(model(), "max"), "high");
  assert.equal(resolveAuditorThinkingLevel(model({ thinkingLevelMap: { max: "max-output" } }), "max"), "max");
});

test("unsupported xhigh/max fall downwards; mapped nulls are skipped", () => {
  assert.equal(resolveAuditorThinkingLevel(model({ thinkingLevelMap: { xhigh: null, max: null } }), "max"), "high");
  assert.equal(resolveAuditorThinkingLevel(model({ thinkingLevelMap: { high: null } }), "high"), "medium");
  assert.equal(resolveAuditorThinkingLevel(model({ thinkingLevelMap: { max: undefined } }), "max"), "high");
});

test("non-reasoning and unknown requests degrade safely", () => {
  assert.equal(resolveAuditorThinkingLevel(model({ reasoning: false }), "max"), "off");
  assert.equal(resolveAuditorThinkingLevel(undefined, "high"), "off");
  assert.equal(resolveAuditorThinkingLevel(model(), "nonsense"), "high");
});

// v0.39.43: the SESSION model is the auditor's default and its last resort,
// and it runs at the SESSION's own dial. The auditor's configured dial is a
// choice about the CONFIGURED auditor models. Field report 2026-10-21: the
// operator's session was at `max`, the auditor was configured at `xhigh`,
// and the fallback to the session model ran at `xhigh` — the route that has
// to carry the decision was the one deliberately turned down a notch.

test("the session-model tail runs at the session's thinking level, not the auditor's", () => {
  const sessionModel = model({ thinkingLevelMap: { max: "max-output", xhigh: "xhigh-output" } });
  // The session tail, however it was reached.
  for (const via of ["session", "session-fallback"]) {
    const level = resolveCandidateThinkingLevel(
      { via, model: sessionModel },
      { auditorThinkingLevel: "xhigh", sessionThinkingLevel: "max" },
    );
    assert.equal(level, "max", `the ${via} candidate runs at the session's dial`);
  }
  // A CONFIGURED auditor model keeps the configured dial — that override is
  // the user's explicit choice about the models they configured.
  const configured = resolveCandidateThinkingLevel(
    { via: "fallback-pin", model: sessionModel },
    { auditorThinkingLevel: "xhigh", sessionThinkingLevel: "max" },
  );
  assert.equal(configured, "xhigh", "a configured auditor model keeps the configured dial");
  const pinned = resolveCandidateThinkingLevel(
    { via: "setting", model: sessionModel },
    { auditorThinkingLevel: "xhigh", sessionThinkingLevel: "max" },
  );
  assert.equal(pinned, "xhigh", "an explicitly pinned model keeps the configured dial");
});

test("with no configured auditor dial, every candidate inherits the session's dial", () => {
  const sessionModel = model({ thinkingLevelMap: { max: "max-output" } });
  for (const via of ["session", "session-fallback", "setting", "fallback-pin"]) {
    const level = resolveCandidateThinkingLevel(
      { via, model: sessionModel },
      { sessionThinkingLevel: "max" },
    );
    assert.equal(level, "max", `an unset auditor dial inherits the session's dial for ${via}`);
  }
});

test("the session tail's dial is still resolved against what the model supports", () => {
  // The session's dial is honoured as far as the MODEL supports it: a model
  // that does not advertise `max` still falls down, rather than the budget
  // being spent on a level the route cannot run.
  const withoutMax = model({ thinkingLevelMap: { high: "high-output" } });
  const level = resolveCandidateThinkingLevel(
    { via: "session-fallback", model: withoutMax },
    { auditorThinkingLevel: "xhigh", sessionThinkingLevel: "max" },
  );
  assert.equal(level, "high", "the session dial is capped by the model's support, not by the auditor's dial");
  // A non-reasoning session model is off, whatever the dial.
  assert.equal(
    resolveCandidateThinkingLevel(
      { via: "session", model: model({ reasoning: false }) },
      { auditorThinkingLevel: "xhigh", sessionThinkingLevel: "max" },
    ),
    "off",
  );
});

test("the session tail is recognised by how it was reached", () => {
  assert.equal(isSessionModelTail({ via: "session" }), true);
  assert.equal(isSessionModelTail({ via: "session-fallback" }), true);
  assert.equal(isSessionModelTail({ via: "setting" }), false, "an explicit pin is not the implicit tail");
  assert.equal(isSessionModelTail({ via: "fallback-pin" }), false);
  assert.equal(isSessionModelTail(undefined), false);
});

test("all three dispatch branches size the session tail's dial the same way", () => {
  // The completion path, the stored-claim retry path and the project
  // (respec) path each resolve an auditor dial. They have drifted before
  // (the failure strings are produced in parallel branches), so the rule
  // they share is pinned here by source.
  const root = path.resolve(import.meta.dirname, "..");
  for (const rel of [
    "extensions/loops/goal-auditor-hooks.ts",
    "extensions/loops/goal-tools.ts",
  ]) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.match(src, /isSessionModelTail\(candidate\)/, `${rel} applies the session-tail rule`);
    assert.match(src, /sessionThinkingLevel|sessionThinking/, `${rel} resolves the session dial`);
  }
  const respec = fs.readFileSync(path.join(root, "extensions", "respec-builder-runtime.ts"), "utf8");
  assert.match(respec, /resolveCandidateThinkingLevel\(candidate, \{/, "the project lane uses the shared rule");
});

// v0.39.43: the stall watchdog must not kill a run that is merely slow. The
// gate was terminated by a false stall while a legitimate slow test file ran
// (218s of silence against a 195s limit) on a loaded host.
test("the stall watchdog asks whether the host is slow before killing a silent suite", () => {
  const base = 180_000;
  // Not yet silent: wait.
  assert.equal(stallDecision({ silentMs: 10_000, limitMs: base, extensions: 0, factor: 1 }).action, "wait");
  // Silent on a CONTENDED host: extend rather than kill.
  const extended = stallDecision({ silentMs: 200_000, limitMs: base, extensions: 0, factor: 3 });
  assert.equal(extended.action, "extend");
  assert.equal(extended.limitMs, 180_000 * 3, "the window grows with the measured slowdown");
  // The extension is bounded: a wedged suite still dies.
  assert.equal(stallDecision({ silentMs: 200_000, limitMs: base, extensions: 3, factor: 3 }).action, "kill");
  // An IDLE host that goes silent is hung: kill it.
  assert.equal(stallDecision({ silentMs: 200_000, limitMs: base, extensions: 0, factor: 1 }).action, "kill");
  // The window never grows without bound.
  const capped = stallDecision({ silentMs: 900_000, limitMs: base, extensions: 0, factor: 8, maxTimeoutMs: 900_000 });
  assert.equal(capped.action, "extend");
  assert.ok((capped.limitMs ?? 0) <= 900_000, "the extended window is capped");
});

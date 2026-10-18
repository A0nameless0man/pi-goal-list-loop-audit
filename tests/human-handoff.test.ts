import assert from "node:assert/strict";
import test from "node:test";
import { compactHumanSummary, humanCheckTime, humanTextPreview, HUMAN_HANDOFF_GUIDANCE } from "../extensions/human-handoff.js";
import { buildActionReminder, registerActionReminderRenderer } from "../extensions/action-reminder.js";
import { buildTerminalApprovalRender, buildRichArchiveSection } from "../extensions/completion-summary.js";
import { buildUiStatusCard } from "../extensions/goal-loop-display.js";
import { projectUiStatus, uiOwnerKey } from "../extensions/ui-status.js";
import activate from "../extensions/loops/goal.js";
import { MockPi, seedGoal } from "./harness/mock-pi.js";
import type { State } from "../extensions/goal-loop-core.js";

function renderedReminder(reason: string, action?: string, expanded = false) {
  const pi = new MockPi(); registerActionReminderRenderer(pi.api);
  const reminder = buildActionReminder({ kind: "blocked", reason, action, resumeCommand: "/list resume" });
  const component = pi.messageRenderers.get("glla-action-reminder")!({ details: reminder.details, content: reminder.content },
    { outputPad: 1, expanded }, { fg: (_: string, s: string) => s, bg: (_: string, s: string) => s }) as { render(width: number): string[] };
  return { reminder, text: component.render(100).join("\n") };
}

test("football-style wall is a preview with the original report available on expansion", () => {
  const lead = "A human reviewer needs to run the four desktop playtest tasks and record the results.";
  const tail = " Investigation: verifier details, historical paths, passing gates and durable judgments.".repeat(32);
  const reason = lead + tail + " SENTINEL-END";
  const action = "Follow docs/premium/HUMAN-PLAYTEST-QUICKSTART.md, save your observations, then reply here.";
  const collapsed = renderedReminder(reason, action);
  const expanded = renderedReminder(reason, action, true);
  assert.match(collapsed.text, /four desktop playtest tasks/);
  assert.match(collapsed.text, /HUMAN-PLAYTEST-QUICKSTART/);
  assert.match(collapsed.text, /More details/);
  assert.doesNotMatch(collapsed.text, /SENTINEL-END/);
  assert.match(expanded.text, /SENTINEL-END/);
  assert.ok(expanded.text.split("\n").length > collapsed.text.split("\n").length * 2);
  assert.equal(collapsed.reminder.details.reason, reason, "display never truncates the durable report");
  assert.equal(collapsed.reminder.details.action, action);
  // Legacy missing-action cases must not invent playtest steps from arbitrary prose.
  assert.match(renderedReminder(reason).text, /Complete the requirement/);
});

test("a missing completion field never turns telemetry into human changes", () => {
  const goal = seedGoal({ completionSummary: "Outcome: Both panels now show readable field labels. Changed: Labels use the stored question text.",
    telemetry: { turns: 0, fileWrites: 37, bashCalls: 55, files: ["/home/user/project/internal.ts"] } });
  const input = { goal, status: "complete" as const, approval: "— completion audit approved.", record: "— record: saved.md", archivePath: "saved.md", stopReason: "auditor approved" };
  const human = buildTerminalApprovalRender(input).chatLines.join("\n");
  assert.match(human, /Both panels now show readable field labels/);
  assert.match(human, /Labels use the stored question text/);
  assert.doesNotMatch(human, /file-write|bash calls|terminal reason|internal.ts|status=|review the durable/);
  const archive = buildRichArchiveSection(goal, "complete", "saved.md").join("\n");
  assert.match(archive, /file-write/);
  assert.match(archive, /internal.ts/);
});

test("no supplied result means an honest missing explanation, not an invented fix", () => {
  const goal = seedGoal({ objective: "Fix the panels", completionSummary: undefined, telemetry: { turns: 1, fileWrites: 37, bashCalls: 55 } });
  const human = buildTerminalApprovalRender({ goal, status: "complete", approval: "— approved.", record: "— record: saved.md" }).chatLines.join("\n");
  assert.match(human, /plain-language result was not recorded/);
  assert.doesNotMatch(human, /file-write|bash calls|terminal reason|Objective.*archived/);
});

test("compact completion shows primary changes; exact actions and limitations remain intact", () => {
  const action = '- **Next** — Run `verify --target "project with spaces"` after authorization.';
  const limit = '- **Unresolved** — The signed-in flow was not tested; do not assume it works.';
  const full = ["## Done — Field names are readable", "", "What Changed", "**1. Labels**", "- Readable questions replace internal identifiers", "  - implementation.ts:42 and the entire proof", ...Array.from({ length: 9 }, (_, i) => `- Supporting change ${i}`), "Remaining", limit, "Next", action].join("\n");
  const brief = compactHumanSummary(full);
  assert.equal(brief.omitted, true);
  assert.match(brief.content, /Readable questions replace internal identifiers/);
  assert.doesNotMatch(brief.content, /implementation.ts|Supporting change 8|\*\*1\. Labels/);
  assert.ok(brief.content.includes(action));
  assert.ok(brief.content.includes(limit));
  assert.match(brief.content, /expanded message and saved record/);
  assert.ok(full.includes("Supporting change 8"), "input is unchanged");
});

test("compact footer prioritizes the actual action and bounds the repeated reason, detailed status keeps it", () => {
  const reason = "A human playtest is needed. " + "Historical evidence and verifier mechanics. ".repeat(80) + "SENTINEL-END";
  const goal = seedGoal({ status: "paused", pauseKind: "blocked", policy: "list", pauseReason: reason,
    pauseSuggestedAction: "Run the four playtest tasks in HUMAN-PLAYTEST-QUICKSTART.md and report your observations." });
  const state = { goal } as State;
  const now = Date.now();
  const status = projectUiStatus(state, { now, ownerKey: uiOwnerKey(state), generation: 1 });
  const compact = buildUiStatusCard(state, status, now, undefined, 100, true).join("\n");
  const detail = buildUiStatusCard(state, status, now, undefined, 160, false).join("\n");
  assert.match(compact, /next: Run the four playtest tasks/);
  assert.doesNotMatch(compact, /SENTINEL-END/);
  assert.match(compact, /details: \/glla status/);
  assert.match(detail, /SENTINEL-END/);
  assert.ok(compact.indexOf("next:") < compact.indexOf("why:"));
  assert.equal(goal.pauseReason, reason);
});

test("human handoff guidance reaches the real tool registrations", () => {
  const pi = new MockPi(); activate(pi.api);
  for (const name of ["complete_goal", "pause_goal"]) {
    const definition = pi.tools.get(name)!;
    assert.ok(definition.promptGuidelines?.includes(HUMAN_HANDOFF_GUIDANCE), `${name} carries the shared policy`);
  }
});

test("time and preview projections are timezone explicit, safe and honest about abbreviation", () => {
  assert.equal(humanCheckTime("2026-10-18T12:44:36.455+02:00"), "18 Oct 2026, 10:44 UTC");
  assert.equal(humanCheckTime("unknown"), "unknown");
  const value = humanTextPreview("\x1b[2JReadable result. " + "supporting detail ".repeat(100));
  assert.match(value, /Readable result/);
  assert.match(value, /…$/);
  assert.doesNotMatch(value, /\x1b|\n/);
  assert.ok(value.length < 340);
});

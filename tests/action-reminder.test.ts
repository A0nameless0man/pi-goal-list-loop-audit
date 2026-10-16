import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import {
  buildAbortedAssistantNotice,
  buildActionReminder,
  frameTweakSuggestion,
  registerActionReminderRenderer,
  type ActionReminderCopy,
} from "../extensions/action-reminder.js";
import { MockPi } from "./harness/mock-pi.js";

function renderReminder(reminder: ActionReminderCopy, width = 120, dimmed: string[] = []): string {
  const pi = new MockPi();
  registerActionReminderRenderer(pi.api);
  const renderer = pi.messageRenderers.get("glla-action-reminder")!;
  const testTheme = { fg: (color: string, text: string) => { if (color === "dim") dimmed.push(text); return text; }, bg: (_color: string, text: string) => text };
  const component = renderer(
    { customType: "glla-action-reminder", content: reminder.content, display: true, details: reminder.details },
    { expanded: false, outputPad: 1 },
    testTheme as never,
  ) as { render(width: number): string[] };
  return component.render(width).join("\n");
}

test("standby renderer keeps the background-wake explanation visible", () => {
  const text = renderReminder(buildActionReminder({
    kind: "standby",
    reason: "Waiting for the auditor.",
    resumeCommand: "/goal resume",
  }));
  assert.match(text, /GLLA Waiting/);
  assert.match(text, /background completion will wake/);
  assert.match(text, /no manual action is needed/);
  assert.doesNotMatch(text, /this turn stopped/);
  assert.doesNotMatch(text, /Next:/);
});

for (const action of [undefined, "/list resume", "Run '/list resume'.", "`/glla resume`"]) {
  test(`blocked reminder prioritizes prerequisite, not resume-only action (${action})`, () => {
    const reminder = buildActionReminder({
      kind: "blocked", reason: "Complete the $0 checkout and confirm the receipt.",
      action, resumeCommand: "/list resume",
    });
    const dimmed: string[] = [];
    const rendered = renderReminder(reminder, 120, dimmed);
    for (const text of [reminder.content, rendered]) {
      assert.match(text, /Why: Complete the \$0 checkout and confirm the receipt/);
      assert.match(text, /Next: Resolve the prerequisite described above and report the result/);
      assert.match(text, /After the prerequisite is resolved: \/list resume/);
      assert.match(text, /does not resolve the blocker/);
      assert.doesNotMatch(text, /Next: (?:Run )?[`']?\/(?:list|glla) resume/);
      assert.ok(text.indexOf("Why:") < text.indexOf("After the prerequisite"));
    }
    assert.ok(!dimmed.some(text => text.startsWith("Why:") || text.startsWith("After the prerequisite")), "blocker and conditional retry must be readable");
    assert.equal(reminder.details.reason, "Complete the $0 checkout and confirm the receipt.");
  });
}

test("blocked reminder preserves a concrete human action ahead of conditional retry", () => {
  const reminder = buildActionReminder({ kind: "blocked", reason: "Browser authorization is missing.",
    action: "Authorize browser access, then reply here.", resumeCommand: "/goal resume" });
  for (const text of [reminder.content, renderReminder(reminder)]) {
    assert.match(text, /Next: Authorize browser access, then reply here/);
    assert.match(text, /After the prerequisite is resolved: \/goal resume/);
    assert.ok(text.indexOf("Next:") < text.indexOf("After the prerequisite"));
  }
});

test("registers a dedicated GLLA reminder renderer", () => {
  const pi = new MockPi();
  registerActionReminderRenderer(pi.api);
  assert.equal(pi.messageRenderers.has("glla-action-reminder"), true);
});

test("blocked reminder is actionable and says the work is safely parked", () => {
  const reminder = buildActionReminder({
    kind: "blocked",
    reason: "The native browser popup needs a manual observation.",
    action: "Open the popup and record the result.",
    resumeCommand: "/list resume",
  });
  const text = renderReminder(reminder);
  assert.match(text, /GLLA Action needed — work is safely parked/);
  assert.match(text, /Why: The native browser popup/);
  assert.match(text, /Next: Open the popup and record the result/);
  assert.match(text, /Resume: \/list resume/);
  assert.doesNotMatch(text, /Operation aborted/);
  assert.equal(reminder.details.parkState, "stopped");
  assert.equal(reminder.details.safelyParked, true);
});

test("decision reminder is prominent, safely parked, and names the exact picker action", () => {
  const reminder = buildActionReminder({
    kind: "decision",
    reason: "Two valid architectures remain.",
    action: "Choose one in the decision card.",
    resumeCommand: "/list resume",
  });
  const text = renderReminder(reminder);
  assert.match(text, /GLLA Decision needed — work is safely parked/);
  assert.match(text, /Why: Two valid architectures remain/);
  assert.match(text, /Next: Choose one in the decision card/);
  assert.match(text, /Resume: \/list resume/);
  assert.doesNotMatch(text, /Operation aborted/);
  assert.equal(reminder.details.kind, "decision");
  assert.equal(reminder.details.safelyParked, true);
});

test("redirect reminder says the goal is held while the new request runs", () => {
  const reminder = buildActionReminder({
    kind: "blocked",
    reason: "The user redirected the current turn.",
    action: "Handle the new request now: inspect the inbox",
    resumeCommand: "/goal resume",
    parkState: "redirect",
  });
  const text = renderReminder(reminder);
  assert.match(text, /Goal safely parked — handling your new request now/);
  assert.match(text, /Why: The user redirected the current turn/);
  assert.match(text, /Next: Handle the new request now: inspect the inbox/);
  assert.match(text, /saved goal is held while the current turn handles the new request/);
  assert.match(text, /Resume: \/goal resume/);
  assert.doesNotMatch(text, /this turn stopped/);
  assert.equal(reminder.details.parkState, "redirect");
});

test("diagnostics trail the actionable reminder as subordinate text", () => {
  const reminder = buildActionReminder({
    kind: "blocked",
    reason: "A required credential is missing.",
    action: "Configure the credential.",
    resumeCommand: "/goal resume",
    diagnostic: "provider request id=req-42",
  });
  const text = renderReminder(reminder);
  const actionIndex = text.indexOf("Next: Configure the credential.");
  const diagnosticIndex = text.indexOf("Diagnostic: provider request id=req-42");
  assert.ok(actionIndex >= 0, "primary action is visible");
  assert.ok(diagnosticIndex > actionIndex, "diagnostic is rendered after the primary action");
  assert.match(text, /GLLA Action needed — work is safely parked[\s\S]*Why:[\s\S]*Next:/);
});

test("standby reminder says background completion wakes the work", () => {
  const reminder = buildActionReminder({
    kind: "standby",
    reason: "Waiting for the background auditor.",
    resumeCommand: "/goal resume",
  });
  assert.match(reminder.content, /No action is needed/);
  assert.match(reminder.content, /wake/);
  assert.equal(reminder.details.safelyParked, true);
  assert.equal(reminder.details.parkState, "automatic");
});

test("timed wait is automatic and does not invent a manual action", () => {
  const reminder = buildActionReminder({
    kind: "wait",
    reason: "The rate limit resets later.",
    resumeCommand: "/list resume",
    resumeAt: "2026-09-24T23:59:00.000Z",
  });
  const text = renderReminder(reminder);
  assert.match(text, /GLLA Waiting — work is safely parked/);
  assert.match(text, /Assessment check saved for 2026-09-24T23:59:00\.000Z/);
  assert.match(text, /does not prove completion/);
  assert.match(text, /no manual action is needed/);
  assert.doesNotMatch(text, /this turn stopped/);
  assert.doesNotMatch(text, /Next:/);
  assert.doesNotMatch(text, /Resume: \/list resume/);
  assert.equal(reminder.details.safelyParked, true);
  assert.equal(reminder.details.parkState, "automatic");
});

test("assistant abort notice is a GLLA explanation, not generic transport text", () => {
  const notice = buildAbortedAssistantNotice({
    kind: "error",
    reason: "The turn reached its safety boundary.",
    action: "Inspect the saved work, then /goal resume.",
    resumeCommand: "/goal resume",
  });
  assert.match(notice, /GLLA paused this turn safely/);
  assert.match(notice, /Inspect the saved work/);
  assert.doesNotMatch(notice, /Operation aborted/);
});

test("wait abort notice uses the same automatic-wake explanation as its card", () => {
  const notice = buildAbortedAssistantNotice({
    kind: "wait",
    reason: "The rate limit resets later.",
    resumeCommand: "/goal resume",
    resumeAt: "2026-09-24T23:59:00.000Z",
  });
  assert.match(notice, /GLLA paused this turn safely/);
  assert.match(notice, /The rate limit resets later/);
  assert.match(notice, /Assessment check saved for 2026-09-24T23:59:00\.000Z/);
  assert.match(notice, /current registration/);
  assert.doesNotMatch(notice, /Next:/);
  assert.doesNotMatch(notice, /Operation aborted/);
});

test("reminder rendering bounds narrow rows and strips terminal commands", () => {
  const reminder = buildActionReminder({ kind: "blocked", reason: "verify\x1b[2J the result", action: "resume\x9b after checking", diagnostic: "details\x1b[2J", resumeCommand: "/goal resume" });
  const pi = new MockPi(); registerActionReminderRenderer(pi.api);
  const renderer = pi.messageRenderers.get("glla-action-reminder")!;
  const component = renderer({ details: reminder.details, content: reminder.content }, { outputPad: 1 }, { fg: (_: string, s: string) => s, bg: (_: string, s: string) => s }) as { render(width: number): string[] };
  for (const width of [0, 1, 20, 40, 80]) {
    const lines = component.render(width);
    assert.ok(lines.every(line => !/\x1b\[2J|\x9b/.test(line)), "provider/tool text must not clear the terminal");
    assert.ok(lines.every(line => visibleWidth(line) <= width), `reminder fits ${width} columns`);
  }
});

test("tweak suggestions are posed as questions, never imperative orders", () => {
  const reminder = buildActionReminder({
    kind: "blocked",
    reason: "Contract-conflict: the verification command can never reach the auditor.",
    action: `Run '/goal tweak "5. update the contract"'`,
    resumeCommand: "/list resume",
  });
  const text = renderReminder(reminder);
  assert.match(text, /Question: should this tweak be applied\?/);
  assert.match(text, /Run '\/goal tweak "5\. update the contract"'/);
  assert.doesNotMatch(text, /Next: Run/);
  // The exact command survives verbatim for copy-paste.
  assert.ok(text.includes(`Run '/goal tweak "5. update the contract"'`));
});

test("frameTweakSuggestion only fires on tweak commands", () => {
  assert.equal(frameTweakSuggestion("Open the popup and record the result."), undefined);
  assert.equal(frameTweakSuggestion("/goal resume"), undefined);
  assert.equal(frameTweakSuggestion(""), undefined);
  const framed = frameTweakSuggestion(`Run '/list tweak "drop item 3"'`);
  assert.ok(framed?.startsWith("Question: should this tweak be applied?"));
  assert.ok(framed?.includes(`Run '/list tweak "drop item 3"'`));
});

test("non-tweak blocked reminders keep the imperative Next line", () => {
  const reminder = buildActionReminder({
    kind: "blocked",
    reason: "The native browser popup needs a manual observation.",
    action: "Open the popup and record the result.",
    resumeCommand: "/list resume",
  });
  const text = renderReminder(reminder);
  assert.match(text, /Next: Open the popup and record the result/);
  assert.doesNotMatch(text, /Question:/);
});
test("decision reminder rendering agrees with its transcript when no action was supplied", () => {
  const reminder = buildActionReminder({ kind: "decision", reason: "Choose the rollout approach.", resumeCommand: "/goal resume" });
  assert.match(reminder.content, /Choose an option in the decision card/);
  const rendered = renderReminder(reminder);
  assert.match(rendered, /Choose an option in the decision card/);
  assert.doesNotMatch(rendered, /Next: \/goal resume/);
});

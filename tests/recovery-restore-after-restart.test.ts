// pi-goal-list-loop-audit — v0.34.63
// tests/recovery-restore-after-restart.test.ts
//
// The "dead countdown" incident (dracon-platform/web, 2026-08-07):
//   - 01:18:01Z a 429 wall parks the list item into durable recovery
//     (retryAt 01:33:01, attempts 1) and the hourly prompter schedules :00.
//   - 01:18:06Z the user quits pi → fresh process → blank "startup" (the
//     load barrier pends: session_waiting_for_load) → "resume".
//   - pi delivers the resumed session with a NEW SessionManager object, so
//     sameOwnerStart (identity) failed; the resume was silently DROPPED at
//     the foreign-session gate — no session_rebound, no probe at 01:33:01,
//     and the wall card kept a dead countdown forever.
//
// Contract: while THIS process is waiting on the load barrier
// (initialSessionLoadPending set by a blank startup), a lifecycle
// session_start from the same workspace carrying the same session identity
// IS that load completing — the gate must accept it, restore the recovery
// probe timer, and the probe must actually fire. A lifecycle start with a
// DIFFERENT session id stays refused (subagent/foreign protection intact).
//
// Co-residency: this file fires session_start AND session_shutdown (like
// stale-self-heal.test.ts); afterEach resets the module-level owner/stale
// flags, the pi knobs, and the global autoResume setting.

import { test, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, {
  __testOnlyLoadState,
  __testOnlyResetOwnerSession,
  __testOnlyResetStaleFlag,
  __testOnlyResetTerminalFlags,
} from "../extensions/loops/goal.js";
import { seedGoal, seedState, MockPi, makeMockCtx, tmpCwd, tick, type MockCtx } from "./harness/mock-pi.js";
import { readGoalRuntimeSource } from "./harness/goal-source.js";

const pi = new MockPi();
activate(pi.api);

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;
function setGlobalAutoResume(v: boolean): void {
  fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify(v ? { autoResume: true, aggressiveMode: false } : { aggressiveMode: false }));
}

/** A file-backed-looking main host session manager (no getSessionFile:
 * simulates pi delivering the resumed manager before its session file is
 * set — the incident shape the file-backed check cannot see). */
function hostManager(id: string, messages: unknown[] | undefined): unknown {
  return {
    name: "main-session-manager",
    getSessionId: () => id,
    ...(messages !== undefined ? { buildSessionContext: () => ({ messages }) } : {}),
  };
}

function makeManagerCtx(cwd: string, sm: unknown): MockCtx {
  return makeMockCtx(cwd, { sessionManager: sm });
}

function readLedger(cwd: string): string {
  return fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf-8");
}

function seedParkedGoal(cwd: string, retryAtMs: number): void {
  // seedState spreads extra keys into the state line; mainModelRecovery is
  // carried through the unknown of the value type via a cast below.
  const retryAt = new Date(retryAtMs).toISOString();
  seedState(cwd, {
    goal: seedGoal({
      status: "paused",
      pauseKind: "wait",
      pauseResumeAt: retryAt,
      pauseReason: "main model recovery — retrying in 1s (main model quota: 429 rate limit: pi held the provider retry with no stream activity)",
    }),
    mainModelRecovery: {
      primary: "anthropic/mock-model",
      active: "anthropic/mock-model",
      attempted: ["anthropic/mock-model"],
      attempts: 1,
      reason: "main model quota: 429 rate limit",
      kind: "goal",
      firstFailureAt: new Date().toISOString(),
      autoRetryUntil: new Date(Date.now() + 24 * 3600_000).toISOString(),
      retryAt,
      pendingModelSwitch: "anthropic/mock-model",
    },
  } as unknown as Parameters<typeof seedState>[1]);
  __testOnlyLoadState(cwd);
}

function resetModuleState(): void {
  __testOnlyResetOwnerSession();
  __testOnlyResetStaleFlag();
  __testOnlyResetTerminalFlags();
}

beforeEach(() => {
  resetModuleState();
  setGlobalAutoResume(true);
});

afterEach(() => {
  setGlobalAutoResume(false);
  pi.execHandler = null;
  pi.sendMessageError = null;
  pi.sessionNameError = null;
  resetModuleState();
});

async function waitFor(fn: () => boolean, ms = 2500): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error("timed out waiting for condition");
    await tick(50);
  }
}

test("v0.34.63 — quit → blank startup → resume (new manager, same session id) restores the recovery probe", async () => {
  const cwd = tmpCwd();
  seedParkedGoal(cwd, Date.now() + 200);

  const owner = makeMockCtx(cwd, { sessionManager: hostManager("sess-main", undefined) });
  await pi.fire("session_shutdown", { reason: "quit" }, owner);
  assert.match(readLedger(cwd), /"session_shutdown".*"quit"/);

  // Fresh pi process: blank startup (no conversation yet) — the load barrier pends.
  const blank = makeManagerCtx(cwd, hostManager("sess-main", []));
  await pi.fire("session_start", { reason: "startup" }, blank);
  assert.match(readLedger(cwd), /session_waiting_for_load/, "blank startup pends the load barrier");

  // The user resumes: pi delivers a NEW SessionManager object for the SAME
  // session (same id, conversation now loaded, no getSessionFile yet).
  const resume = makeManagerCtx(cwd, hostManager("sess-main", [{ role: "user", content: "hi" }]));
  await pi.fire("session_start", { reason: "resume" }, resume);
  const l = readLedger(cwd);
  assert.match(l, /"session_rebound".*"resume"/, "the resume is NOT dropped at the foreign gate");
  const notifies = (resume.ui as unknown as { notifies: Array<{ message: string }> }).notifies;
  assert.ok(
    notifies.some((n) => n.message.includes("Restored main-model recovery (goal)")),
    `recovery restore notify: ${notifies.map((n) => n.message.slice(0, 60)).join(" | ")}`,
  );

  // The restored probe timer actually fires (the incident's dead countdown).
  await waitFor(() => readLedger(cwd).includes("main_model_probe"));
  assert.match(readLedger(cwd), /main_model_probe/, "the probe runs after the restored timer");
});

test("blank restart paints the durable list objective, recovery owner, and next action before transcript load", async () => {
  const cwd = tmpCwd();
  const retryAt = new Date(Date.now() + 60_000).toISOString();
  seedState(cwd, {
    goal: seedGoal({
      objective: "visible parked list objective",
      status: "paused",
      policy: "list",
      pauseKind: "wait",
      pauseResumeAt: retryAt,
      pauseReason: "main model recovery — provider wall",
      pauseSuggestedAction: "The saved item remains safe; /list resume retries immediately.",
    }),
    list: [{ id: "queued-next", objective: "next durable list item", addedAt: new Date().toISOString() }],
    mainModelRecovery: {
      primary: "anthropic/mock-model",
      active: "anthropic/mock-model",
      attempted: ["anthropic/mock-model"],
      attempts: 1,
      reason: "main model recovery — provider wall",
      kind: "goal",
      retryAt,
    },
  } as unknown as Parameters<typeof seedState>[1]);

  const blank = makeManagerCtx(cwd, hostManager("visible-session", []));
  await pi.fire("session_start", { reason: "startup" }, blank);
  const status = blank.ui.statuses["pi-glla"] ?? "";
  const widget = ((blank.ui.widgets["pi-glla"] as string[] | undefined) ?? []).join("\\n");
  assert.match(widget, /visible parked list objective/, "the current objective is visible during blank startup");
  assert.match(widget, /list item/, "the restored artifact is identified as a list item");
  assert.match(widget, /owner: main-model recovery/, "the recovery owner is rendered from durable state");
  assert.match(widget, /next: retry scheduled \(unconfirmed\)/, "a saved deadline describes intent, not a proven running probe");
  // v0.38.31: recovery-timer waits end at the auto-retry row — the generic
  // suggested-action tail is gone (owner + next above carry the facts).
  assert.doesNotMatch(widget, /remains safe/, "no generic boilerplate tail on the wait card");
  // v0.39.46 (note.md §1): the bottom strip no longer repeats facts the card
  // already owns. The recovery owner is asserted on the WIDGET three lines
  // above, so the requirement "the recovery owner is visible" keeps its
  // coverage; the duplicate status line is retired, not lost.
  assert.doesNotMatch(status, /main-model recovery/, "the strip does not repeat the card's recovery owner");
});

test("v0.34.63 — a lifecycle start with a DIFFERENT session id stays refused while the barrier pends", async () => {
  const cwd = tmpCwd();
  seedParkedGoal(cwd, Date.now() + 200);

  const owner = makeMockCtx(cwd, { sessionManager: hostManager("sess-main", undefined) });
  await pi.fire("session_shutdown", { reason: "quit" }, owner);
  const blank = makeManagerCtx(cwd, hostManager("sess-main", []));
  await pi.fire("session_start", { reason: "startup" }, blank);
  assert.match(readLedger(cwd), /session_waiting_for_load/);

  // A same-workspace lifecycle event from a DIFFERENT session (e.g. a
  // worker, or the user resuming another session file) must not steal the
  // parked plane: no rebind, no restore, no probe.
  const stranger = makeManagerCtx(cwd, hostManager("sess-other", [{ role: "user", content: "hi" }]));
  await pi.fire("session_start", { reason: "resume" }, stranger);
  const l = readLedger(cwd);
  assert.doesNotMatch(l, /"session_rebound".*"resume"/, "foreign lifecycle start is refused");
  await tick(500);
  assert.doesNotMatch(readLedger(cwd), /main_model_probe/, "no probe is armed for the refused session");
});

test("v0.34.63 — source guard: the barrier-completing resume gate is wired before the foreign-session return", () => {
  const SRC = readGoalRuntimeSource();
  assert.match(SRC, /const barrierAwaitingLoadedSession = initialSessionLoadPending && lifecycleSignal;/);
  assert.match(SRC, /resumeCompletesLoad = barrierAwaitingLoadedSession/);
  // v0.38.83: the gate moved verbatim into admitSessionStart, where refusal
  // returns null (the caller returns). The wired condition is unchanged.
  assert.match(SRC, /if \(foreignRecordedSession && !hostLifecycleStart && !resumeCompletesLoad\) return( null)?;/);
  assert.match(SRC, /sameSessionIdentity\(ctx\.sessionManager, recordedOwner\)/);
});

test("supervisor pause paints the fact on the card and clears the duplicated strip", async () => {
  // Audit item 1: the strip was previously kept alive solely because
  // `supervisorPausedAt` was set, even though the card already renders
  // "supervisor paused" on its closer. This is a PAINT-level check (through
  // the real session_start render), not a renderer-unit check, so it proves
  // the two surfaces cannot both claim the same fact.
  const cwd = tmpCwd();
  seedState(cwd, {
    goal: seedGoal({
      objective: "supervised objective — done when pinned",
      status: "active",
    }),
    supervisorPausedAt: Date.now() - 1_000,
  } as unknown as Parameters<typeof seedState>[1]);
  const ctx = makeManagerCtx(cwd, hostManager("supervisor-session", []));
  await pi.fire("session_start", { reason: "startup" }, ctx);
  const widget = ((ctx.ui.widgets["pi-glla"] as string[] | undefined) ?? []).join("\n");
  const status = ctx.ui.statuses["pi-glla"] ?? "";
  assert.match(widget, /supervisor paused/, "the card carries the frozen-supervisor fact");
  assert.doesNotMatch(status, /supervisor/, `the strip does not restate the supervisor chip: ${status}`);
  assert.doesNotMatch(status, /^glla: /, `the duplicated strip is cleared entirely: ${status}`);
});

test("versionDisplay=status keeps the version on the strip; =off hides it; default rides the card", async () => {
  // v0.39.49: the version indicator is a choice with ONE surface. The card is
  // the default; "status" is the escape hatch for people who preferred the
  // bottom line; "off" means neither. Painted through a real session_start so
  // this exercises the same path a user sees, not just the renderer.
  const render = async (mode: "" | "status" | "off"): Promise<{ widget: string; status: string }> => {
    const cwd = tmpCwd();
    fs.mkdirSync(path.dirname(GLOBAL_SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(GLOBAL_SETTINGS_PATH, JSON.stringify(mode ? { autoResume: true, versionDisplay: mode } : { autoResume: true }));
    seedState(cwd, { goal: seedGoal({ objective: `version-mode ${mode || "default"} — done when pinned`, status: "active" }) } as unknown as Parameters<typeof seedState>[1]);
    const ctx = makeManagerCtx(cwd, hostManager(`vm-${mode || "default"}`, []));
    await pi.fire("session_start", { reason: "startup" }, ctx);
    const widget = ((ctx.ui.widgets["pi-glla"] as string[] | undefined) ?? []).join("\n");
    return { widget, status: ctx.ui.statuses["pi-glla"] ?? "" };
  };
  const card = await render("");
  assert.match(card.widget, /v\d+\.\d+\.\d+|unknown|v0\./, "the default surface is the card");
  assert.doesNotMatch(card.status, /v\d+\.\d+\.\d+/, `the default does not duplicate onto the strip: ${card.status}`);

  const strip = await render("status");
  assert.match(strip.status, /^glla:/, `status mode keeps the strip alive: ${strip.status}`);
  assert.match(strip.status, /v\d+\.\d+\.\d+/, `status mode shows the version there: ${strip.status}`);

  const hidden = await render("off");
  assert.doesNotMatch(hidden.widget, /v\d+\.\d+\.\d+/, `off hides it on the card: ${hidden.widget}`);
  assert.doesNotMatch(hidden.status, /v\d+\.\d+\.\d+/, `off hides it on the strip: ${hidden.status}`);
});

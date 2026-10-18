// pi-goal-list-loop-audit
// tests/subagent-fallback-provenance.test.ts
//
// Per-role provenance for subagentFallbacks (chosen 2026-10-17): every role
// row used to be labelled from the whole map's provenance, and the editor
// rewrote the whole MERGED map to global — cloning project roles into
// global (where they resurfaced after the project entry was removed) and
// shadowing global roles behind any project map. Now chains resolve per
// role (project role wins, else global), each row names its actual source,
// and saves rewrite only the edited role's owning layer.

import { test, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import activate, { handleSettingChoice, saveSubagentFallbackChain, __testOnlyResetProcessState } from "../extensions/loops/goal.js";
import { globalSettingsPath, loadSettings, projectSettingsPath, subagentFallbackRoleSources, type Settings } from "../extensions/goal-settings.js";
import { buildSettingsRows } from "../extensions/settings-menu.js";
import { MockPi, makeMockCtx, tmpCwd, type MockCtx } from "./harness/mock-pi.js";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const globalFile = globalSettingsPath();
const originalGlobal = fs.readFileSync(globalFile, "utf8");
let running: { pi: MockPi; ctx: ReturnType<typeof makeMockCtx> } | undefined;

function writeGlobal(value: Record<string, unknown>): void {
  fs.writeFileSync(globalFile, JSON.stringify(value));
}

function writeProject(cwd: string, value: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(projectSettingsPath(cwd)), { recursive: true });
  fs.writeFileSync(projectSettingsPath(cwd), JSON.stringify(value));
}

function readGlobal(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(globalFile, "utf8")) as Record<string, unknown>;
}

function readProject(cwd: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(projectSettingsPath(cwd), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function boot(): Promise<{ pi: MockPi; ctx: MockCtx }> {
  __testOnlyResetProcessState();
  const pi = new MockPi();
  activate(pi.api);
  const ctx = makeMockCtx(tmpCwd(), { sessionManager: { name: `fb-prov-${Math.random()}` } });
  await pi.fire("session_start", { reason: "startup" }, ctx);
  running = { pi, ctx };
  return { pi, ctx: ctx as unknown as MockCtx };
}

afterEach(async () => {
  if (running) await running.pi.fire("session_shutdown", { reason: "test" }, running.ctx);
  running = undefined;
  __testOnlyResetProcessState();
  fs.writeFileSync(globalFile, originalGlobal);
});

test("mixed global/project fixtures resolve per role and attribute per role", () => {
  const { ctx } = { ctx: makeMockCtx(tmpCwd()) } as { ctx: MockCtx };
  const cwd = (ctx as unknown as { cwd: string }).cwd;
  writeGlobal({ subagentFallbacks: { worker: ["provider/global-worker"], scout: ["provider/global-scout"] } });
  writeProject(cwd, { subagentFallbacks: { scout: ["provider/project-scout"], reviewer: ["provider/project-reviewer"] } });

  // Effective: project role wins, else global role — no shadowing.
  const effective = loadSettings(cwd).subagentFallbacks;
  assert.deepEqual(effective, {
    worker: ["provider/global-worker"],
    scout: ["provider/project-scout"],
    reviewer: ["provider/project-reviewer"],
  }, "per-role merge: project wins per role, global roles survive");

  // Provenance: each role names its actual layer.
  const sources = subagentFallbackRoleSources(cwd);
  assert.deepEqual(sources, { worker: "global", scout: "project", reviewer: "project" });
});

test("mixed fixtures render correct per-role SOURCE text on every row", () => {
  const rows = buildSettingsRows(
    { subagentFallbacks: {
      worker: ["provider/global-worker"],
      scout: ["provider/project-scout"],
      reviewer: ["provider/project-reviewer"],
    } } as Settings,
    {},
    { subagentFallbackSources: { worker: "global", scout: "project", reviewer: "project" } },
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(byId.get("subagentFallbacks:worker")?.sourceText, "global");
  assert.equal(byId.get("subagentFallbacks:worker")?.valueText, "provider/global-worker");
  assert.equal(byId.get("subagentFallbacks:scout")?.sourceText, "project");
  assert.equal(byId.get("subagentFallbacks:scout")?.valueText, "provider/project-scout");
  assert.equal(byId.get("subagentFallbacks:reviewer")?.sourceText, "project");
  // Chain-less roles read default, never the whole-map source.
  assert.equal(byId.get("subagentFallbacks:delegate")?.sourceText, "default");
  assert.equal(byId.get("subagentFallbacks:delegate")?.valueText, "none (uses pin or inherits)");
});

test("saving a project-scoped role preserves unrelated roles in both layers", async () => {
  const { ctx } = await boot();
  const cwd = (ctx as unknown as { cwd: string }).cwd;
  writeGlobal({ subagentFallbacks: { worker: ["provider/global-worker"] } });
  writeProject(cwd, { subagentFallbacks: { scout: ["provider/project-scout"] } });

  const { scope } = saveSubagentFallbackChain(ctx as unknown as ExtensionContext, "scout", ["provider/project-scout-v2"]);
  assert.equal(scope, "project", "project-scoped role saves back to project");
  assert.deepEqual(
    (readProject(cwd).subagentFallbacks as Record<string, string[]>),
    { scout: ["provider/project-scout-v2"] },
    "project layer keeps only its own roles",
  );
  assert.deepEqual(
    (readGlobal().subagentFallbacks as Record<string, string[]>),
    { worker: ["provider/global-worker"] },
    "global layer untouched — no project clone",
  );
  assert.deepEqual(loadSettings(cwd).subagentFallbacks, {
    worker: ["provider/global-worker"],
    scout: ["provider/project-scout-v2"],
  }, "effective merge intact after save");
});

test("saving a global role never touches the project file", async () => {
  const { ctx } = await boot();
  const cwd = (ctx as unknown as { cwd: string }).cwd;
  writeGlobal({ subagentFallbacks: { worker: ["provider/global-worker"] } });
  writeProject(cwd, { subagentFallbacks: { scout: ["provider/project-scout"] } });

  const { scope } = saveSubagentFallbackChain(ctx as unknown as ExtensionContext, "worker", ["provider/global-worker-v2"]);
  assert.equal(scope, "global");
  assert.deepEqual(
    (readGlobal().subagentFallbacks as Record<string, string[]>),
    { worker: ["provider/global-worker-v2"] },
  );
  assert.deepEqual(
    (readProject(cwd).subagentFallbacks as Record<string, string[]>),
    { scout: ["provider/project-scout"] },
    "project roles survive a global edit",
  );
});

test("a brand-new role saves globally and clearing a project role reveals nothing stale", async () => {
  const { ctx } = await boot();
  const cwd = (ctx as unknown as { cwd: string }).cwd;
  writeGlobal({ subagentFallbacks: { worker: ["provider/global-worker"] } });
  writeProject(cwd, { subagentFallbacks: { scout: ["provider/project-scout"] } });

  const fresh = saveSubagentFallbackChain(ctx as unknown as ExtensionContext, "researcher", ["provider/r"]);
  assert.equal(fresh.scope, "global", "roles in neither layer default to global");
  assert.deepEqual((readProject(cwd).subagentFallbacks as Record<string, string[]>), { scout: ["provider/project-scout"] });

  const cleared = saveSubagentFallbackChain(ctx as unknown as ExtensionContext, "scout", []);
  assert.equal(cleared.scope, "project");
  assert.equal(readProject(cwd).subagentFallbacks, undefined, "empty project map removes the key");
  assert.deepEqual(loadSettings(cwd).subagentFallbacks, {
    worker: ["provider/global-worker"],
    researcher: ["provider/r"],
  }, "cleared project role falls through without resurrecting a stale global clone");
});

test("the picker editor routes a project role to the project file end to end", async () => {
  const { ctx } = await boot();
  const cwd = (ctx as unknown as { cwd: string }).cwd;
  writeGlobal({ subagentFallbacks: { worker: ["provider/global-worker"] } });
  writeProject(cwd, { subagentFallbacks: { scout: ["provider/project-scout"] } });
  ctx.ui.customStubMode = true;
  ctx.ui.inputImpl = async () => "provider/project-scout-v3";
  await handleSettingChoice("subagentFallbacks:scout", ctx as unknown as ExtensionContext);
  assert.deepEqual(
    (readProject(cwd).subagentFallbacks as Record<string, string[]>),
    { scout: ["provider/project-scout-v3"] },
  );
  assert.deepEqual(
    (readGlobal().subagentFallbacks as Record<string, string[]>),
    { worker: ["provider/global-worker"] },
    "no project role cloned into global by the editor",
  );
  assert.ok(ctx.ui.matching("project settings").length > 0, "the save notice names the scope");
});

// Designer parity: dedicated settings, migration, selection-time resolution,
// registration lifecycle, and the /glla Designer tab surface.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { globalSettingsPath, loadSettings, projectSettingsPath, resolveDesignerConfig, type Settings } from "../extensions/goal-settings.js";
import { resolveDesignerModel } from "../extensions/designer-model.js";
import { designerFileState, syncSubagentModelOverrides } from "../extensions/goal-loop-subagents.js";
import { buildSettingsRows } from "../extensions/settings-menu.js";
import activate, { __testOnlyResetProcessState } from "../extensions/loops/goal.js";
import { state } from "../extensions/goal-state.js";
import { MockPi, makeMockCtx, seedState, tmpCwd } from "./harness/mock-pi.js";

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeCtx(cwd: string, available: Array<{ provider: string; id: string }>, session?: { provider: string; id: string }) {
  const models = available.map((m) => ({ ...m, reasoning: true }));
  const sessionModel = session ? { ...session, reasoning: true } : models[0];
  return {
    cwd,
    model: sessionModel,
    modelRegistry: {
      find(provider: string, id: string) {
        return models.find((m) => m.provider === provider && m.id === id);
      },
      getAvailable() { return models; },
      hasConfiguredAuth() { return true; },
    },
  } as any;
}

async function withDesignerLifecycle(settings: Partial<Settings>, run: (fixture: {
  pi: MockPi; ctx: ReturnType<typeof makeMockCtx>; file: string; settingsFile: string;
}) => Promise<void>): Promise<void> {
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousSettingsPath = process.env.GLLA_GLOBAL_SETTINGS_PATH;
  __testOnlyResetProcessState();
  process.env.PI_CODING_AGENT_DIR = tmpCwd();
  process.env.GLLA_GLOBAL_SETTINGS_PATH = path.join(tmpCwd(), "settings.json");
  try {
    const settingsFile = globalSettingsPath();
    fs.writeFileSync(settingsFile, JSON.stringify({ aggressiveMode: false, ...settings }));
    const pi = new MockPi();
    activate(pi.api);
    const cwd = tmpCwd();
    seedState(cwd, {});
    const ctx = makeMockCtx(cwd, { sessionManager: { name: "designer-lifecycle" } });
    const models = ["initial", "current", "late", "pinned"].map(id => ({ ...ctx.model!, provider: "test", id, reasoning: true }));
    Object.assign(ctx, {
      model: models[0], thinkingLevel: "high",
      modelRegistry: {
        find: (provider: string, id: string) => models.find(model => model.provider === provider && model.id === id),
        getAvailable: () => models,
        hasConfiguredAuth: () => true,
      },
    });
    await pi.fire("session_start", { reason: "startup" }, ctx);
    await run({ pi, ctx, file: path.join(process.env.PI_CODING_AGENT_DIR!, "agents", "Designer.md"), settingsFile });
  } finally {
    __testOnlyResetProcessState();
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    if (previousSettingsPath === undefined) delete process.env.GLLA_GLOBAL_SETTINGS_PATH;
    else process.env.GLLA_GLOBAL_SETTINGS_PATH = previousSettingsPath;
  }
}

test("Designer refreshes its inherited pair at model, thinking, turn and ordinary launch boundaries without saving a pin", async () => {
  await withDesignerLifecycle({ designerEnabled: true }, async ({ pi, ctx, file, settingsFile }) => {
    const assertPair = (model: string, thinking: string) => {
      const definition = fs.readFileSync(file, "utf8");
      assert.ok(definition.includes(`model: test/${model}\n`));
      assert.ok(definition.includes(`thinking: ${thinking}\n`));
    };
    assertPair("initial", "high");

    // A model switch is reported by the event while the context still
    // carries the model the session just left. The projection must follow
    // the event, or the next launch inherits a model that is gone.
    const switched = { ...ctx.model!, id: "current" };
    await pi.fire("model_select", { previousModel: ctx.model, model: switched, source: "set" }, ctx);
    assertPair("current", "high");
    Object.assign(ctx, { model: switched });

    // A thinking change is reported the same way and refreshes the pair.
    Object.assign(ctx, { thinkingLevel: "low" });
    await pi.fire("thinking_level_select", { level: "low" }, ctx);
    assertPair("current", "low");

    // Extension-driven changes need not deliver selection events. Each real
    // launch/turn entry still consumes the latest context, not the old file.
    Object.assign(ctx, { model: { ...ctx.model!, id: "late" }, thinkingLevel: "off" });
    await pi.fire("before_agent_start", { prompt: "ordinary work", systemPrompt: "" }, ctx);
    assertPair("late", "off");

    // The launch boundary refreshes on its own: a session that changed
    // without any event (restore, extension-driven dial) still launches the
    // Designer on the current pair.
    Object.assign(ctx, { model: { ...ctx.model!, id: "current" }, thinkingLevel: "max" });
    assert.equal(state.goal, null, "ordinary Designer invocation has no Designer-marked goal");
    await pi.fire("tool_call", { toolName: "subagent", input: { agent: "Designer", task: "Review this approach" } }, ctx);
    assertPair("current", "max");

    const saved = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    assert.equal(saved.designerModel, undefined, "a generated projection never becomes a configured static model");
    assert.equal(saved.designerThinkingLevel, undefined, "live thinking never becomes a configured static dial");
    // A launch projection must not be presented as a saved pin: the file is
    // rewritten before every launch, so the note describes a projection.
    // The check is about the claim, not the exact wording.
    const definition = fs.readFileSync(file, "utf8");
    assert.match(definition, /x-glla-note: .*projection/i, "the managed file declares that it is a launch projection");
    assert.doesNotMatch(definition, /pinned to/i, "a session projection is never announced as a static pin");
  });
});

test("Designer explicit model/thinking pins remain independent across actual lifecycle and launch boundaries", async () => {
  await withDesignerLifecycle({ designerModel: "test/pinned", designerThinkingLevel: "high" }, async ({ pi, ctx, file }) => {
    const original = fs.readFileSync(file, "utf8");
    assert.match(original, /^model: test\/pinned$/m);
    assert.match(original, /^thinking: high$/m);
    const previousModel = ctx.model;
    Object.assign(ctx, { model: { ...ctx.model!, id: "current" }, thinkingLevel: "low" });
    await pi.fire("model_select", { previousModel, model: ctx.model, source: "set" }, ctx);
    await pi.fire("thinking_level_select", { level: "low" }, ctx);
    await pi.fire("before_agent_start", { prompt: "ordinary work", systemPrompt: "" }, ctx);
    await pi.fire("tool_call", { toolName: "subagent", input: { agent: "Designer", task: "Review the pins" } }, ctx);
    assert.equal(fs.readFileSync(file, "utf8"), original, "parent session changes cannot overwrite a selected Designer pair");
  });
});

for (const enabled of [undefined, false] as const) {
  test(`Designer lifecycle preserves ${enabled === false ? "disabled" : "on-demand"} registration`, async () => {
    await withDesignerLifecycle(enabled === false ? { designerEnabled: false } : {}, async ({ pi, ctx, file }) => {
      assert.equal(fs.existsSync(file), false);
      const previousModel = ctx.model;
      Object.assign(ctx, { model: { ...ctx.model!, id: "current" }, thinkingLevel: "low" });
      await pi.fire("model_select", { previousModel, model: ctx.model, source: "set" }, ctx);
      await pi.fire("thinking_level_select", { level: "low" }, ctx);
      await pi.fire("before_agent_start", { prompt: "ordinary work", systemPrompt: "" }, ctx);
      await pi.fire("tool_call", { toolName: "subagent", input: { action: "list" } }, ctx);
      assert.equal(fs.existsSync(file), false, "lifecycle and management events do not opt in");
      await pi.fire("tool_call", { toolName: "subagent", input: { agent: "Designer", task: "Explicit ordinary request" } }, ctx);
      assert.equal(fs.existsSync(file), enabled !== false, "only an authorized ordinary role request registers Designer");
      if (enabled !== false) {
        Object.assign(ctx, { thinkingLevel: "medium" });
        await pi.fire("tool_call", { toolName: "subagent", input: { agent: "Designer", task: "Next request" } }, ctx);
        assert.match(fs.readFileSync(file, "utf8"), /^thinking: medium$/m, "an on-demand registration stays live on later launches");
      }
      // Even disabled or inherited refreshes never rewrite a user's agent.
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const userContent = "---\nname: Designer\n---\nUser-owned prompt.\n";
      fs.writeFileSync(file, userContent);
      await pi.fire("thinking_level_select", { level: "off" }, ctx);
      await pi.fire("before_agent_start", { prompt: "ordinary work", systemPrompt: "" }, ctx);
      await pi.fire("tool_call", { toolName: "subagent", input: { agent: "Designer", task: "User-owned request" } }, ctx);
      assert.equal(fs.readFileSync(file, "utf8"), userContent);
    });
  });
}

test("a failed Designer registration is reported instead of failing later as an unknown agent", async () => {
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousSettingsPath = process.env.GLLA_GLOBAL_SETTINGS_PATH;
  __testOnlyResetProcessState();
  const agentDir = tmpCwd();
  // A file where the agents directory belongs makes every managed write fail.
  fs.writeFileSync(path.join(agentDir, "agents"), "not a directory");
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.GLLA_GLOBAL_SETTINGS_PATH = path.join(tmpCwd(), "settings.json");
  try {
    fs.writeFileSync(globalSettingsPath(), JSON.stringify({ aggressiveMode: false }));
    const pi = new MockPi();
    activate(pi.api);
    const cwd = tmpCwd();
    seedState(cwd, {});
    const ctx = makeMockCtx(cwd, { sessionManager: { name: "designer-failure" } });
    await pi.fire("session_start", { reason: "startup" }, ctx);
    await pi.fire("tool_call", { toolName: "subagent", input: { agent: "Designer", task: "Review this approach" } }, ctx);
    const warnings = ctx.ui.notifies.filter((entry) => entry.type === "warning");
    assert.ok(
      warnings.some((entry) => /could not register the Designer definition/.test(entry.message)),
      "a failed registration must be reported at the launch boundary",
    );
  } finally {
    __testOnlyResetProcessState();
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    if (previousSettingsPath === undefined) delete process.env.GLLA_GLOBAL_SETTINGS_PATH;
    else process.env.GLLA_GLOBAL_SETTINGS_PATH = previousSettingsPath;
  }
});

test("resolveDesignerConfig: dedicated keys win per-field over legacy pins", () => {
  const legacyOnly = resolveDesignerConfig({
    subagentModelOverrides: { Designer: "legacy/model" },
    subagentThinkingOverrides: { Designer: "low" },
    subagentFallbacks: { Designer: ["legacy/fallback"] },
  } as Settings);
  assert.equal(legacyOnly.model, "legacy/model");
  assert.equal(legacyOnly.thinking, "low");
  assert.deepEqual(legacyOnly.fallbacks, ["legacy/fallback"]);
  assert.equal(legacyOnly.configured, true);
  assert.equal(legacyOnly.enabled, undefined);

  const dedicated = resolveDesignerConfig({
    designerEnabled: false,
    designerModel: "dedicated/model",
    designerThinkingLevel: "high",
    designerModelFallbacks: ["dedicated/fallback"],
    subagentModelOverrides: { Designer: "legacy/model" },
    subagentThinkingOverrides: { Designer: "low" },
    subagentFallbacks: { Designer: ["legacy/fallback"] },
  } as Settings);
  assert.equal(dedicated.model, "dedicated/model");
  assert.equal(dedicated.thinking, "high");
  assert.deepEqual(dedicated.fallbacks, ["dedicated/fallback"]);
  assert.equal(dedicated.enabled, false);

  const bare = resolveDesignerConfig({} as Settings);
  assert.equal(bare.configured, false);
  assert.equal(bare.model, undefined);
});

test("migration: legacy Designer pins fold into dedicated keys on load, other roles untouched", () => {
  const prevAgentDir = process.env.PI_CODING_AGENT_DIR;
  const agentDir = tmpDir("glla-designer-migration-");
  process.env.PI_CODING_AGENT_DIR = agentDir;
  const cwd = tmpDir("glla-designer-migration-cwd-");
  try {
    fs.mkdirSync(path.dirname(globalSettingsPath()), { recursive: true });
    fs.writeFileSync(globalSettingsPath(), JSON.stringify({
      subagentModelOverrides: { Designer: "legacy/model", scout: "keep/me" },
      subagentThinkingOverrides: { Designer: "low", scout: "high" },
      subagentFallbacks: { Designer: ["legacy/fallback"], scout: ["keep/chain"] },
    }));
    const settings = loadSettings(cwd);
    assert.equal(settings.designerModel, "legacy/model");
    assert.equal(settings.designerThinkingLevel, "low");
    assert.deepEqual(settings.designerModelFallbacks, ["legacy/fallback"]);
    assert.equal(settings.subagentModelOverrides?.Designer, undefined);
    assert.equal(settings.subagentModelOverrides?.scout, "keep/me");
    assert.equal(settings.subagentThinkingOverrides?.scout, "high");
    assert.deepEqual(settings.subagentFallbacks?.scout, ["keep/chain"]);
    assert.equal(resolveDesignerConfig(settings).configured, true);
  } finally {
    if (prevAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = prevAgentDir;
  }
});

test("migration: dedicated values win and an explicit empty fallback array beats the legacy chain", () => {
  const prevAgentDir = process.env.PI_CODING_AGENT_DIR;
  const agentDir = tmpDir("glla-designer-migration2-");
  process.env.PI_CODING_AGENT_DIR = agentDir;
  const cwd = tmpDir("glla-designer-migration2-cwd-");
  try {
    fs.mkdirSync(path.dirname(globalSettingsPath()), { recursive: true });
    fs.writeFileSync(globalSettingsPath(), JSON.stringify({
      designerModel: "dedicated/model",
      designerModelFallbacks: [],
      subagentModelOverrides: { Designer: "legacy/model" },
      subagentFallbacks: { Designer: ["legacy/fallback"] },
    }));
    const settings = loadSettings(cwd);
    assert.equal(settings.designerModel, "dedicated/model");
    assert.deepEqual(settings.designerModelFallbacks, []);
  } finally {
    if (prevAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = prevAgentDir;
  }
});

test("resolveDesignerModel: primary, then fallbacks, then automatic session last-fallback; forbidden session blocks", () => {
  const cwd = tmpDir("glla-designer-resolve-");
  const base = { forbiddenModels: [] as string[] };

  const primary = resolveDesignerModel(
    fakeCtx(cwd, [{ provider: "openai", id: "primary" }, { provider: "openai", id: "fallback" }]),
    { ...base, designerModel: "openai/primary", designerModelFallbacks: ["openai/fallback"] } as Settings,
  );
  assert.equal(primary.selectedRef, "openai/primary");

  const fallback = resolveDesignerModel(
    fakeCtx(cwd, [{ provider: "openai", id: "fallback" }]),
    { ...base, designerModel: "openai/missing", designerModelFallbacks: ["openai/fallback"] } as Settings,
  );
  assert.equal(fallback.selectedRef, "openai/fallback", "first eligible fallback wins when the primary is unavailable");
  assert.equal(fallback.blocked, false);

  const inherit = resolveDesignerModel(
    fakeCtx(cwd, [{ provider: "anthropic", id: "session" }], { provider: "anthropic", id: "session" }),
    { ...base, designerModel: "openai/missing" } as Settings,
  );
  assert.equal(inherit.selectedRef, "anthropic/session");
  assert.equal(inherit.blocked, false, "an eligible session model is pinned as the automatic last fallback, not blocked");
  assert.deepEqual(inherit.configuredRefs, ["openai/missing"], "the automatic session fallback is a selection-time append, not a configured ref");

  const blocked = resolveDesignerModel(
    fakeCtx(cwd, [{ provider: "anthropic", id: "session" }], { provider: "anthropic", id: "session" }),
    { designerModel: "openai/missing", forbiddenModels: ["session"] } as Settings,
  );
  assert.equal(blocked.selectedRef, undefined);
  assert.equal(blocked.blocked, true, "a forbidden session model must never be inherited silently");
});

test("resolveDesignerModel: selected primary wins over session; session is not duplicated when already configured", () => {
  const cwd = tmpDir("glla-designer-resolve-session-");
  const base = { forbiddenModels: [] as string[] };

  // Both the configured primary and the session are eligible: the selected
  // primary is used first, the session never jumps the queue.
  const primaryFirst = resolveDesignerModel(
    fakeCtx(cwd, [{ provider: "openai", id: "primary" }, { provider: "anthropic", id: "session" }], { provider: "anthropic", id: "session" }),
    { ...base, designerModel: "openai/primary", designerModelFallbacks: ["openai/missing"] } as Settings,
  );
  assert.equal(primaryFirst.selectedRef, "openai/primary");
  assert.equal(primaryFirst.blocked, false);

  // The session model configured as the primary resolves once, not twice.
  const alreadyConfigured = resolveDesignerModel(
    fakeCtx(cwd, [{ provider: "anthropic", id: "session" }], { provider: "anthropic", id: "session" }),
    { ...base, designerModel: "anthropic/session" } as Settings,
  );
  assert.equal(alreadyConfigured.selectedRef, "anthropic/session");
  assert.deepEqual(alreadyConfigured.configuredRefs, ["anthropic/session"]);
});

test("Designer session default and unavailable-selection recovery inherit model AND live thinking", () => {
  const cwd = tmpDir("glla-designer-session-thinking-");
  const ctx = fakeCtx(cwd, [], { provider: "test", id: "session" });
  // The live session need not appear in registry availability (extension
  // auth may only be available through the already-running session).
  ctx.thinkingLevel = "max";
  for (const settings of [
    { designerThinkingLevel: "low" },
    { designerModel: "test/missing", designerThinkingLevel: "low" },
  ] as Settings[]) {
    const resolved = resolveDesignerModel(ctx, settings);
    assert.equal(resolved.selectedRef, "test/session");
    assert.equal(resolved.thinking, "max");
    assert.equal(resolved.via, settings.designerModel ? "session-fallback" : "session");
    const agentDir = tmpDir("glla-designer-pair-sync-");
    syncSubagentModelOverrides({
      agentDir, strategy: "inherit-parent", designerRequested: true,
      designer: { configured: false, model: resolved.selectedRef, thinking: resolved.thinking },
    });
    const content = fs.readFileSync(path.join(agentDir, "agents", "Designer.md"), "utf8");
    assert.match(content, /^model: test\/session$/m);
    assert.match(content, /^thinking: max$/m);
    assert.doesNotMatch(content, /^thinking: low$/m);
  }
  ctx.thinkingLevel = "off";
  assert.equal(resolveDesignerModel(ctx, { designerThinkingLevel: "high" } as Settings).thinking, "off", "resolve each registration from the current dial");
});

test("Designer explicitly selected models keep configured thinking and otherwise inherit the session dial", () => {
  const ctx = fakeCtx(tmpDir("glla-designer-pin-thinking-"), [{ provider: "test", id: "selected" }], { provider: "test", id: "session" });
  ctx.thinkingLevel = "medium";
  const pinned = resolveDesignerModel(ctx, { designerModel: "test/selected", designerThinkingLevel: "low" } as Settings);
  assert.equal(pinned.selectedRef, "test/selected");
  assert.equal(pinned.via, "configured");
  assert.equal(pinned.thinking, "low");
  assert.equal(resolveDesignerModel(ctx, { designerModel: "test/selected" } as Settings).thinking, "medium");
});

test("migration: junk dedicated values do not block the legacy pin, and project-scoped legacy pins are dropped", () => {
  const prevAgentDir = process.env.PI_CODING_AGENT_DIR;
  const agentDir = tmpDir("glla-designer-migration3-");
  process.env.PI_CODING_AGENT_DIR = agentDir;
  const cwd = tmpDir("glla-designer-migration3-cwd-");
  try {
    fs.mkdirSync(path.dirname(globalSettingsPath()), { recursive: true });
    fs.writeFileSync(globalSettingsPath(), JSON.stringify({
      designerModel: null,
      designerModelFallbacks: "junk",
      subagentModelOverrides: { Designer: "legacy/model" },
      subagentFallbacks: { Designer: ["legacy/fallback"] },
    }));
    const settings = loadSettings(cwd);
    assert.equal(settings.designerModel, "legacy/model", "a dead dedicated value must not lose the legacy pin");
    assert.deepEqual(settings.designerModelFallbacks, ["legacy/fallback"]);

    // The dedicated keys are global-only: a legacy pin living only in the
    // project file no longer applies (Designer.md is global state).
    fs.writeFileSync(globalSettingsPath(), JSON.stringify({}));
    fs.mkdirSync(path.dirname(projectSettingsPath(cwd)), { recursive: true });
    fs.writeFileSync(projectSettingsPath(cwd), JSON.stringify({
      subagentModelOverrides: { Designer: "project/model" },
    }));
    const projectScoped = loadSettings(cwd);
    assert.equal(projectScoped.designerModel, undefined, "project-scoped legacy Designer pins are intentionally dropped");
  } finally {
    if (prevAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = prevAgentDir;
  }
});

test("sync: implicit session pairs do not authorize Designer; explicit intent and ownership govern its lifecycle", () => {
  const agentDir = tmpDir("glla-designer-implicit-pair-");
  const file = path.join(agentDir, "agents", "Designer.md");
  const pair = { model: "test/session", thinking: "max" };
  const sync = (configured: boolean, requested = false, disabled = false) => syncSubagentModelOverrides({
    agentDir, strategy: "inherit-parent", designerRequested: requested,
    designer: { configured, disabled, ...pair },
  });

  assert.equal(sync(false).written.includes("Designer"), false);
  assert.equal(fs.existsSync(file), false, "resolved model and thinking alone remain opt-in");
  assert.ok(sync(false, true).written.includes("Designer"), "an explicit request registers the same session pair");
  assert.match(fs.readFileSync(file, "utf8"), /^model: test\/session$/m);
  assert.match(fs.readFileSync(file, "utf8"), /^thinking: max$/m);
  assert.ok(sync(false).removed.includes("Designer"), "unconfigured sync removes only the old managed registration");
  assert.equal(fs.existsSync(file), false);
  assert.ok(sync(true).written.includes("Designer"), "explicit enablement/configuration can inherit the session pair");
  assert.ok(sync(true, true, true).removed.includes("Designer"), "disabled wins over request and configuration");
  assert.equal(fs.existsSync(file), false);

  const userContent = "---\nname: Designer\n---\n\nMy own Designer definition.\n";
  fs.writeFileSync(file, userContent);
  for (const [configured, requested, disabled] of [[false, false, false], [true, true, false], [true, true, true]] as const) {
    const result = sync(configured, requested, disabled);
    assert.ok(result.skipped.some(entry => entry.name === "Designer"));
    assert.equal(fs.readFileSync(file, "utf8"), userContent, "no lifecycle state can overwrite or remove a user-owned file");
  }
});

test("sync: dedicated Designer config registers, disables, and never touches a user-owned file", () => {
  const agentDir = tmpDir("glla-designer-sync-");
  const file = path.join(agentDir, "agents", "Designer.md");

  assert.equal(designerFileState(agentDir), "absent");
  const on = syncSubagentModelOverrides({
    agentDir, strategy: "inherit-parent",
    designer: { configured: true, model: "openai/designer", thinking: "high" },
  });
  assert.ok(on.written.includes("Designer"));
  assert.equal(designerFileState(agentDir), "managed");
  const content = fs.readFileSync(file, "utf-8");
  assert.match(content, /^model: openai\/designer$/m);
  assert.match(content, /^thinking: high$/m);

  const off = syncSubagentModelOverrides({
    agentDir, strategy: "inherit-parent",
    designer: { configured: true, disabled: true, model: "openai/designer", thinking: "high" },
  });
  assert.ok(off.removed.includes("Designer"));
  assert.ok(!fs.existsSync(file), "disabled removes the managed file but keeps the settings");

  // Fallback-only configuration counts as configured and registers.
  const fallbackOnly = syncSubagentModelOverrides({
    agentDir, strategy: "inherit-parent",
    designer: { configured: true, model: "openai/fallback" },
  });
  assert.ok(fallbackOnly.written.includes("Designer"));

  // A user-owned Designer.md (no glla marker) is never overwritten or removed.
  fs.writeFileSync(file, "---\nname: Designer\n---\n\nuser-owned\n");
  assert.equal(designerFileState(agentDir), "user-owned");
  const untouched = syncSubagentModelOverrides({
    agentDir, strategy: "inherit-parent",
    designer: { configured: true, model: "openai/designer" },
  });
  assert.ok(untouched.skipped.some((s) => s.name === "Designer"));
  assert.match(fs.readFileSync(file, "utf-8"), /user-owned/);

  // Plain startup with nothing configured registers nothing.
  const agentDir2 = tmpDir("glla-designer-sync-off-");
  const plain = syncSubagentModelOverrides({ agentDir: agentDir2, strategy: "inherit-parent", designer: { configured: false } });
  assert.ok(!plain.written.includes("Designer"));
  assert.ok(!fs.existsSync(path.join(agentDir2, "agents", "Designer.md")));
});

test("settings menu: Designer tab owns its rows and the generic Subagents loops exclude Designer", () => {
  const rows = buildSettingsRows({ designerModel: "openai/designer", designerThinkingLevel: "high" } as Settings, {}, { designerFileState: "managed", designerResolved: { selectedRef: "openai/designer", blocked: false } });
  const designerRows = rows.filter((r) => r.section === "designer").map((r) => r.id);
  assert.deepEqual(designerRows, ["designerEnabled", "designerModel", "designerModelFallbacks", "designerEffective", "designerRegistered"]);
  const registered = rows.find((r) => r.id === "designerRegistered");
  assert.equal(registered?.valueText, "registered");
  const effective = rows.find((r) => r.id === "designerEffective");
  assert.match(effective?.valueText ?? "", /openai\/designer/, "the effective row names the eligibility-resolved ref");

  // Resolution-aware effective text: an unavailable primary with an eligible
  // fallback names the fallback; a forbidden session with nothing eligible
  // reports blocked instead of promising the configured chain.
  const fallbackRows = buildSettingsRows({ designerModel: "openai/missing", designerModelFallbacks: ["openai/fallback"] } as Settings, {}, { designerResolved: { selectedRef: "openai/fallback", blocked: false } });
  assert.match(fallbackRows.find((r) => r.id === "designerEffective")?.valueText ?? "", /openai\/fallback/);
  const blockedRows = buildSettingsRows({ designerModel: "openai/missing" } as Settings, {}, { designerResolved: { blocked: true } });
  assert.match(blockedRows.find((r) => r.id === "designerEffective")?.valueText ?? "", /^blocked/);
  const userOwned = buildSettingsRows({} as Settings, {}, { designerFileState: "user-owned" });
  assert.equal(userOwned.find((r) => r.id === "designerRegistered")?.valueText, "user-owned file present");
  const ids = new Set(rows.map((r) => r.id));
  assert.ok(!ids.has("subagentModelOverrides.Designer"), "no legacy Designer pin row");
  assert.ok(!ids.has("subagentThinkingOverrides.Designer"), "no legacy Designer thinking row");
  assert.ok(!ids.has("subagentFallbacks:Designer"), "no legacy Designer chain row");
  assert.ok(ids.has("subagentModelOverrides.scout"), "other roles keep their generic rows");
});

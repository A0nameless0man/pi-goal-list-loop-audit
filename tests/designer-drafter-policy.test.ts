import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  ACTIVE_EXECUTION_QUESTION_GUIDANCE,
  buildSeedGrillMessage,
  buildTaskList,
  extractAgentRole,
  findNextPendingTask,
  LONG_RUNNING_JUDGMENT_POLICY,
  parseListItemDeclaration,
} from "../extensions/goal-loop-core.ts";
import {
  buildAgentOverrideMd,
  syncSubagentModelOverrides,
} from "../extensions/goal-loop-subagents.ts";
import { resolveDesignerModel } from "../extensions/designer-model.ts";
import { resolveDrafterModel, resolveDrafterThinkingLevel } from "../extensions/drafter-model.ts";
import { continuationPrompt } from "../extensions/goal-continuation.ts";
import { buildSettingsRows } from "../extensions/settings-menu.ts";
import type { Settings } from "../extensions/goal-settings.ts";

// The primary is not a fallback slot. Exercise selection (not just list size)
// with a full ten-slot setting, then policy and identity aliases on both roles.
for (const role of ["designer", "drafter"] as const) {
  test(`${role} can select its tenth independent alternative and caps only the fallback setting`, () => {
    const session = { provider: "test", id: "session", reasoning: true };
    const tenth = { provider: "test", id: "tenth", reasoning: true };
    const eleventh = { provider: "test", id: "eleventh", reasoning: true };
    let available = [tenth, eleventh];
    const ctx = {
      cwd: fs.mkdtempSync(path.join(os.tmpdir(), "glla-ten-slots-")), model: session, thinkingLevel: "high",
      modelRegistry: {
        find: (provider: string, id: string) => available.find(m => m.provider === provider && m.id === id),
        getAvailable: () => available, hasConfiguredAuth: () => true,
      },
    } as any;
    const alternatives = [...Array.from({ length: 9 }, (_, i) => `test/missing-${i}`), "test/tenth"];
    const settings = { [`${role}Model`]: "test/missing-primary", [`${role}ModelFallbacks`]: alternatives };
    const resolve = (s: any) => role === "designer"
      ? resolveDesignerModel(ctx, s, { reportBlocked: false })
      : resolveDrafterModel(ctx, s);
    const selected = (s: any): string | undefined => {
      const result = resolve(s);
      return "selectedRef" in result ? result.selectedRef : (result as ReturnType<typeof resolveDrafterModel>).selected?.ref;
    };
    assert.equal(selected(settings), "test/tenth");
    assert.deepEqual(resolve(settings).configuredRefs, ["test/missing-primary", ...alternatives]);
    // Input past the independently bounded setting must not create extra slots.
    available = [eleventh];
    assert.equal(selected({ ...settings, [`${role}ModelFallbacks`]: [...alternatives, "test/eleventh"] }), "test/session");
    available = [tenth, eleventh];
    assert.equal(selected({ ...settings, forbiddenModels: ["test/tenth"] }), "test/session");
    assert.equal(selected({ ...settings, forbiddenModels: ["test/tenth", "test/session"] }), undefined);
  });

  test(`${role} retains explicit order and refuses forbidden resolved aliases`, () => {
    const session = { provider: "test", id: "session", reasoning: true };
    const first = { provider: "test", id: "first", name: "alias-first", reasoning: true };
    const second = { provider: "test", id: "second", reasoning: true };
    const ctx = {
      cwd: fs.mkdtempSync(path.join(os.tmpdir(), "glla-slot-order-")), model: session,
      modelRegistry: {
        find: (provider: string, id: string) => [first, second, session].find(m => m.provider === provider && m.id === id),
        getAvailable: () => [second, first, session], hasConfiguredAuth: () => true,
      },
    } as any;
    const settings = {
      [`${role}Model`]: "test/missing", [`${role}ModelFallbacks`]: ["alias-first", "test/first", "test/second", "test/SECOND"],
    };
    const resolve = (s: any) => role === "designer"
      ? resolveDesignerModel(ctx, s, { reportBlocked: false })
      : resolveDrafterModel(ctx, s);
    const selected = (s: any) => {
      const result = resolve(s);
      return "selectedRef" in result ? result.selectedRef : (result as ReturnType<typeof resolveDrafterModel>).selected?.ref;
    };
    const explicitSession = { [`${role}Model`]: "test/missing", [`${role}ModelFallbacks`]: ["test/session", "test/second"] };
    assert.equal(selected(explicitSession), "test/session", "explicit session fallback keeps its configured position");
    if (role === "drafter") {
      assert.deepEqual(resolveDrafterModel(ctx, explicitSession).candidates.map(c => c.model), [session, second]);
    }
    assert.equal(selected(settings), "alias-first", "operator order beats registry order");
    assert.equal(selected({ ...settings, forbiddenModels: ["test/first"] }), "test/second", "alias cannot bypass canonical model policy");
    assert.equal(selected({ ...settings, forbiddenModels: ["alias-first", "test/first", "test/second"] }), "test/session");
    if (role === "drafter") {
      const resolved = resolveDrafterModel(ctx, settings);
      assert.deepEqual(resolved.candidates.map(c => c.model), [first, second, session], "aliases and case variants do not create independent candidates");
      const sessionAlias = resolveDrafterModel(ctx, { drafterModel: "session", drafterModelFallbacks: ["test/second"] });
      assert.deepEqual(sessionAlias.candidates.map(c => c.model), [session, second], "session alias is not appended again as last resort");
    }
  });
}

test("long-running judgment policy is default-decide and bans band-aid-vs-proper questions", () => {
  assert.match(LONG_RUNNING_JUDGMENT_POLICY, /durable, maintainable root-cause fix/);
  // v0.35.4: the question gate flipped from permissive ("ask only at a
  // genuine decision boundary") to default-decide — the band-aid-vs-proper
  // choice is never presented to the user.
  assert.doesNotMatch(LONG_RUNNING_JUDGMENT_POLICY, /genuine decision boundary/);
  assert.match(LONG_RUNNING_JUDGMENT_POLICY, /NEVER a question/);
  assert.match(LONG_RUNNING_JUDGMENT_POLICY, /decide it and proceed/);
  assert.match(LONG_RUNNING_JUDGMENT_POLICY, /DECIDE question/);
  assert.match(LONG_RUNNING_JUDGMENT_POLICY, /Compensate for zero mid-run questions by asking MORE up front/);
  const seeded = buildSeedGrillMessage("[DRAFT]", "ship the plugin", "propose_goal_draft");
  assert.match(seeded, /LONG-RUNNING JUDGMENT POLICY/);
  assert.match(seeded, /irreversible\/destructive external action/);
  assert.match(seeded, /2[–-]4 sharp, seed-specific questions in ONE batched ask_user_question call per phase/);
});

test("drafting gathers constraints upfront and active execution defers local choices", () => {
  const seeded = buildSeedGrillMessage("[DRAFT]", "ship the plugin", "propose_goal_draft");
  assert.match(seeded, /what "done" concretely looks like/);
  assert.match(seeded, /scope boundaries/);
  assert.match(seeded, /constraints/);
  assert.match(seeded, /priorities/);
  assert.match(seeded, /2[–-]4 sharp, seed-specific questions in ONE batched ask_user_question call per phase/);
  assert.match(seeded, /Resolve these decisions during drafting, before execution/);

  assert.match(ACTIVE_EXECUTION_QUESTION_GUIDANCE, /Drafting is the ONLY place/);
  assert.match(ACTIVE_EXECUTION_QUESTION_GUIDANCE, /zero mid-execution questions/);
  assert.match(ACTIVE_EXECUTION_QUESTION_GUIDANCE, /reversible implementation choices/);
  assert.match(ACTIVE_EXECUTION_QUESTION_GUIDANCE, /irreversible[\/ ]+(or )?destructive external boundary/i);
  assert.match(ACTIVE_EXECUTION_QUESTION_GUIDANCE, /recommended default/);
  assert.match(ACTIVE_EXECUTION_QUESTION_GUIDANCE, /batch 2-4 sharp questions up front/);

  const active = continuationPrompt({
    id: "question-discipline",
    objective: "ship the plugin",
    status: "active",
    policy: "list",
    autoContinue: true,
    usage: { tokensUsed: 0, tokensLimit: 0 },
    createdAt: "2026-08-27T00:00:00Z",
    updatedAt: "2026-08-27T00:00:00Z",
  });
  assert.equal((active.match(/LONG-RUNNING JUDGMENT POLICY/g) ?? []).length, 1, "stable policy is not duplicated per continuation");
  assert.equal((active.match(/ACTIVE-EXECUTION QUESTION DISCIPLINE/g) ?? []).length, 1, "active question guidance appears once");
  assert.match(active, /do not ask about reversible implementation choices/i);
  assert.match(active, /Never ask a vague progress or "what next\?" question/i);
});

test("explicit Designer declarations are consumed without changing ordinary design prose", () => {
  const ordinary = extractAgentRole("Design the settings flow");
  assert.equal(ordinary.agentRole, undefined);
  assert.equal(ordinary.objective, "Design the settings flow");

  const parsed = parseListItemDeclaration("Fix the settings flow. Agent: Designer. Parallel: yes. Done when: npm test");
  assert.equal(parsed.objective, "Fix the settings flow");
  assert.equal(parsed.agentRole, "designer");
  assert.equal(parsed.parallelSafe, true);
  assert.equal(parsed.verificationContract, "npm test");
});

test("task plans preserve Designer routing and verification contracts and expose them on tasks", () => {
  const list = buildTaskList([
    { title: "Design the change", agentRole: "designer", verificationContract: "npm test", subtasks: ["Implement it"] },
    { title: "Verify the result", verificationContract: "bun test tests/foo.test.ts" },
  ]);
  assert.equal(list.tasks[0]!.agentRole, "designer");
  assert.equal(list.tasks[0]!.verificationContract, "npm test");
  assert.equal(list.tasks[1]!.verificationContract, "bun test tests/foo.test.ts");
  const next = findNextPendingTask(list.tasks);
  assert.deepEqual(next, { id: "1", title: "Design the change", agentRole: "designer" });
});

test("explicitly selected Designer is a managed read-only role without requiring a model pin", () => {
  const md = buildAgentOverrideMd("Designer");
  assert.doesNotMatch(md, /^model:/m);
  assert.match(md, /DESIGNER ROLE/);
  assert.match(md, /read, bash, grep, find, ls/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glla-designer-role-"));
  const disabled = syncSubagentModelOverrides({ agentDir: dir, strategy: "inherit-parent", overrides: {} });
  assert.equal(disabled.written.includes("Designer"), false);
  assert.equal(fs.existsSync(path.join(dir, "agents", "Designer.md")), false);
  const sync = syncSubagentModelOverrides({ agentDir: dir, strategy: "inherit-parent", overrides: {}, designerRequested: true });
  assert.ok(sync.written.includes("Designer"));
  assert.ok(fs.existsSync(path.join(dir, "agents", "Designer.md")));
});

function fakeContext() {
  const session = { provider: "test", id: "session" };
  const backup = { provider: "test", id: "backup" };
  const last = { provider: "test", id: "last" };
  const models = new Map([["test/backup", backup], ["test/last", last], ["test/session", session]]);
  const registry = {
    find(provider: string, id: string) { return models.get(`${provider}/${id}`); },
    getAvailable() { return [...models.values()]; },
    hasConfiguredAuth(model: any) { return model !== last; },
  };
  return { ctx: { model: session, modelRegistry: registry } as any, session, backup, last };
}

test("drafter resolution walks its own ordered chain and falls back to the session", () => {
  const { ctx, backup, session } = fakeContext();
  const resolved = resolveDrafterModel(ctx, {
    drafterModel: "test/missing",
    drafterModelFallbacks: ["test/backup", "test/last"],
    forbiddenModels: [],
  });
  assert.equal(resolved.selected?.model, backup);
  assert.deepEqual(resolved.candidates.map((c) => c.ref), ["test/backup", "test/session"]);
  assert.equal(resolved.candidates.at(-1)?.model, session);
  assert.equal(resolved.candidates.at(-1)?.via, "session-last-resort");
});

test("drafter resolution always retains one current-session last resort", () => {
  const { ctx, session } = fakeContext();
  const resolved = resolveDrafterModel(ctx, {
    drafterModel: "test/missing",
    drafterModelFallbacks: [],
    forbiddenModels: [],
  });
  assert.deepEqual(resolved.candidates.map((candidate) => candidate.ref), ["test/session"]);
  assert.equal(resolved.candidates[0]?.via, "session-last-resort");
  assert.equal(resolved.selected?.model, session);
});

test("drafter session default and automatic recovery keep the session thinking, explicit models keep their own", () => {
  const { ctx } = fakeContext();
  for (const settings of [{}, { drafterModel: "test/missing" }]) {
    const selected = resolveDrafterModel(ctx, settings).selected!;
    assert.equal(selected.model, ctx.model);
    assert.equal(resolveDrafterThinkingLevel(selected, "max", "low"), "max");
    assert.equal(resolveDrafterThinkingLevel(selected, "off", "high"), "off");
  }
  const selected = resolveDrafterModel(ctx, { drafterModel: "test/backup" }).selected!;
  assert.equal(resolveDrafterThinkingLevel(selected, "max", "low"), "low");
  assert.equal(resolveDrafterThinkingLevel(selected, "high"), "high");
});

test("drafter resolution skips forbidden candidates without inspecting provider text", () => {
  const { ctx, backup } = fakeContext();
  const resolved = resolveDrafterModel(ctx, {
    drafterModel: "test/backup",
    drafterModelFallbacks: [],
    forbiddenModels: ["test/backup"],
  });
  assert.equal(resolved.selected?.model, ctx.model);
  assert.notEqual(resolved.selected?.model, backup);
});

test("audit 2026-09-06: drafter session-last-resort refuses a forbidden session model", () => {
  const { ctx, session } = fakeContext();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "glla-drafter-forbidden-"));
  const resolved = resolveDrafterModel({ ...ctx, cwd }, {
    drafterModel: "test/missing",
    drafterModelFallbacks: [],
    forbiddenModels: ["test/session"],
  });
  assert.deepEqual(resolved.candidates.map((candidate) => candidate.ref), []);
  assert.equal(resolved.selected, undefined);
  const ledger = fs.readFileSync(path.join(cwd, ".pi-glla", "active.jsonl"), "utf-8");
  assert.match(ledger, /forbidden_model_switch/);
  assert.match(ledger, /session-last-resort/);
  void session;
});

test("drafter keeps a configured current primary so its fallback remains reachable", () => {
  const { ctx, session, backup } = fakeContext();
  const resolved = resolveDrafterModel(ctx, {
    drafterModel: "test/session",
    drafterModelFallbacks: ["test/backup"],
    forbiddenModels: [],
  });
  assert.equal(resolved.selected?.model, session);
  assert.deepEqual(resolved.candidates.map((candidate) => candidate.ref), ["test/session", "test/backup"]);
});

test("settings expose drafting-only primary and fallback controls", () => {
  const rows = buildSettingsRows({
    drafterModel: "test/primary",
    drafterModelFallbacks: ["test/backup"],
  } as Settings, {
    drafterModel: { value: "test/primary", source: "global" },
    drafterModelFallbacks: { value: ["test/backup"], source: "global" },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(byId.get("drafterModel")?.valueText, "test/primary · session thinking");
  assert.equal(byId.get("drafterThinkingLevel"), undefined, "thinking is selected with the model, not as a standalone row");
  assert.equal(byId.get("drafterModelFallbacks")?.valueText, "1/10 · 1. test/backup · session thinking");
  assert.match(byId.get("drafterModelFallbacks")!.description, /ordered and deselectable/);
});

test("drafting recovery stays on the dedicated chain and uses the existing interview", () => {
  const queueSource = fs.readFileSync("extensions/loops/goal-list-queue.ts", "utf8");
  const activationSource = fs.readFileSync("extensions/loops/goal-activation.ts", "utf8");
  assert.match(queueSource, /DRAFTER_RECOVERY_PROMPT/);
  assert.match(queueSource, /drafter_model_fallback_exhausted/);
  assert.match(queueSource, /drafter_model_retry/);
  assert.match(queueSource, /draftingModelRestoreInFlight/);
  assert.match(queueSource, /originalThinkingLevel/);
  assert.match(queueSource, /applyDrafterThinkingLevel/);
  assert.match(queueSource, /Main and auditor recovery chains are unchanged/);
  assert.match(activationSource, /handleDrafterModelFailure/);
  assert.match(activationSource, /draftingTarget !== null/);
  assert.match(activationSource, /Leave the interview open/);
});

test("continuation prompt names the explicit Designer hand-off syntax", () => {
  const prompt = fs.readFileSync(path.resolve("prompts", "goal-loop-continuation.md"), "utf8");
  assert.match(prompt, /Agent: Designer/);
  assert.match(prompt, /Role: designer/);
  assert.match(prompt, /continue inline/);
});

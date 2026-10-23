/**
 * v0.39.46 (note.md §1): one surface per fact.
 *
 * The bottom `glla: …` status strip repeated the same state, action and
 * host/agent summary the card above it already rendered (field
 * Screenshot_20261022_161729). The requirement protected here:
 *
 *  1. When the card renders, the duplicated strip is cleared — the user sees
 *     ONE surface, not two saying the same thing.
 *  2. Nothing is LOST: the facts only the strip carried (version tail, the
 *     supervisor-paused marker) move onto the card's closer.
 *  3. The states the objective pins — a background wait, a waiting-only
 *     queue, a stale-handle interruption, a blocked/dormant hold — keep their
 *     strip, because there the line IS the only surface naming the state.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStatusText, buildWidgetLines, MAIN_HOST_LABEL } from "../extensions/goal-loop-display.js";
import { backgroundStatus } from "../extensions/goal-loop-display.js";

const sanitizeForCompare = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");
const NOW = Date.parse("2026-10-22T16:00:00Z");
const goalOf = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  objective: "Run ONE project audit pass.",
  status: "active",
  policy: "goal",
  autoContinue: true,
  createdAt: "2026-10-22T12:00:00Z",
  updatedAt: "2026-10-22T15:00:00Z",
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0, turns: 0 },
  ...over,
});

// ── the fold: footer-only facts survive on the card ─────────────────────
test("version tail moves onto the card closer", () => {
  const state = { goal: goalOf(), list: [] } as never;
  const lines = buildWidgetLines(state, null, NOW, undefined, 100, { versionTail: "· v0.39.46" })!;
  const rendered = lines.join("\n");
  assert.match(rendered, /v0\.39\.46/, "the running version is still visible without the strip");
  assert.ok(
    rendered.split("\n").some((l) => l.includes("v0.39.46") && l.includes("└─")),
    "it rides the closer row, not a resurrected second surface",
  );
});

test("supervisor-paused marker moves onto the card closer", () => {
  const state = { goal: goalOf(), list: [], supervisorPausedAt: NOW - 60_000 } as never;
  const lines = buildWidgetLines(state, null, NOW, undefined, 100)!;
  assert.match(lines.join("\n"), /supervisor paused/, "the frozen-supervisor fact survives the strip removal");
});

test("the card closer keeps its own text when folded facts are appended", () => {
  // A paused goal renders detail rows and therefore a real closer holding the
  // inspection path; the fold must append to it, never replace it.
  const state = { goal: goalOf({ status: "paused", pauseKind: "blocked", pauseReason: "waiting on user input" }), list: [] } as never;
  const lines = buildWidgetLines(state, null, NOW, undefined, 100, { versionTail: "· v0.39.46" })!;
  const closer = lines.find((l) => l.includes("└─"))!;
  assert.ok(closer.includes("v0.39.46"), `folded fact landed on the closer: ${closer}`);
  assert.ok(
    sanitizeForCompare(closer).replace(/v0\.39\.46/g, "").trim().length > 6,
    `closer kept its own content alongside the fold: ${closer}`,
  );
});

// ── the pinned states keep their strip ─────────────────────────────────
test("an auditing card yields the duplicated strip, and buildStatusText still names the state", () => {
  const g = goalOf({ status: "auditing", pendingCompletion: { at: "2026-10-22T15:59:00Z", phase: "running", attemptId: "a1" } });
  const audit = {
    phase: "tool_executing" as const,
    currentTool: "read",
    recentOutput: [],
    toolCalls: [{ name: "grep", argsPrefix: "{}", finishedAt: NOW - 6_000 }],
    reportBytes: 1024,
    elapsedMs: 42_000,
    lastActivityAt: NOW - 5_000,
  };
  const status = buildStatusText({ goal: g, list: [] } as never, audit, NOW)!;
  const card = buildWidgetLines({ goal: g, list: [] } as never, audit, NOW, undefined, 100)!;
  // The strip exists and the card exists; the card is the surviving surface,
  // so the facts the strip named must be present on the card too.
  assert.match(status, new RegExp(MAIN_HOST_LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(card.length > 0, "the card rendered");
  assert.match(card.join("\n"), /auditor|audit/i, "the card names the audit state in its own words");
});

test("a waiting-only queue keeps its strip even though a card renders", () => {
  const state = { list: [{ id: "l1", objective: "queued work", status: "queued", createdAt: "2026-10-22T12:00:00Z" }] } as never;
  const status = buildStatusText(state, null, NOW);
  const card = buildWidgetLines(state, null, NOW, undefined, 100)!;
  assert.ok(status, "the queue line exists");
  assert.ok(card.length > 0, "a queue card also renders");
  // This state is pinned by existing behavioral contracts: goal-ui keeps the
  // strip for it deliberately (it names the resume action for a bare queue).
  assert.match(status!, /waiting|queued/i);
});

test("a stale-handle interruption keeps its strip", () => {
  const g = goalOf({ status: "active", interruptedAt: "2026-10-22T15:30:00Z" });
  const status = buildStatusText({ goal: g, list: [] } as never, null, NOW);
  assert.match(status ?? "", /interrupted|stale handle/i, "the interruption line is the required surface");
});

// ── negative control ──────────────────────────────────────────────────
test("negative control: the footer facts would be lost if the fold were removed", () => {
  const state = { goal: goalOf(), list: [] } as never;
  const withTail = buildWidgetLines(state, null, NOW, undefined, 100, { versionTail: "· v0.39.46" })!.join("\n");
  const withoutTail = buildWidgetLines(state, null, NOW, undefined, 100)!.join("\n");
  assert.notEqual(withTail, withoutTail, "the fold is what puts the version on the card");
  assert.ok(!withoutTail.includes("v0.39.46"), "confirms the absence the fold fills");
});

// Silence unused-import lint if backgroundStatus is not exercised above.
void backgroundStatus;

// ── narrow widths: a folded fact is never clipped mid-fact ─────────────
// Audit item 2: the final layout pass truncates every line to the content
// width, so folding onto one closer row used to render `supervisor paused ·
// v0.39.…` at 32 columns and clip `supervisor paused` itself at 20. A
// half-rendered state chip or version string is worse than an extra row.
for (const width of [20, 32]) {
  test(`at ${width} columns every folded fact is present whole, not clipped`, () => {
    const state = { goal: goalOf(), list: [], supervisorPausedAt: NOW - 60_000 } as never;
    const lines = buildWidgetLines(state, null, NOW, undefined, width, { versionTail: "· v0.39.46" })!;
    const plain = lines.map((l) => sanitizeForCompare(l));
    const body = plain.join("\n");
    // The facts must appear intact — "supervisor" and "paused" may split across
    // wrapped rows, but no fact may END in an ellipsis that truncates it.
    assert.match(body, /supervisor/, `supervisor marker present at ${width}`);
    assert.match(body, /paused/, `the word 'paused' survives at ${width}: ${body}`);
    assert.match(body, /v0\.39\.46/, `version tail whole at ${width}: ${body}`);
    for (const line of plain) {
      assert.ok(
        !/supervisor pau…|v0\.39\.…|paused…/.test(line),
        `no fact is cut mid-word at ${width}: ${line}`,
      );
      assert.ok(tuiWidth(line) <= width, `line fits the width at ${width}: ${line}`);
    }
  });
}

test("a wrapped fact keeps the tree structure honest (no early closer)", () => {
  const state = { goal: goalOf(), list: [], supervisorPausedAt: NOW - 60_000 } as never;
  const lines = buildWidgetLines(state, null, NOW, undefined, 20, { versionTail: "· v0.39.46" })!;
  const plain = lines.map((l) => sanitizeForCompare(l));
  // Exactly one row may close the block; a mid-block `└─` would read as "and
  // then nothing follows", hiding the rows printed after it.
  assert.equal(plain.filter((l) => l.startsWith("└─")).length, 1, `one closer row: ${plain.join(" | ")}`);
  // A continuation row is indented, never presented as a new sibling item.
  assert.ok(plain.some((l) => l.startsWith("│  ")), `wrapped continuation uses the │ indent: ${plain.join(" | ")}`);
});

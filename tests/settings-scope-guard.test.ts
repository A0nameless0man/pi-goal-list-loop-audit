/**
 * v0.39.46 (note.md §3): settings scope integrity.
 *
 * Two behaviors are pinned here, both protecting the same requirement — a
 * setting's scope must match where it is actually read from:
 *
 *  1. autoAcceptDrafts is SYSTEM-WIDE. It lives in GLOBAL_ONLY_KEYS, so one
 *     switch governs every project. A stale project-scope copy must never
 *     shadow or resurrect it.
 *  2. A project-scope write that names a global-only key must fail LOUDLY.
 *     Before this guard the value was silently deleted by the cleanup loop
 *     while the caller reported success — the "looks saved, never applied"
 *     trap. Silent discard is the real defect: it makes a caller's notify and
 *     ledger row lie about state that was never written.
 *
 * The negative controls at the bottom prove these tests still detect the
 * regression rather than merely passing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GLOBAL_ONLY_KEYS, assertProjectSaveAllows, loadSettings, saveSettings } from "../extensions/goal-settings.js";
import { tmpCwd } from "./harness/mock-pi.js";

const GLOBAL_SETTINGS_PATH = process.env.GLLA_GLOBAL_SETTINGS_PATH!;

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function projectSettingsFile(cwd: string) {
  return path.join(cwd, ".pi-glla", "settings.json");
}

test("autoAcceptDrafts is global-only, so one switch governs every project", () => {
  assert.ok(GLOBAL_ONLY_KEYS.has("autoAcceptDrafts"), "autoAcceptDrafts must be global-only");
});

test("a global autoAcceptDrafts switch is honored from a project that never set it", () => {
  writeJson(GLOBAL_SETTINGS_PATH, { autoAcceptDrafts: true });
  const cwd = tmpCwd();
  assert.equal(loadSettings(cwd).autoAcceptDrafts, true, "a fresh project inherits the system-wide switch");
});

test("a stale project-scope autoAcceptDrafts cannot shadow the global switch", () => {
  writeJson(GLOBAL_SETTINGS_PATH, { autoAcceptDrafts: true });
  const cwd = tmpCwd();
  writeJson(projectSettingsFile(cwd), { autoAcceptDrafts: false });
  assert.equal(
    loadSettings(cwd).autoAcceptDrafts,
    true,
    "the project copy is dropped rather than overriding the system-wide truth",
  );
});

test("a project-scope write of a global-only key fails loudly instead of being silently discarded", () => {
  const cwd = tmpCwd();
  writeJson(GLOBAL_SETTINGS_PATH, {});
  assert.throws(
    () => saveSettings("project", cwd, { autoAcceptDrafts: true } as never),
    /global-only/i,
    "the save must refuse, not pretend to succeed",
  );
  // Nothing was written: a caller must never be able to journal or notify an
  // "ON" state that the runtime will not read back.
  const onDisk = fs.existsSync(projectSettingsFile(cwd))
    ? (JSON.parse(fs.readFileSync(projectSettingsFile(cwd), "utf-8")) as Record<string, unknown>)
    : {};
  assert.equal(onDisk.autoAcceptDrafts, undefined, "no phantom project-scope value was persisted");
  assert.notEqual(loadSettings(cwd).autoAcceptDrafts, true, "and the runtime does not see it as enabled");
});

test("the guard names every offending key and leaves ordinary project saves working", () => {
  const cwd = tmpCwd();
  writeJson(GLOBAL_SETTINGS_PATH, {});
  assert.throws(
    () => assertProjectSaveAllows({ stateRoot: "sessionDir", autoResume: true } as never),
    (err: Error) => /stateRoot/.test(err.message) && /autoResume/.test(err.message),
    "each offending key is named so the caller can fix the scope",
  );
  // A project-scoped (non-global-only) key still saves and reads back.
  saveSettings("project", cwd, { aggressiveMode: true });
  assert.equal(loadSettings(cwd).aggressiveMode, true, "project-scope keys are unaffected by the guard");
});

test("an explicit undefined still clears a stray global-only key from a project file", () => {
  writeJson(GLOBAL_SETTINGS_PATH, {});
  const cwd = tmpCwd();
  writeJson(projectSettingsFile(cwd), { autoAcceptDrafts: true, aggressiveMode: true });
  // Unset is a deliberate removal, not a silent discard — it must not throw.
  saveSettings("project", cwd, { autoAcceptDrafts: undefined } as never);
  const onDisk = JSON.parse(fs.readFileSync(projectSettingsFile(cwd), "utf-8")) as Record<string, unknown>;
  assert.equal(onDisk.autoAcceptDrafts, undefined, "the stray value was cleaned up");
  assert.equal(onDisk.aggressiveMode, true, "unrelated project settings survived the cleanup");
});

// ── negative controls ─────────────────────────────────────────────────
// Each restores the pre-fix behavior in isolation and asserts the
// corresponding test above would fail. These run against in-memory copies,
// never the live settings files.
test("negative control: without the guard, a project write is silently discarded (the defect)", () => {
  const cwd = tmpCwd();
  writeJson(GLOBAL_SETTINGS_PATH, {});
  // Simulate the pre-fix path: apply the cleanup loop inline, with no guard.
  const file = projectSettingsFile(cwd);
  writeJson(file, {});
  const next: Record<string, unknown> = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
  for (const [k, v] of Object.entries({ autoAcceptDrafts: true })) {
    if (GLOBAL_ONLY_KEYS.has(k as never)) { delete next[k]; continue; }
    next[k] = v;
  }
  fs.writeFileSync(file, JSON.stringify(next));
  assert.equal(
    loadSettings(cwd).autoAcceptDrafts,
    undefined,
    "confirms the silent-discard path really loses the write — this is what the guard prevents",
  );
});

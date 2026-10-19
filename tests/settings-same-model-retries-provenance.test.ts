// pi-goal-list-loop-audit — v0.39.40
// tests/settings-same-model-retries-provenance.test.ts
//
// Audit 2026-10-19 (docs review): `mainModelSameModelRetries` is a real
// settings key — declared on the Settings interface, listed in
// GLOBAL_ONLY_KEYS, defaulted, validated, and given its own row in the
// /glla "main-agent" section — but it was missing from SETTINGS_KEYS, the
// provenance registry that every menu row reads its VALUE and SOURCE from.
//
// The consequence was a lie in the UI: the row rendered the built-in
// default (10) with the source "default" even when the global settings
// file set a different number. A sibling key (mainModelRetryMinutes) was
// tracked correctly, so the defect was invisible unless you compared two
// rows.
//
// This pins the contract: a key that has a menu row and a global-only
// declaration must be provenance-tracked, and the row must then show the
// configured value with the configured source.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { SETTINGS_KEYS, settingsProvenance } from "../extensions/goal-settings.ts";
import { buildSettingsRows } from "../extensions/settings-menu.ts";

/** Point the global settings layer at a throwaway file for the test. */
function withGlobalSettings(settings: Record<string, unknown>): { cwd: string; cleanup: () => void } {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "glla-same-model-retries-"));
  const globalPath = path.join(cwd, "global-settings.json");
  fs.writeFileSync(globalPath, JSON.stringify(settings));
  const previous = process.env.GLLA_GLOBAL_SETTINGS_PATH;
  process.env.GLLA_GLOBAL_SETTINGS_PATH = globalPath;
  return {
    cwd,
    cleanup: () => {
      if (previous === undefined) delete process.env.GLLA_GLOBAL_SETTINGS_PATH;
      else process.env.GLLA_GLOBAL_SETTINGS_PATH = previous;
      fs.rmSync(cwd, { recursive: true, force: true });
    },
  };
}

test("mainModelSameModelRetries is a provenance-tracked settings key", () => {
  assert.ok(
    SETTINGS_KEYS.includes("mainModelSameModelRetries"),
    "mainModelSameModelRetries is missing from SETTINGS_KEYS, so its menu row cannot report a real value or source",
  );
});

test("the same-model-retries row shows the configured global value and source", () => {
  const { cwd, cleanup } = withGlobalSettings({ mainModelSameModelRetries: 7, mainModelRetryMinutes: 3 });
  try {
    const prov = settingsProvenance(cwd);
    assert.deepEqual(
      prov.mainModelSameModelRetries,
      { value: 7, source: "global" },
      "provenance must report the configured global value for mainModelSameModelRetries",
    );

    const rows = buildSettingsRows({} as never, prov as never);
    const row = rows.find((r) => r.id === "mainModelSameModelRetries");
    assert.ok(row, "the /glla main-agent section has a same-model-retries row");
    assert.equal(row.valueText, "7", "the row must show the configured value, not the built-in default");
    assert.equal(row.sourceText, "global", "the row must show the configured source, not \"default\"");
  } finally {
    cleanup();
  }
});

test("the same-model-retries row still falls back to the default when nothing is configured", () => {
  const { cwd, cleanup } = withGlobalSettings({});
  try {
    const prov = settingsProvenance(cwd);
    const rows = buildSettingsRows({} as never, prov as never);
    const row = rows.find((r) => r.id === "mainModelSameModelRetries");
    assert.ok(row, "the /glla main-agent section has a same-model-retries row");
    assert.equal(row.sourceText, "default", "an unconfigured key must report the default source");
  } finally {
    cleanup();
  }
});

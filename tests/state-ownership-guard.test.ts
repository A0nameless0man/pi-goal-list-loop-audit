// 2026-10-11 audit: goal-state.ts owns the state object identity; every other
// module must mutate in place (replaceState). A wholesale `state = …`
// reassignment outside goal-state.ts reintroduces the 2026-08-09 freeze.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const DIRS = ["extensions", "extensions/loops"];
const OWNER = path.join("extensions", "goal-state.ts");

test("no wholesale state reassignment outside goal-state.ts", () => {
  const offenders: string[] = [];
  for (const dir of DIRS) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".ts")) continue;
      const rel = path.join(dir, file);
      if (rel === OWNER) continue;
      const lines = fs.readFileSync(rel, "utf8").split("\n");
      lines.forEach((line, i) => {
        const code = line.split("//")[0] ?? "";
        if (/(^|[\s;{}()])state\s*=(?![=>])/.test(code) && !/\b(const|let|var)\s+state\s*=/.test(code)) {
          offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
  }
  assert.deepEqual(offenders, [], `wholesale state reassignments found:\n${offenders.join("\n")}`);
});

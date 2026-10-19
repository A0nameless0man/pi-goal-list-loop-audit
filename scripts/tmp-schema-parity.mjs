// TEMP — schema/runtime type parity sweep (not a committed test)
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas/goal.schema.json"), "utf8"));

function jsonType(prop) {
  if (!prop || typeof prop !== "object") return "?";
  if ("type" in prop) {
    const t = prop.type;
    return Array.isArray(t) ? t.join("|") : t;
  }
  if ("$ref" in prop) return "ref";
  if ("oneOf" in prop || "anyOf" in prop) return "union";
  if ("enum" in prop) return "enum";
  return "?";
}

/** Normalise a TS type expression to a coarse kind. */
function tsKind(ts) {
  const t = ts.trim().replace(/\s*\|.*$/, "").replace(/\?$/, "").trim();
  if (/^"[^"]*"$/.test(t)) return "string";
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  if (/\[\]$/.test(t) || /^Array</.test(t)) return "array";
  if (t === "null" || t === "undefined") return "null";
  if (/^(Record<|Partial<|\{|Readonly)/.test(t)) return "object";
  if (t === "unknown" || t === "any") return "any";
  return "object";
}

function kindCompatible(jsonT, ts) {
  const k = tsKind(ts);
  if (jsonT === "string") return k === "string";
  if (jsonT === "boolean") return k === "boolean";
  if (jsonT === "integer" || jsonT === "number") return k === "number";
  if (jsonT === "array") return k === "array";
  if (jsonT === "object") return k === "object" || k === "array" || k === "any";
  return true; // ref / union / enum — not comparable mechanically
}

function interfaceFields(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const start = src.search(new RegExp(`(?:export\\s+)?interface\\s+${name}\\b`));
  if (start < 0) return null;
  const open = src.indexOf("{", start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  const body = src.slice(open + 1, i);
  const fields = new Map();
  for (const line of body.split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:\s*(.+?);?\s*$/.exec(line);
    if (m && !/^\s*\/\//.test(line) && !/^\s*\[/.test(line)) {
      fields.set(m[1], m[3].replace(/;$/, "").trim());
    }
  }
  return fields;
}

const MAPPINGS = [
  ["pendingCompletion", "extensions/goal-loop-core.ts", "PendingCompletion"],
  ["auditVerdict", "extensions/goal-loop-core.ts", "AuditVerdict"],
  ["backgroundWait", "extensions/work-lifecycle.ts", "BackgroundWait"],
  ["objectiveProvenance", "extensions/goal-loop-core.ts", "ObjectiveProvenance"],
  ["subagentQuotaEvidence", "extensions/quota-retry.ts", "SubagentQuotaEvidence"],
  ["solutionJudgment", "extensions/durable-solution.ts", "SolutionJudgment"],
];

let issues = 0;
for (const [defName, file, iface] of MAPPINGS) {
  const def = schema.definitions?.[defName];
  if (!def) { console.log(`SKIP ${defName}: no schema definition`); continue; }
  const fields = interfaceFields(file, iface);
  if (!fields) { console.log(`SKIP ${defName}: interface ${iface} not found in ${file}`); continue; }
  for (const [prop, spec] of Object.entries(def.properties ?? {})) {
    const ts = fields.get(prop);
    if (ts === undefined) continue;
    const jt = jsonType(spec);
    if (!kindCompatible(jt, ts)) {
      issues++;
      console.log(`MISMATCH ${defName}.${prop}: schema says "${jt}" but runtime says "${ts}"  (${file} ${iface})`);
    }
  }
  // runtime fields absent from the schema (allowed, but worth listing)
  const schemaProps = new Set(Object.keys(def.properties ?? {}));
  const missing = [...fields.keys()].filter((f) => !schemaProps.has(f));
  if (missing.length) console.log(`  (not in schema, allowed) ${defName}: ${missing.join(", ")}`);
}
console.log(`\nTOTAL TYPE MISMATCHES: ${issues}`);

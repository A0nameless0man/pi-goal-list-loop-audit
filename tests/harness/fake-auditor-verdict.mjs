// pi-goal-list-loop-audit — v0.39.45
// tests/harness/fake-auditor-verdict.mjs
//
// The fake auditor workers the test suite spawns must SIGN their result the
// way the real worker does. Since v0.39.45 the parent ignores a result file
// that does not authenticate under the per-attempt verdict key it handed the
// worker over fd 3 (extensions/goal-loop-auditor-process.ts) — a result
// dropped in the job dir by anything other than our worker (the auditor
// child runs with bash inside the audited project) is not a verdict.
//
// The signature algorithm must match the parent's byte for byte: HMAC-SHA256
// over the canonical JSON of the result payload without the signature
// field, with the key as the raw ASCII hex string.

import { createHmac } from "node:crypto";
import { createReadStream } from "node:fs";

/** The same canonical JSON the parent's stableJson produces. */
export function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

/** Read the per-attempt verdict key the parent wrote to fd 3. Absent key
 * (a worker spawned outside the parent) leaves the result unsigned. */
export async function readVerdictKey() {
  try {
    const chunks = [];
    for await (const chunk of createReadStream(null, { fd: 3 })) chunks.push(chunk);
    const key = Buffer.concat(chunks).toString("utf8").trim();
    return key.length >= 32 ? key : undefined;
  } catch {
    return undefined;
  }
}

/** Sign a result payload the way the real worker does. */
export function signVerdict(result, key) {
  if (!key) return result;
  const { verdictMac: ignored, ...payload } = result;
  return { ...result, verdictMac: createHmac("sha256", key).update(stableJson(payload), "utf8").digest("hex") };
}

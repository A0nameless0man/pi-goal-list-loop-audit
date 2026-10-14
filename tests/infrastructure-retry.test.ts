import { test } from "node:test";
import assert from "node:assert/strict";
import { nextInfrastructureRetry, sanitizeInfrastructureRetry, infrastructureRetryDelay } from "../extensions/infrastructure-retry.js";
import { respecAuditStatus } from "../extensions/respec-builder-ui.js";
import { createRespecBuilder } from "../extensions/respec-builder.js";

test("infrastructure envelope sanitizes scope, deadlines, counts and unknown sensitive fields", () => {
  const retry = nextInfrastructureRetry("claim", "auth", 10000);
  assert.deepEqual(sanitizeInfrastructureRetry({ ...retry, token: "secret" }, "claim"), retry);
  assert.equal(sanitizeInfrastructureRetry(retry, "other-claim"), undefined);
  for (const bad of [NaN, Infinity, -1, "date"]) assert.equal(sanitizeInfrastructureRetry({ ...retry, nextRetryAt: bad }, "claim"), undefined);
  assert.equal(sanitizeInfrastructureRetry({ ...retry, nextRetryAt: 9999 }, "claim"), undefined);
  assert.equal(sanitizeInfrastructureRetry({ ...retry, failureClass: "approval" }, "claim"), undefined);
  assert.equal(sanitizeInfrastructureRetry({ ...retry, failures: Infinity }, "claim")!.failures, 1);
  const saturated = nextInfrastructureRetry("claim", "config", 20000, { ...retry, failures: 1000000 });
  assert.equal(saturated.failures, 1000000);
  assert.equal(saturated.nextRetryAt, 320000);
  assert.equal(infrastructureRetryDelay(saturated, 330000), 0);
  assert.equal(nextInfrastructureRetry("new-claim", "transport", 20000, saturated).failures, 1);
});

test("project status reports durable no-verdict auth wait without claiming a live worker", () => {
  const builder = { ...createRespecBuilder("project"), phase: "auditing" as const,
    audit: { attemptId: "claim", revision: 0, requirementIds: [], claim: "implemented", at: "date",
      infrastructureRetry: nextInfrastructureRetry("claim", "auth", 10000) } };
  const status = respecAuditStatus(builder, 11000);
  assert.match(status, /no verdict.*auth unresolved.*automatic retry in/);
  assert.doesNotMatch(status, /running|approved/);
  assert.match(respecAuditStatus(builder, 16000), /retry due/);
});

import { safeDiagnostic } from "../extensions/safe-diagnostic.js";
test("retry sanitizer re-redacts legacy prose, bounds controls and excludes objects/stacks", () => {
  const secret = "SENSITIVE_VALUE_123";
  for (const text of [
    `HTTP 401: API-key=${secret}; model denied`,
    `Authorization: Bearer ${secret}; scope export denied`,
    `access_token="${secret}" password='${secret}' token=${secret} refresh-token=${secret}`,
    `https://user:${secret}@host/path?X-Amz-Signature=${secret}&access_token=${secret}`,
    `[DRACON_SECRET:YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IFgyNTUxOSBMQ1YxSW94ekFtR3NoVlhzM3BON253WmxRKzBnUC9xSWd6YkdqSGJXZjBBCnZycEV5ZXR2Wi9GSU42cmhOdWtyRkZDa0NqMUFiVG1mWGpJYUkzaXBzczAKLT4gWDI1NTE5IGt5ZGVncEMza0lvMjB4blducllwdTNQenl5OFlGZzIvR1ZkdUJxMkdnQ0UKVGs4K09JZ09VNkZZdFgzK0puSWxDa1VyY3V2UjJQWXhuYVk0bnlKQXBHWQotPiBYMjU1MTkgSWtNNGg1SmR6dmIxNUx1dkxUeXpaZ2N4d2NXeEZKUjRxeEFXSDlBTVFIawpLTDlCeEw2Q1NaQzEyMGYvaTZHVlFKNHFubDA1ZGZuaE9PeFB3TjlwalFFCi0+IFgyNTUxOSBvaXFzakJFKzE3VTRCRTRTMVRFbEkyOXNFUCtoeitibUdENHlLb1dwVEFzClVmaE5kUk5HdVZ3eE5zYm9DemhNVmRyMVo2RlVlTDVVVlVva1dQendCcjgKLT4gWDI1NTE5IHRyRnFITkdaa3FUb1lscHpiNWR6T2dMUW8wQWl2VFhQb09aQ09SMEUzWG8KVXphektEQTNpU3cyZnFmdXczVHVOanhxdys0b0UzcWpKMTJMelpKYmhGZwotPiBQSy1ncmVhc2UgaFoodlogcidWCmpYRFlQUnF4UUE1R3BzSEZJTVhkQnRhT0hoYXkyVVlQQzMxMjIwSkdpZ25WNlpBQkdJd2RSS0hyCi0tLSB1OGdEUUk1bng0V2s0SGgyNmZacUw0cmFKS2JnUVlCeGN4MDdTOFdwQmhVCucBdlFHzgRfz0aoPk2yPW5O1TiAlcri45w/0ltvp8Ody70rlIbBWGqpNgMTqvJoFRjfGnOqR3wXPzB94/TLCqDYVGxlynfR/3JErDIc6kBSQ1Hkw8axRw2OosN0uaKKnD0=]\nmodel configuration missing`,
    `Bearer ${secret} sk-${secret} secret=${secret}`,
    `Authorization: Basic ${secret}; endpoint denied`,
    `password="${secret} secret with spaces`,
    `https://host/path?signature=${secret}#token=${secret}`,
    `{"message":"HTTP 403 model export denied","headers":{"Authorization":"Bearer ${secret}"}}`,
  ]) {
    const retry = sanitizeInfrastructureRetry({ ...nextInfrastructureRetry("claim", "auth", 10), diagnostic: text }, "claim")!;
    assert.doesNotMatch(JSON.stringify(retry), new RegExp(secret));
    assert.equal(safeDiagnostic(retry.diagnostic), retry.diagnostic, "idempotent reload projection");
  }
  assert.equal(safeDiagnostic({ message: secret }), undefined);
  assert.equal(safeDiagnostic(new Error("timeout connecting to auditor endpoint")), "timeout connecting to auditor endpoint");
  assert.equal(safeDiagnostic("Error: endpoint timeout\n    at socket (private.js:3)"), "Error: endpoint timeout");
  assert.equal(safeDiagnostic("\x1b[31mconfig\x1b[0m\x00\u202e <approved/> `missing`"), "config missing");
  assert.equal(safeDiagnostic("x".repeat(100000))!.length, 600);
  assert.equal(safeDiagnostic(""), undefined);
  assert.equal(safeDiagnostic("{bad raw payload password=secret"), "Structured error payload omitted");
});

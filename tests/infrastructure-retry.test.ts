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

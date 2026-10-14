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
    `[DRACON_SECRET:YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IFgyNTUxOSBOVlRKUGI5YVNkWnpTREdjaHc1d0ZSUGZNeEloU2JQKzBTZE9IWk5oSFRBCjh6Nzg0K1p3cXl1d0pBcmZqbWt4aFFCTzFnQVlONXdCbjZmUjQ5MGljZzgKLT4gWDI1NTE5IDA4ZGZ2MzcxbFEwNDVHWUZqRWNUVG1ITmN3clBMT214R1dTdWJHeXNjSEkKYm5JVXoxeHl4QlhRaWFBby9zQ2NkUkpIOWFrTm1BaFNSWmFJY29PVkhWbwotPiBYMjU1MTkgYU1NR2JMSTA1cVNFY1VqS3VlU1NVaERsbzAzMGpNZEdoQ2loQXVMVXVGTQpYQnUxRGpVRzEyN3J3d0FIdkdhVU5kbGY2OEJ3K1drdS82Z2NGRlR6bTlnCi0+IFgyNTUxOSB0a09uMDZuMlZwbFVlNTFXejRoZEF0cDVHWS9oZGowb3ZWRXNqZG9Uc0VJCk1BQ3RpSlBvT3RDYVpZdndGUi9LM2poa1E0V1JUbHBRQU13UERpUDJ0V1UKLT4gWDI1NTE5IGNLVEYxM1RlUjUxWnZ2MktzcWpOK2lXby9qaURDVjUyczVHYTJJU1BmRU0KcU1NWFE0dkJ6SklWNVdGNERMWk0xMVoza2dYNW0zbVBXcmV4Uzc4V1dadwotPiBDLWdyZWFzZSBmKDFAKCAzMjUgNFkKcFBZc25JUzlHQQotLS0gcmxrS3RZNlB1SFdpVzY0RDBHQm8rcFlqUXp3MmJXN0ZqRld5ZjdCcUI5awr3vv2w/Ik4Lf24DYTmRnVOGuSEW70mHV8Puv9aRRhhUsoSs6/QtkTnMyEdP4lx1F8zVBA4zBTchEzW/IUYqJ6TSDdIHLtB62979ER8tlbnSHYbutrhjJDUoQZZYQBO7B3Z]\nmodel configuration missing`,
    `Bearer ${secret} sk-${secret} secret=${secret}`,
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

// pi-goal-list-loop-audit — v0.38.104 redaction cascade budget.
//
// Field 2026-09-28 (hellhunter, screenshot 111015): the goal was at 9 reviews /
// 9 disapproved, 13/13 tasks, 96h 37m, and the TUI showed
//
//   latest audit feedback: …[provider diagnostic redacted — provider error] x5
//   Inspect auditor feedback and fix the actual gap before calling complete_goal again
//
// …with no gap visible. The report was fine: 23 659 characters with two real
// [HIGH] required fixes. sanitizeProviderAuditReport had cut it to 12 614 with
// 185 redaction tags, and latestAuditFeedback's 320-char tail fell inside the
// redacted region, so the agent was handed a wall of identical tags instead of
// the objections it was supposed to fix. A blind rework loop: 9/9 disapproved.
//
// Two causes, both structural:
//   1. `structuredLine` matches `reason:` / `message:` / `detail:` — vocabulary
//      an auditor report is full of when it QUOTES test output.
//   2. once a line is marked, `jsonDepth` follows braces through the rest of the
//      document, so a REPORT was treated as if it WERE a provider payload.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeProviderAuditReport,
  SANITIZE_MAX_REDACTION_RATIO,
  SANITIZE_MIN_REDACTION_LINES,
} from "../extensions/quota-retry.ts";

test("truncation within provider strings and escapes cannot release preceding fields", () => {
  for (const token of [
    '"HTTP 429 rate limit', '"HTTP 429 escape\\', '"HTTP 429 escape\\u0',
    '"HTTP 429 escape\\u00', '"HTTP 429 quote\\"',
  ]) {
    for (const suffix of ["", "\n## Required fixes\n1. [MED] Get user authorization."]) {
      const report = '{\n  "account": "synthetic-private-account",\n  "error": {"message": ' + token + suffix;
      const safe = sanitizeProviderAuditReport(report);
      assert.ok(!safe.includes("synthetic-private-account"), token);
      if (suffix) assert.ok(safe.includes(suffix.trimStart()));
    }
  }
});

test("truncated JSON acquires provider ownership from internal markers without releasing leading fields", () => {
  for (const opener of ["{", "[\n{", "{ incomplete excerpt\n{"]) {
    for (const marker of ['"status": 429,', '"status": 503,', '"error": {"message":"HTTP 429"},']) {
      for (const suffix of ["", "\n## Required fixes\n1. [HIGH] Get user authorization."]) {
        const report = [
          opener, '  "account": "synthetic-private-account",', marker,
          '  "organization": "synthetic-private-organization"',
        ].join("\n") + suffix;
        const safe = sanitizeProviderAuditReport(report);
        assert.ok(!safe.includes("synthetic-private-account"), `${opener}: ${marker}`);
        assert.ok(!safe.includes("synthetic-private-organization"), `${opener}: ${marker}`);
        if (suffix) assert.ok(safe.includes(suffix.trimStart()));
      }
    }
  }
});

test("all numbered audit severity findings survive truncated provider bodies and pending credentials", () => {
  for (const severity of ["HIGH", "MED", "LOW", "MEDIUM", "P0", "P1", "P2", "P3"]) {
    for (const bold of ["", "**"]) {
      const finding = `1. ${bold}[${severity}]${bold} Get user authorization; reason: ordinary test evidence.`;
      for (const prefix of ['HTTP 429\n{\n  "account": "synthetic-private-account"', "Authorization:\nBearer"]) {
        const safe = sanitizeProviderAuditReport(`${prefix}\n${finding}\n2. [HIGH] Keep findings.`);
        assert.ok(!safe.includes("synthetic-private-account"));
        assert.ok(safe.includes(finding), `${severity}, ${bold}, ${prefix}`);
        assert.ok(safe.includes("2. [HIGH] Keep findings."));
      }
    }
  }
});

test("pending provider context crosses anchored transport labels, but labels alone never claim bodies", () => {
  const finding = "1. [HIGH] Get user authorization.";
  for (const label of ["response:", "body:", "payload:", "Response body:", '"data":', "transport_result ="]) {
    for (const ending of ["}", ""]) {
      const body = [
        `${label} {`,
        '  "account": "synthetic-private-account",',
        '  "organization": "synthetic-private-organization"',
        ending, finding,
      ].join("\n");
      assert.equal(sanitizeProviderAuditReport(body), body, "labels without provider context are ordinary evidence");
      for (const gap of [[], ["", "```json"]]) {
        const report = [
          ...Array.from({ length: 40 }, () => "HTTP 503 Service Unavailable"),
          "HTTP 429", ...gap, body,
        ].join("\n");
        const safe = sanitizeProviderAuditReport(report);
        assert.ok(!safe.includes("synthetic-private-account"), label);
        assert.ok(!safe.includes("synthetic-private-organization"), label);
        assert.ok(safe.includes(finding), label);
      }
    }
  }
});

test("contract authorization findings and ordinary JSON evidence remain actionable", () => {
  // db-gateway's live report lost two HIGH required fixes merely because
  // they requested user authorization; status-shaped host evidence vanished too.
  const report = [
    "## Required fixes",
    "1. **[HIGH]** Get explicit user authorization to amend the credential grep contract.",
    "2. **[HIGH]** Line 221 needs its fixed-in reference.",
    "3. **[HIGH]** The 12 vs 13 file-count mismatch needs user authorization, not an assumed waiver.",
    "## Evidence",
    '"dg_service": { "status": "pass", "active_state": "active" }',
    "mode=local, verdict=pass, host_side.status=skipped",
    "sample reason: a test failed, not a provider payload",
  ].join("\n");
  assert.equal(sanitizeProviderAuditReport(report), report);
});

test("authorization credentials still redact in reports, including past the cascade budget", () => {
  for (const secret of [
    "Authorization: Bearer sk-private",
    '\"authorization\": \"Basic private-credential\"',
    "authorization=private-value",
    "Authorization Bearer private-value",
  ]) {
    const report = auditorReport("Get user authorization to amend the contract.", 400) + "\n" + secret;
    const safe = sanitizeProviderAuditReport(report);
    assert.ok(safe.includes("Get user authorization"));
    assert.ok(!safe.includes("private"), secret);
  }
});

test("complete provider JSON redacts fields before its marker and beyond the cascade budget", () => {
  const payload = [
    "{",
    '  "account": "private-account-before-marker",',
    '  "error": { "message": "429 rate limit" },',
    ...Array.from({ length: 30 }, (_, i) => `  "field${i}": "private-field-${i}",`),
    '  "organization": "private-organization-at-end"',
    "}",
  ].join("\n");
  const report = "## Evidence\n```json\n" + payload + "\n```\n## Required fixes\nGet user authorization to amend the test.";
  const safe = sanitizeProviderAuditReport(report);
  assert.ok(!safe.includes("private-"), "the whole provider object must stay private, not just marker-bearing fields");
  assert.ok(safe.includes("Get user authorization to amend the test."));
});

test("a fresh multiline provider payload still redacts after earlier redactions exhaust the budget", () => {
  const report = [
    ...Array.from({ length: 40 }, () => "HTTP 503 Service Unavailable"),
    "403",
    "```json",
    "{",
    '  "account": "private-late-account",',
    '  "organization": "private-late-organization"',
    "}",
    "```",
    "## Required fixes",
    "Get user authorization to amend the test.",
  ].join("\n");
  const safe = sanitizeProviderAuditReport(report);
  assert.ok(!safe.includes("private-"), "an exhausted exploratory budget must not release a later payload");
  assert.ok(safe.includes("Get user authorization to amend the test."));
});

test("split authorization credential values are not released as ordinary prose", () => {
  for (const header of ["Authorization:", '\"authorization\":']) {
    const safe = sanitizeProviderAuditReport([
      "## Evidence", header, '  "Bearer private-split-value"',
      "## Required fixes", "Get user authorization to amend the test.",
    ].join("\n"));
    assert.ok(!safe.includes("private-split-value"));
    assert.ok(safe.includes("Get user authorization to amend the test."));
  }
});

test("split credential schemes and request-id assignments protect the actual value", () => {
  for (const prefix of ["Authorization:\nBearer", "Authorization: Basic", "request_id:", "api_key:"]) {
    for (const earlier of ["", Array.from({ length: 40 }, () => "HTTP 503 Service Unavailable\n").join("")]) {
      const report = `${earlier}${prefix}\nsynthetic-private-value\n## Required fixes\nGet user authorization.`;
      const safe = sanitizeProviderAuditReport(report);
      assert.ok(!safe.includes("synthetic-private-value"), prefix);
      assert.ok(safe.includes("## Required fixes\nGet user authorization."));
    }
  }
});

test("a provider prefix expires before unrelated structured evidence", () => {
  for (const gap of ["\n\n\n\n", "\n```json\n\n\n"]) {
    const evidence = '{"status":"pass","message":"ordinary test evidence"}';
    assert.ok(sanitizeProviderAuditReport(`403${gap}${evidence}`).includes(evidence));
  }
});

test("an incomplete excerpt cannot hide a later complete provider JSON object", () => {
  for (const excerpt of ["{ incomplete excerpt", "{", "[ incomplete excerpt"]) {
    const report = [excerpt, "", "{",
      '  "account": "synthetic-private-account",',
      '  "status": 429', "}",
      "## Required fixes", "Get user authorization.",
    ].join("\n");
    const safe = sanitizeProviderAuditReport(report);
    assert.ok(!safe.includes("synthetic-private-account"), excerpt);
    assert.ok(safe.includes("Get user authorization."));
  }
});

test("labeled multiline provider payloads redact fully after budget exhaustion", () => {
  for (const label of ["HTTP 429 response: ", "Provider error (HTTP 503): ", "request_id=req-synthetic response: "]) {
    for (const suffix of ["", " trailing transport context"]) {
      const report = [
        ...Array.from({ length: 40 }, () => "HTTP 503 Service Unavailable"),
        `${label}{`,
        '  "account": "synthetic-private-account",',
        '  "organization": "synthetic-private-organization"',
        `}${suffix}`,
        "## Required fixes", "Get user authorization to amend the test.",
      ].join("\n");
      const safe = sanitizeProviderAuditReport(report);
      assert.ok(!safe.includes("synthetic-private-account"), label);
      assert.ok(!safe.includes("synthetic-private-organization"), label);
      assert.ok(safe.includes("Get user authorization to amend the test."));
    }
  }
});

test("identified provider JSON continuation stays private even when truncated or malformed", () => {
  for (const ending of ["", "}"]) {
    const report = [
      ...Array.from({ length: 40 }, () => "HTTP 503 Service Unavailable"),
      "HTTP 429 response: {",
      '  "account": "synthetic-private-account"',
      '  "organization": "synthetic-private-organization"',
      ending,
      "## Required fixes", "Get user authorization to amend the test.",
    ].join("\n");
    const safe = sanitizeProviderAuditReport(report);
    assert.ok(!safe.includes("synthetic-private-"));
    assert.ok(safe.includes("## Required fixes\nGet user authorization to amend the test."));
  }
});

test("trailing annotations after a completed payload do not consume subsequent findings", () => {
  const finding = "1. [HIGH] Get user authorization to amend the contract.";
  for (const payload of [
    'HTTP 429 response: {"account":"synthetic-private"} [unfinished citation',
    'HTTP 429 response: {\n  "account":"synthetic-private"\n} [unfinished citation',
    'HTTP 429 response: {\n  "account":"synthetic-private", "status":429\n} [unfinished citation',
    'HTTP 429 response: {"account":"synthetic-private"}\nHTTP 503 Service Unavailable',
    '{ incomplete excerpt\nHTTP 429 response: {"account":"synthetic-private"} [unfinished citation',
  ]) {
    const safe = sanitizeProviderAuditReport(`${payload}\n${finding}`);
    assert.ok(!safe.includes("synthetic-private"));
    assert.ok(safe.includes(finding), payload);
  }
});

/** The hellhunter shape: a real report quoting error-shaped test output. */
function auditorReport(requiredFixes: string, quoteLines = 120): string {
  const quotes = Array.from({ length: quoteLines }, (_, i) =>
    `  sample reason: page.evaluate: Error: dungeon walk deadline at {"x":${i}.5,"y":520.07} — gate missed`,
  ).join("\n");
  return [
    "I inspected the evidence and the harness.",
    "## Evidence",
    quotes,
    "## Required fixes",
    requiredFixes,
    "<!-- end -->",
  ].join("\n");
}

test("v0.38.104 an auditor report survives sanitizing instead of being deleted", () => {
  const fixes = "1. [HIGH] Re-run the playable loop and publish the artifact.\n2. [HIGH] Reconcile the movement fix with the evidence.";
  const report = auditorReport(fixes);
  const safe = sanitizeProviderAuditReport(report);
  assert.ok(safe.length > report.length * (1 - SANITIZE_MAX_REDACTION_RATIO),
    `kept only ${Math.round(safe.length / report.length * 100)}% of the report`);
  assert.ok(safe.includes("[HIGH] Re-run the playable loop"), "the real required fixes must survive");
  assert.ok(safe.includes("[HIGH] Reconcile the movement fix"), "both of them");
});

test("v0.38.104 the required-fixes section is always recoverable", () => {
  // The whole point: the agent is shown this section as its actionable
  // feedback. If sanitizing removes it, the rework loop is blind.
  const report = auditorReport("1. [HIGH] Close the loop and publish evidence.");
  const safe = sanitizeProviderAuditReport(report);
  const idx = safe.indexOf("Required fixes");
  assert.ok(idx >= 0, "the Required fixes header must survive");
  assert.ok(safe.slice(idx).includes("Close the loop and publish evidence"),
    "and the fixes under it");
});

test("v0.38.104 a genuine provider payload still redacts IN FULL", () => {
  // The budget bounds a cascade; it must never let a real leak through. This
  // is the case the redaction exists for.
  for (const payload of [
    '{"error":{"message":"429 rate limit, api_key sk-abc123","request_id":"req-99"}}',
    "authorization: Bearer sk-secret-token-value-here",
    '{"error":{"message":"insufficient_quota for key key-abc"}}',
  ]) {
    const safe = sanitizeProviderAuditReport(payload);
    assert.equal(safe, "[provider diagnostic redacted — provider error]", payload);
    assert.ok(!/sk-|Bearer|api_key/i.test(safe), "no secret survives: " + safe);
  }
});

test("v0.38.104 a payload-heavy blob redacts in full regardless of length", () => {
  // Long, but every line is a marked payload line — this IS a provider blob,
  // not a report, and it must be redacted rather than released by the budget.
  const blob = Array.from({ length: 60 }, (_, i) => `error: {"request_id":"req-${i}","message":"429 rate limit"}`).join("\n");
  const safe = sanitizeProviderAuditReport(blob);
  assert.ok(!/req-\d+/.test(safe), "request ids must not survive a payload blob");
});

test("v0.38.104 the budget is a real fraction with an absolute floor", () => {
  assert.ok(SANITIZE_MAX_REDACTION_RATIO > 0 && SANITIZE_MAX_REDACTION_RATIO < 1, "a ratio, not an unbounded allowance");
  assert.ok(SANITIZE_MIN_REDACTION_LINES > 0, "a short report still redacts a few lines fully");
});

test("v0.38.104 a marked line is always redacted, even after the budget", () => {
  // Past the budget only a DIRECT marker still redacts. A bare secret line is
  // a direct marker, so it cannot be released.
  const long = auditorReport("1. fix", 400);
  const withSecret = `${long}\nauthorization: Bearer sk-late-secret-should-not-survive`;
  const safe = sanitizeProviderAuditReport(withSecret);
  assert.ok(!safe.includes("sk-late-secret"), "a direct marker past the budget must still redact");
});

test("v0.38.104 a bare 5xx-shaped number is not a provider marker", () => {
  // The real over-redaction trigger: `\b5\d\d\b` matched any number 500-599,
  // so a report quoting `{"y":520.07}` was redacted line by line. A 5xx needs
  // HTTP/status context to count.
  const numbers = auditorReport("1. [HIGH] fix it", 60).replace(/Error: dungeon walk deadline/g, "step at");
  const withNumbers = numbers.replace(/520\.07/g, "520.07");
  const safe = sanitizeProviderAuditReport(withNumbers);
  assert.ok(safe.length > withNumbers.length * 0.85, "numeric report text must survive");
  assert.ok(safe.includes("[HIGH] fix it"), "and the required fixes with it");
});

test("v0.38.104 a 5xx WITH http context still redacts", () => {
  for (const raw of [
    "HTTP 503 Service Unavailable",
    '{"status":500,"message":"internal"}',
    "status_code: 500",
  ]) {
    const safe = sanitizeProviderAuditReport(raw);
    assert.equal(safe, "[provider diagnostic redacted — provider error]", raw);
  }
});

# Fresh post-release audit — 2026-10-11

## Scope and evidence

One fresh bounded audit after publishing 0.39.27. Three parallel scouts in workflow e89a8cf0-d8c5-459f-b67e-3826ee8120c9 inspected recovery ownership, status/privacy, and durability/release contracts. Budget 35 calls and 150 report lines per lane; no parent/sibling project walks. Survey was sampled, not an exhaustive clean bill. Parent read all reports and independently inspected production paths before filing.

Reports: subagent artifacts outputs/e89a8cf0-d8c5-459f-b67e-3826ee8120c9/post-release/{recovery,surfaces,contracts}.md. All three runs completed successfully. No pending supervisor requests remained. Surfaces scout disclosed running focused tests that created temporary fixtures despite the read-only brief; git tree remained unchanged by scouts. That deviation is retained, not described as mutation-free validation.

## Findings and fixes

Every new finding was appended to .pi-glla/audit-loop/findings.md, then checked only after actual source fix commits existed. DECIDE findings: none.

1. Retry budget double-consumption: failure parking and timer probes both advanced counters, allowing fallback after five actual retries instead of ten. c6337318 separates failure/cadence counting (parking) from retry admission counting (probe). d29084a3 exercises ten alternating real park/probe cycles, verifies no model selection before ten admissions, and preserves the existing exhausted-budget fallback test.
2. Pause durability: pause_goal ignored updateGoal=false, announced success and aborted an unpaused goal. c6337318 returns an error before success side effects on refusal. d29084a3 transpiles the actual tool method and tests both production-equivalent refused admission and successful admission; refusal has no pause card/notification/abort, while success retains all three.
3. Fleet privacy/terminal controls: arbitrary builder.phase was accepted and rendered verbatim. cb0d2c4b validates phases against allowed builder states and filters workflow output, including bypassed reader/injected-status cases. ebc6e9d0 uses a malicious on-disk snapshot and direct formatter injection to prove privacy and control-byte containment.

## Validation

- Focused four-file gate: 54 pass, zero failures, /tmp/glla-post-release-focused-final.log.
- Typecheck: npm run check exited zero, /tmp/glla-post-release-types2.log. Initial test-only inference error was fixed with an explicit number type, not suppressed.
- Final `timeout 1800 npm run release:check`: exit zero, 3663 pass, 1 skip, zero failures across 394 files, /tmp/glla-post-release-verified.log. Includes types, generated inventory, dry-run packing and installed launcher/RPC/skill/import smoke probes.
- First aggregate gate found three old initial-failure counter pins in context-pressure-recovery.test.ts. fb783fcd updates them to assert zero admitted retries before the durable future deadline. No actual retry/fallback checks were removed and no timeouts relaxed.
- Docs/RECOVERY.md explains single consumption; CHANGELOG.md retains these follow-up repairs under Unreleased. Inventory regenerated in 80c495aa.

## Known state

Published/install-verified release remains v0.39.27 at 54db64b021334ce7f620be5219f736a0b88672e0; see audit/RELEASE-0.39.27.md. These three post-release audit repairs are committed on main and validated, but NOT published. No new version/tag or forced running-session reload was performed during the audit.

Unfiled observations: future audit timestamps require clock rollback/injected adapter evidence; missing timestamp observations intentionally remain unconfirmed; development runner in a published installation is not a documented supported runtime contract. No demonstrated additional defect was invented from those observations.

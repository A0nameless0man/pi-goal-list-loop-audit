# Verification checkpoint — 2026-10-22 audit pass

## Contract-to-artifact checklist

| Obligation | Evidence | State |
| --- | --- | --- |
| Fresh parallel subsystem survey, bounded briefs | Original five scout reports in `scouts/`; their launch records show overlapping individual calls, NOT a single-message launch. A corrective three-scout parallel workflow was launched in one tool invocation on recovery (9f5872a2-ff8e-479b-92d1-03a3b217d352), covering release, settings and durability. | All three child reports assessed; release scout found no new defect, settings/sidecar corrections implemented and verified |
| Deduplicate and record every new finding | `.pi-glla/audit-loop/findings.md`, tracked pass mirror `../README.md`, and `../prior-findings-index.md` | 30 checked FIX rows including correction follow-ups; no open FIX or DECIDE rows in live findings at final inspection |
| Fix commits exist on current main | a0bf2969b (release), b089f1764 (model/settings), 9fe3036a0 (projection), 005056f1d and 3b8e0054c (outbox), 4253538a4 (thinking inheritance), ab8b62d7a (documentation), 51fc9a99f (auditor boundary); canary correction 250a79b97; role inheritance b264e24c3/4471ab8f5; sidecar rollback 28111809f; provenance guard fa1749dcb; capability preflight ad3c7111c and coverage/declarations ded2af54a | Inspected commit metadata and current implementations; focused checks below |
| Raise all open decisions, record answers, queue chosen work without implementing it | User answered three structured questions; live findings and `../README.md` record all three choices. `list_add` queued queued-card wording, leftOut compatibility notice, fail-closed saved-verdict recovery behind this goal | No open DECIDE rows remain |
| Keep committed task descriptions truthful | Confirm-gated task replacement retained objective/verification contract and reconciled obsolete implementation details; durable goal task projection now describes actual preservation, inheritance and event semantics | All 26 task/subtask entries marked complete through goal tools |
| Fresh-context rehearsal | `reviewer-initial.md`, `reviewer-recheck.md`, `reviewer-final.md` | Initial blockers corrected; final bounded review found no blockers in inheritance, sidecar rollback or capability-gate corrections |

## Observed verification

Logs in this directory are actual command output, not synthesized success markers.

**Final affected-scope gate:** `final-regression.log` records `timeout 900 node scripts/run-tests.mjs` naming all 19 affected/adjacent test files: **487 pass, 0 fail**, exit 0, about 438 seconds. This uses Bun 1.3.14 from an ignored repo-local `.pi/test-tools` install, matching CI; the host Bun was not changed. File isolation is supplied by the hardened runner, not assumed from bare multi-file `bun test`. `final-focused.log` separately records 110 pass, 0 fail across seven runner/settings/queue regression files. Final typecheck, inventory, and packed-runtime smoke also pass.

Capability regression coverage tolerates harmless help whitespace/prose and rejects missing flags, spelling lookalikes and failed probes. An executable stub proves unsupported capability detection prevents a suite spawn. `old-bun.log` shows the actual host Bun 1.3.3 is now rejected with exit 1 before running tests; `false-green-all.log` preserves the earlier invalid one-file success for comparison.

- `focused.log`: `timeout 600 bun test --timeout=120000` with release-contract, auditor-stall-watchdog, auditor-thinking, compactor-handoff, settings-editors, settings-menu-complete, goal-state-drift, terminal-approval-render, doc-parity, auditor-extension-fence and auditor-verdict-authentication tests: **195 pass, 0 fail**, 11 files. This preceded the final canary-expression correction.
- `release-contract.log`: `timeout 120 bun test --timeout=60000 tests/release-contract.test.ts`: **17 pass, 0 fail** after canary correction. The check accepts harmless expression whitespace and rejects the previous undefined GitHub context property.
- `runtime.log`: `timeout 600 bun test --timeout=120000 tests/auditor-process.test.ts tests/respec-builder-audit-runtime.test.ts`: **86 pass, 0 fail**.
- `typecheck.log`: `timeout 120 npm run check`: exit 0.
- `pack-smoke.log`: `timeout 240 node scripts/release-pack-smoke.mjs`: exit 0; installed runner imports, packed launcher executes a bounded RPC/challenge probe, skill loads without diagnostics.
- `inventory.log`: `timeout 90 npm run check:inventory`: exit 0 after regenerating the stale runtime inventory with `node scripts/generate-inventory.mjs`.
- `jiti.log`: `timeout 180 npm run test:jiti`: 1 pass, 0 fail.
- `extensions.log`: `timeout 180 npm run test:auditor-extensions`: exit 0; offline fixture extension actually loads by resolved path without creating an install directory.

## Limitations and deliberate boundaries

The earlier whole `test:all` attempt was terminated around its 3000-second bound during the long provider-exhaustion suite; cleanup also reported an owned process group did not stop within 250 ms after SIGKILL. That run recorded two failures before interruption: the outbox acknowledgement test subsequently repaired and covered by `focused.log`, and a runner-isolation child that hit its 30-second deadline under contention. The latter was rerun unchanged with `timeout 180 bun test --timeout=150000 tests/test-runner-isolation.test.ts`: **1 pass, 0 fail**, about 18 seconds (`isolation.log`). This isolated success does not establish a whole-suite pass. The interrupted output is retained as `interrupted-all.log`. **Neither test:all nor release:check is claimed to pass.** Focused behavioral and packaging checks above were rerun instead; no tests were weakened or skipped inside the suite. This is an audit/fix pass, not a publication claim.

Additional diagnostic runs are not counted as passing gates: `bare-broad.log` bypassed runner isolation and recorded 54 failures/10 errors; its state-contamination failures did not reproduce under the hardened runner. `runner-before-provenance-fix.log` then recorded 272 pass/1 fail: an exact-source-literal provenance guard broken by the new `persisted` field. The provenance guard was repaired without dropping either field check (fa1749dcb); `final-regression.log` reruns that test and the affected behavioral orchestrator with 0 failures. The later seven-second `--all` run under host Bun 1.3.3 was a false green, not whole-suite evidence; the new capability preflight rejects that toolchain. No full-suite rerun is claimed after the final changes.

The crash-recovery verdict-authentication risk remains in current behavior until its user-selected queued follow-up runs. Current live-worker verdict authentication is covered by the forged-result regression. The queued-card wording and schema compatibility notice are also explicit follow-ups, not implementation claims in this pass.

The corrupt outbox intentionally preserves bytes and refuses replacement until operator repair; quarantine-and-reset would discard unknown pending delivery obligations. Explicit auditor thinking inheritance clears pins from both settings scopes; no new tombstone representation was introduced. These differences from the old plan were durably reconciled before task closure, not silently marked satisfied under obsolete wording.

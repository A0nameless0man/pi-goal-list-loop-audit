# Fail-closed saved audit verdict recovery

## Requirement-to-artifact checklist

- **Decline verdicts after launching-key loss:** `readCompletedCompletionAudit` in `extensions/goal-loop-auditor-process.ts` now requires an in-memory launching key (`verdict-key-unavailable` rejection) and a matching string MAC (`verdict-mac` rejection). Request hashes still bind identity, not authority. Missing signatures no longer bypass authentication even with a cached key.
- **Preserve work:** rejection returns null before semantic settlement/cancellation. It leaves the goal/claim and saved result untouched; only a best-effort rejection ledger entry is appended. The existing caller retains normal recovery/retry policy. No key is persisted or loaded from job artifacts.
- **Re-audit, not replay:** real detached worker tests publish authenticated approved/disapproved results, forget the launching key, reject those results, restore twice without settling or dispatching, then use manual/agent resume to run a new detached audit. The new worker reports the opposite verdict, and only that new verdict settles. Tests verify pending claim summaries, task list, queued work, implementation bytes, and prior result bytes survive the lost-key restore; old result and implementation bytes also survive rerun.
- **Retain safe same-process recovery:** existing recovery fixtures now explicitly model a retained launching key and signed result. Their semantic checks still exercise claim/revision/tool-floor/shield/challenge validation, rather than accidentally stopping at authentication. Test-only key registration does not read live keys or write secrets to disk.
- **Missing-key/signature/tamper regressions:** approved/disapproved/impossible without a key; cached key with missing/wrong MAC or modified output; authenticated real-worker result while its key is retained.
- **Document behavior:** Unreleased changelog explains lost-key re-audit and cold-restore consent. No scheduler, cryptographic format, persisted-key storage, schema or external-code changes.

## Observed gates

Commands ran from the repository root with Bun **1.3.14**, provided by the ignored repo-local test-tool installation (host Bun was not changed):

```sh
export PATH="/home/dracon/Dev/pi-plugins/pi-goal-list-loop-audit/.pi/test-tools/node_modules/@oven/bun-linux-x64/bin:$PATH"
timeout 360 node scripts/run-tests.mjs tests/completed-audit-recovery.test.ts tests/auditor-verdict-authentication.test.ts tests/auditor-process.test.ts
timeout 180 node scripts/run-tests.mjs tests/audit-recovery-persistence.test.ts tests/load-hold-release.test.ts tests/respec-builder-audit-runtime.test.ts
timeout 120 npm run check
timeout 90 npm run check:inventory
```

- `focused.log`: 101 pass, 0 fail; hardened runner exit 0.
- `adjacent.log`: 38 pass, 0 fail; hardened runner exit 0.
- `typecheck.log`: exit 0, no diagnostics.
- `inventory.log`: exit 0 after regenerating runtime inventory for the new test-only export.
- `harmless.log`: isolated copies pretty-print signed JSON; all 48 recovery tests pass. Serialization whitespace is not a contract.
- `negative.log`: restoring the old conditional authentication bypass in an isolated source copy fails six targeted regressions (both real-worker key-loss cases, missing-key approved/disapproved/impossible and cached-key missing-MAC), while 42 pass. No production mutation; disposable copy removed.
- `reviewer.md`: fresh-context source/diff review found no blockers. Reviewer inspected parent logs but had no command execution tool; no independent rerun is asserted.

Implementation diff is retained in `process.diff`; other changes are the recovery tests, changelog and generated inventory. No full-suite or live installed-host restart test is claimed. Real detached fixture workers execute the actual worker transport/signing and recovery lifecycle under the mock host.

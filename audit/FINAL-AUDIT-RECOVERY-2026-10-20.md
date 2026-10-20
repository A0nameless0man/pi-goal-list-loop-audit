# Final audit fallback recovery — 20 October 2026

## Report and ownership

Input: `pi-session-2026-10-19T21-50-52-934Z_01a15625-6205-7352-a718-2215de005bb0.html`, decoded embedded session entries 213–264. The user reports projects stuck in final audit and clarifies that a preferred smarter auditor should fall back to the session model when unavailable. Independent auditing requires an isolated session; a different model is optional.

Provider quota exhaustion is external and is not repaired here. GLLA owns recovery cursor persistence, detached worker termination through public RPC events, candidate ordering and provider-failure pruning. No other project's runtime state, provider, Pi core or plugin was changed. No release or publication was requested.

## Changes

- Both context-bound and context-free recovery parking preserve exhausted predecessors, the current fallback and the durable marker of an already-launched second attempt. Legacy attempted lists release only the interrupted first-attempt ref. Fully exhausted cycles still use the existing bounded recovery schedule and fresh-cycle admission.
- Provider failures may collapse configured backups on that provider, but cannot mark an untried permitted session fallback exhausted. Resolved candidates retain session identity even when the session model was explicitly listed as a fallback (qualified or bare name) with same-session swap disabled. Forbidden models remain excluded and duplicate refs remain deduplicated.
- The worker returns quota/rate-limit/billing RPC errors promptly rather than staying in Pi's internal retry stream. Parent classification recognizes account wording without an HTTP status. Candidate exhaustion is journaled before immediately advancing, without sleeping the unavailable account's reset/backoff interval.
- Transient and silent-worker failures retain the bounded retry/watchdog behavior. Configured model preferences and the explicit same-session-swap option remain intact. An exhausted ladder produces infrastructure recovery, never an approval or disapproval.

No account-wide permanent eviction was introduced: bypass is durable for the current candidate walk, and fully exhausted cycles are reconsidered by the existing recovery scheduler. This does not claim that every provider reset format is understood or that already-running installations loaded the new source.

## Verification

The initial focused suite passed **136 tests across four files**. After the explicit-session-pin follow-up, the resolver/policy/backstop checks passed **57 tests across four files** and the complete settlement/fence suite passed **10 tests**. Current-source `npm run check` passed. Loader compatibility, offline auditor extension isolation, inventory, pack inspection and the installed-tarball audit/skill smoke checks passed separately; see [package checks](final-audit-recovery-2026-10-20/package-checks.log). The worker cases cover structured 429, prose-only retry-start and assistant error messages; all return provider infrastructure failures. Recovery cases read the durable projection and feed its cursor into the production walker, covering both parking entry points and interruption before/after the authorized retry launch.

Five negative controls run only in a disposable repository copy. The unmodified selected tests pass (13 tests); each mutation fails:

1. Clearing the cursor loses the failed preferred auditor and fallback selection.
2. Removing the session-tail exemption skips the working same-provider session model.
3. Dropping resolved session identity skips a session model explicitly listed as a configured fallback when same-session swap is disabled.
4. Disabling immediate account advancement retries/sleeps instead of reaching the session promptly.
5. Disabling worker account-error handling leaves the synthetic retry stream running and fails the bounded worker test.

A harmless helper rename across the worker, parent and declarations still passes the selected behavior checks (10 tests). The hourly-backstop test now checks actual provider pruning and session fallback instead of requiring the old inline matcher symbol.

Evidence: [focused log](final-audit-recovery-2026-10-20/focused.log), [control outcomes](final-audit-recovery-2026-10-20/controls.json), control logs in the same directory, and [reviewed source hashes](final-audit-recovery-2026-10-20/reviewed-sha256.json).

## Broad gate follow-up

A first full run finished with **4,188 pass, one skip, ten fail across 459 files**. It included a stale assertion requiring the moved inline quota matcher, two audit-exhaustion timeouts, a stale-host timeout and later lifecycle/fan-out failures. The audit-exhaustion/backstop checks subsequently passed together (four tests); stale-host/fan-out cases passed together (six tests), under their existing limits.

The retry-waiting tests also reproduced 60-second timeouts alone. Inspection established that these fence tests launched the installed Pi against the nonexistent `anthropic/mock-model`, coupling a GLLA guard test to external host/provider behavior. They now run the real GLLA detached worker against a local RPC peer, and require an actual prompt receipt, audit dispatch and adopted disapproval. Both live-claim cases and the complete ten-test file pass. No Pi/provider code or time limits were changed. This repair closes the external dependency and strengthens the prior assertions, which could pass without a successful worker execution.

The observed host load reached 62 during the first run; this is context, not proof that every failure was caused by load. Failed results are retained in [first-run summary](final-audit-recovery-2026-10-20/release-first-run-summary.log), [lifecycle recheck](final-audit-recovery-2026-10-20/lifecycle-recheck.log), [other lifecycle recheck](final-audit-recovery-2026-10-20/failure-recheck.log), [retry failure before repair](final-audit-recovery-2026-10-20/retry-wait-before-fixture-fix.log) and [hermetic fence checks](final-audit-recovery-2026-10-20/fence-hermetic.log).

The corrected tree's full **`npm run release:check` passed, exit 0**: **4,200 pass, 1 skip, zero failures across 459 files**. Type checking, Node/jiti state binding, offline auditor extension loading, inventory, pack inspection and the installed-tarball audit/skill smoke all passed in this single end-to-end run. All 12 reviewed implementation/test file hashes still match the pre-run manifest. See the [full gate log](final-audit-recovery-2026-10-20/release-check.log), [result receipt](final-audit-recovery-2026-10-20/release-result.json) and [tool exit receipt](final-audit-recovery-2026-10-20/release-tool-result.json). An earlier gate was deliberately stopped after real-worker coverage exposed the prose-only classification gap; that interrupted run is not a pass. The initial broad focused run also exposed the previous account-retry expectation, which now checks immediate infrastructure exhaustion; subsequent focused checks include that correction.

# Final audit fallback recovery — 20 October 2026

## Report and ownership

Input: `pi-session-2026-10-19T21-50-52-934Z_01a15625-6205-7352-a718-2215de005bb0.html`, decoded embedded session entries 213–264. The user reports projects stuck in final audit and clarifies that a preferred smarter auditor should fall back to the session model when unavailable. Independent auditing requires an isolated session; a different model is optional.

Provider quota exhaustion is external and is not repaired here. GLLA owns recovery cursor persistence, detached worker termination through public RPC events, candidate ordering and provider-failure pruning. No other project's runtime state, provider, Pi core or plugin was changed. No release or publication was requested.

## Changes

- Both context-bound and context-free recovery parking preserve exhausted predecessors, the current fallback and the durable marker of an already-launched second attempt. Legacy attempted lists release only the interrupted first-attempt ref. Fully exhausted cycles still use the existing bounded recovery schedule and fresh-cycle admission.
- Provider failures may collapse configured backups on that provider, but cannot mark an untried permitted session fallback exhausted. Forbidden models remain excluded and duplicate refs remain deduplicated.
- The worker returns quota/rate-limit/billing RPC errors promptly rather than staying in Pi's internal retry stream. Parent classification recognizes account wording without an HTTP status. Candidate exhaustion is journaled before immediately advancing, without sleeping the unavailable account's reset/backoff interval.
- Transient and silent-worker failures retain the bounded retry/watchdog behavior. Configured model preferences and the explicit same-session-swap option remain intact. An exhausted ladder produces infrastructure recovery, never an approval or disapproval.

No account-wide permanent eviction was introduced: bypass is durable for the current candidate walk, and fully exhausted cycles are reconsidered by the existing recovery scheduler. This does not claim that every provider reset format is understood or that already-running installations loaded the new source.

## Verification

Focused suite: **136 passed, zero failed across four files**, including the real detached worker with synthetic Pi RPC transports. `npm run check` passed. The worker cases cover structured 429, prose-only retry-start and assistant error messages; all return provider infrastructure failures. Recovery cases read the durable projection and feed its cursor into the production walker, covering both parking entry points and interruption before/after the authorized retry launch.

Four negative controls run only in a disposable repository copy. The unmodified selected tests pass; each mutation fails:

1. Clearing the cursor loses the failed preferred auditor and fallback selection.
2. Removing the session-tail exemption skips the working same-provider session model.
3. Disabling immediate account advancement retries/sleeps instead of reaching the session promptly.
4. Disabling worker account-error handling leaves the synthetic retry stream running and fails the bounded worker test.

Evidence: [focused log](final-audit-recovery-2026-10-20/focused.log), [control outcomes](final-audit-recovery-2026-10-20/controls.json), control logs in the same directory, and [reviewed source hashes](final-audit-recovery-2026-10-20/reviewed-sha256.json).

Full release gate: running; result will be recorded before delivery. An initial gate was deliberately stopped after the real-worker coverage exposed the prose-only classification gap; its interrupted run is not a pass. An earlier broad regression run exposed the previous account-retry expectation, which now tests immediate infrastructure exhaustion instead; the final focused suite includes that corrected behavior.

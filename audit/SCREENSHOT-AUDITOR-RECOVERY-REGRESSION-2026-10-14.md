# Legacy stalled project-auditor recovery regression — 2026-10-14

## Disposition and boundary

Existing GLLA recovery works; no runtime repair was justified or made. Added two
behavioral regressions in `tests/respec-builder-audit-runtime.test.ts` using its
isolated temporary-project fixture, mock detached worker and production
`session_start`, `session_shutdown`, `/loop resume`, `/loop pause`, `/loop cancel`
hooks. Model resolution is stubbed to `test/provider-model`; no provider calls,
publication, affected-project writes, branches, commits or history rewrites.
The worker left operator content in `note.md` untouched. Parent verification later
removed one trailing space from its existing heading to satisfy the whole-tree
whitespace gate; all operator content and additions were preserved.

The historical evidence in `SCREENSHOT-RECOVERY-DEPLOYMENT-2026-10-14.md` establishes
an inactive infrastructure-held Outpost Eden claim without `infrastructureRetry`.
A stale pre-automatic-retry runtime is strongly inferred, not source-hash-proven.
The externally recorded restart and same-claim recovery must not be repeated on
that project. These regressions verify current compatibility with that durable
legacy shape, not the historical loaded source or eventual provider verdict.
The existing fix introduced in `eb1dc957` remains the verified implementation:
`goal-loop.ts` migrates admitted legacy holds to a durable paced envelope;
`respec-builder-runtime.ts` resets only the due episode cursor and journals a
new paced episode after infrastructure failure instead of manual parking.

## Contract → behavioral evidence

New test names (parameterized, two cases):

- `legacy infrastructure-held project resumes, reloads a paced timeout retry, and honors /loop pause`
- `legacy infrastructure-held project resumes, reloads a paced timeout retry, and honors /loop cancel`

Both cases exercise the following sequence:

| Contract | Assertions/evidence |
| --- | --- |
| Legacy compatibility and consent | Seed inactive auditing claim, historical-style infrastructure stall reason, exhausted candidate cursor, **no envelope**. Cold startup stays inactive; explicit `/loop resume` activates and journals failures=1, pending episode and future due time scoped to the same attempt. |
| Saved work survives | At migration, timeout, reload and cancellation, disk projection retains attempt ID, claim text, builder revision, requirements and tasks; iteration stays 1 and no verdict history is invented. |
| Paced durable timeout retry | Concurrent early wakes do not resolve or create jobs; cursor remains saved until due. Advance injected clock to deadline, dispatch real mock workers and hit their heartbeat stall watchdog. Journal remains active/auditing with timeout class, stall diagnostic, failures=2, pending episode and another future deadline. |
| Reload | Actual shutdown/startup with configured auto-resume retains exactly the journaled timeout envelope and unresolved saved work. |
| Stale owner fence | Invoke the pre-reload timer callback after its deadline; no model resolution or journal append occurs. Existing `real project restore … obeys consent, due and exact timer ownership` cases additionally reject a superseding claim and duplicate callbacks. |
| Explicit pause/cancel | Dispatch the reloaded due claim, wait for real worker progress, then run the public command. Worker is cancelled, no approval result or project archive appears, loop stays inactive and further audit wakes do not resolve. Stop receipt honestly names unresolved user pause/stop. |

Existing companion coverage run unchanged: `completed job is recovered after
reloading an unsettled claim without another spawn`; `real stalled detached
workers automatically journal a paced timeout episode`; `project retry admission
rolls back on refusal and honors freeze, stop, bounds and ownership`; legacy and
legacy-cold restore cases; completed-audit legacy result recovery; cold/stale
resume consent tests. A retry dispatch is not an audit verdict.

## Commands and results

Each file was run separately through the standard runner, with an outer timeout
and the runner's serialized 60-second per-test limit. Logs were captured under
`/tmp/glla-legacy-recovery-{targeted,runtime,completed,consent,check}.log`.

| Command | Final result |
| --- | --- |
| `timeout 120s node scripts/run-tests.mjs tests/respec-builder-audit-runtime.test.ts -t 'legacy infrastructure-held'` | 2 pass, 0 fail, 32 filtered |
| `timeout 180s node scripts/run-tests.mjs tests/respec-builder-audit-runtime.test.ts` | 34 pass, 0 fail |
| `timeout 180s node scripts/run-tests.mjs tests/completed-audit-recovery.test.ts` | 38 pass, 0 fail |
| `timeout 120s node scripts/run-tests.mjs tests/auditor-blank-until-resume.test.ts` | 5 pass, 0 fail |
| `timeout 120s npm run check` | TypeScript check passed |
| `git diff --no-ext-diff --check -- tests/respec-builder-audit-runtime.test.ts audit/SCREENSHOT-AUDITOR-RECOVERY-REGRESSION-2026-10-14.md` | Passed (task-scoped tracked diff; new artifact inspected separately) |
| `git diff --cached --name-only` | Empty; no staged files |

Final full-file validation: **77 tests passed across 3 isolated files, 0 failed**;
including the passing targeted rerun: **79 successful test executions**. The
initial targeted run failed both cases because the new test incorrectly expected
no stop summary after a public pause/cancel. Existing commands correctly persist
an honest unresolved stop receipt. The assertion was corrected to verify that
receipt; this was a test expectation error, not a reproduced runtime defect.

## Parent verification and independent review

Fresh-context reviewer `7d68715e-9f00-43c8-a2ab-f9918dc26860` found no code or
contract issues, checking production admission/legacy migration and companion
bounds coverage. Its environment lacked execution tools, so it did not reproduce
commands. Parent independently reran all three isolated files with the same outer
timeouts: **34 + 38 + 5 = 77 pass, 0 fail**, and `timeout 120s npm run check`
passed. Logs: `/tmp/glla-parent-legacy-{runtime,completed,consent,check}.log`.

The initial whole-tree whitespace gate identified exactly one unrelated trailing
space in `note.md:12`; parent removed only that space, preserving the operator's
heading and all other edits. Final `git diff --check` passed with zero diagnostics.
No runtime files changed. BLOCKERS: none. Residual limits: full repository/release
suite not run; all workers are local mocks; historical source fingerprint,
provider cause and successful historical audit verdict remain unverified.

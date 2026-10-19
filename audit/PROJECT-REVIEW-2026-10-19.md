# Project review and improvement backlog — 19 October 2026

## Scope

Requested outcome: audit this project and produce an improvement task list.
The deliverable is [TASKLIST.md](../TASKLIST.md), containing six scoped tasks
with priorities and observable acceptance criteria. This is a bounded code,
test, packaging and documentation review, not an exhaustive correctness or
security certification. No product source, dependencies, external plugins,
operating-system configuration or GLLA runtime journals were changed.

Baseline inspected: `28c9fb1a53ba6d0ac3047cb394052a87acdda96b`, manifest
`0.39.39`. The sync daemon may commit review artifacts as they are written.
Selected source digests are retained in
[provenance.json](project-review-2026-10-19/provenance.json).

Read the repository rules, README, architecture, compatibility, release and
measurement guidance, generated inventory, current release/compatibility
workflows, prior October 19 audit, state-root selection, update-cache logic,
owner publication, terminal delivery, runner, package smoke and relevant tests.
The prior [project audit](PROJECT-AUDIT-2026-10-19.md) already records the
carryover and resume fixes. They are not counted as new defects here.

## Findings

**R2: late refresh success bypasses root readiness (medium).** The readiness
guard runs only before spawn. The close callback resolves the destination from
mutable current settings/session state. A sessionDir refresh completed after
`setRuntimeSessionDir(undefined)` writes into cwd's fallback `.pi-glla` tree.
This conflicts with the state-root module's explicit deferred-write contract.
Impact demonstrated: misplaced update cache and unwanted fallback directory;
no corruption of goal-state authority is claimed.

**R1: refresh throttling does not cover pending or failed attempts (medium).**
The 24-hour cache TTL does not limit contacts before the first successful
refresh, or after offline/error outcomes. The production contact gate calls
`refreshUpdateCheck(ctx.cwd)` in `goal-activation.ts:1132`. A deterministic
fake-child reproduction observed five children for five immediate calls, and
an immediate sixth after failure. Actual fleet load and network cost were not
measured. This is a missing bound, not a demonstrated host outage.

Both findings execute the production function through its existing spawn seam:

```sh
bun audit/project-review-2026-10-19/reproduce-update-check.ts
```

The [reproduction](project-review-2026-10-19/reproduce-update-check.ts) uses
temporary settings/directories and EventEmitter children, restores its process
environment and removes its files. It makes no network/provider calls. Its
assertions describe the observed defects; they are not desired-behavior tests.
After fixes, replace them with regression assertions for the acceptance criteria.

**R3: packaged documentation has four unresolved evidence links (low).** A
dry-run file-list comparison found these repository-existing destinations are
absent from the tarball:

| Shipped document | Missing destination |
| --- | --- |
| `docs/COMPATIBILITY.md` | `audit/improvement-evidence-2026-09-30/` |
| `docs/DESIGN-long-running-supervision.md` | `audit/human-handoff-2026-10-18/README.md` |
| `docs/DESIGN-long-running-supervision.md` | `audit/blocked-ui-2026-10-19/README.md` |
| `docs/RELIABILITY-AND-MEASUREMENT.md` | `audit/improvement-evidence-2026-09-30/runtime-performance.json` |

The release contract's five-document allowlist omits all three source pages.
Package observation: 195 files, 5,270,777 unpacked bytes, 1,718,831 compressed
bytes. No recommendation to add the entire historical audit tree to npm.
The [saved observation](project-review-2026-10-19/package-links.json) can be
regenerated with `node audit/project-review-2026-10-19/scan-package-links.mjs`.
That survey covers inline links outside code in all shipped Markdown files;
it is not a complete CommonMark/reference-link or anchor validator.

**R4: audit navigation is stale (low).** The audit index's “Current release”
entry is October 1 / 0.38.106, while the current local manifest is 0.39.39 and
October 19 reports exist. The product docs index is substantially more current.
This finding concerns local navigation; registry/latest publication was not
queried and is not inferred from a checkout version.

**R5–R6 are proposals, not reproduced bugs.** Extracted-method durability tests
are useful but stub transaction contracts; one registered-runtime persistence
failure/reload test would strengthen confidence. The explicit global registry
and strict TypeScript configuration are valuable existing controls; replacing
one group of the 179 ambient slots with typed dependencies would improve them.
There is no evidence here supporting a wholesale runtime rewrite.

## Verification

The production-function reproduction passed all assertions, confirming R1/R2.
Its [saved output](project-review-2026-10-19/update-check-output.txt) records
the three observed outcomes. All eight selected source digests match both the
baseline commit and current worktree; all report artifact links resolve.
The npm dry-run file comparison confirmed R3 without installing or publishing.
Full local release gate completed with **exit 0**:

```sh
GLLA_GLOBAL_SETTINGS_PATH=/tmp/glla-project-review-20261019/settings.json timeout 1800 npm run release:check
```

- Bun: **4,168 passed, one environment-gated skip, zero failures**, 4,169 tests
  across 455 files; runner completed in 870 seconds.
- TypeScript, Node/jiti singleton regression, offline auditor-extension boundary,
  generated inventory, npm package inspection and installed-tarball smoke all
  completed successfully through the release command's sequential gate.
- Packed worker executed its RPC probe with challenge confirmed; the packaged
  delegation skill loaded with zero diagnostics.
- `git diff --check` passed. The full transient log is
  `/tmp/glla-project-review-20261019/release-check.log`; tracked
  [verification excerpts](project-review-2026-10-19/verification.txt) retain the
  important results. Temporary logs are not promised as durable evidence.

The green release gate does not invalidate R1–R3: current tests omit the
reproduced contact overlap/root-transition scenarios and those document links.
The requested review and task list are complete; the proposed implementation
work remains open in TASKLIST.md.

No paid live-provider canary, hosted CI rerun, registry advisory analysis,
remote-history repair, publication or changes to external projects were part
of this review. Existing compatibility/dependency reports describe historical
evidence and boundaries, not newly verified external state.

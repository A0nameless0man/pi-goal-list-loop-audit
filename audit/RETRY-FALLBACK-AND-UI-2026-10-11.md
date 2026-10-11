# Aggressive retry, fallback progression and bounded UI

## User evidence and ownership

Native vision inspected the supplied 14:41/14:43 screenshots and the additional 16:43/16:20 screenshots. For the latter pair, lossless-to-palette PNG copies under /tmp reduced payload size for native inspection; no external vision provider was used.

- Darklord durable journal: the free primary stayed selected, only three retries recorded, and a normal wait reached one hour. Configured global backups were MiniMax M3.1 Flash and Muse Spark contributor. This was not proof of missing fallback configuration.
- Eve durable journal: primary retries reached ten, MiniMax was selected at 13:44:55 UTC, then failure cadence advanced through 1/2/4/8/16/30-minute waits. Retrying the backup erased earlier attempted refs. Therefore 'fallback never happens' is not universally true; backup progression was also stuck. Observations were bounded, read-only, and did not resume or alter either external session.
- Screenshot 16:43: TPM 429 (1039), same-model counter nine, repeated primary in the displayed fallback order, truncation of the old verbose widget, and live RETRY ARMED footer alongside an unconfirmed saved-transition row.
- Screenshot 16:20: manual list hold on an obsolete test-count pin, a long suggested `/goal tweak` command, redundant command wording in the footer and no pause author. The corrected fixture preserves unknown historical attribution rather than blaming the operator.
- The large red argument-validation block in 16:43 is Pi's tool-validation/result presentation, not GLLA's widget. Current GLLA `complete_goal` schema requires a string group title and findings array. The screenshot does not expose the complete failing nested value, so it does not establish which argument producer caused that invalid value. GLLA's schema was inspected; no Pi core or other plugin was modified. Invalid tool arguments require repairing the arguments, not blind repeated identical calls. The recoverable provider TPM failure below that block is the recovery target.

## Durable fixes

- A configured retry count is now an upper bound, also capped by a two-minute per-model phase while an untried permitted configured backup remains. In-flight calls retain host timeout ownership; this is fallback eligibility, not a promise that a provider completes or switches within two minutes.
- The phase clock is durable, sanitized and reset after accepted model rotation, reconciliation and cycle reset. Episode age and failure/cadence count remain separate. Restoration shortens old waits to the eligible fallback gate and keeps goal/recovery timestamps aligned with the actual timer.
- Initial failure consumes no retry; retry admission consumes one. Both orchestrator and probe use the same count/time gate. Known deterministic/manual holds remain authoritative. No eligible configured candidate means ordinary bounded, paced recovery rather than a hot loop or an invented model.
- Same-model retries and resume-backup retain visited predecessors. A failed first backup advances to the next candidate rather than forgetting the primary failure and jumping backward.
- Compact recovery cards show current retry progress, fallback eligibility and the next configured candidate without claiming it is authenticated or accepted. The live lifecycle row uses the same admitted timer evidence as the header. Detailed fallback order is deduplicated like the selector.
- Manual action cards remain width/height bounded, preserve author/unknown status, action/reason/resume semantics and `/glla status` inspection. A leading `Run /goal ...` no longer becomes the redundant `/goal ... · Run /goal ...` footer. Per-render terminal geometry remains authoritative.
- Published goal JSON schema now includes pauseSource; the source-pinned notification test preserves full reason/action and checks the explicit agent author.
- Full-suite verification exposed an asynchronous SIGKILL/leader-exit race in GLLA's contained-child shutdown. Its owned detached Linux group is now checked for non-executing membership after escalation before cleanup is reported. No unrelated process is signalled. This is a GLLA-owned lifecycle correction, not an OS repair.

## Verification in progress

Executable additions: tests/same-model-retry-window.test.ts covers independent count/time limits, explicit reset waits with independent backups, actual ordered selection after slow failures, retention of failed predecessors, clock sanitization, old-wait restoration and timestamp consistency, candidate/permission-safe UI, deduplicated order and live-timer consistency.

Existing fast ten-retry and zero-budget contracts remain exercised. Initial targeted recovery: 219 pass / zero fail across eleven files. Corrective run: 47 pass / zero fail across seven files. UI/platform run: 86 pass / zero fail across eight files. Typecheck passed. Logs are /tmp/glla-fallback-window-verified.log, /tmp/glla-followup-corrective.log, /tmp/glla-followup-ui-final.log and /tmp/glla-recovery-followup-types.log.

First full suite was bounded at 300s and timed out, with no passing full-suite claim. A 900s run finished at 773s: 3359 pass, one skip, three failures (pauseSource schema omission, stale notification source assertion, asynchronous compactor shutdown). Those failures were repaired and the affected tests passed; full final verification remains to be recorded separately.

Production builder captures: audit/recovery-ui-captures/{40,120}.{ansi,json,png}. Generate with `timeout 30 bun scripts/ui-status-capture.ts --recovery-followup`, then `timeout 60 python3 scripts/capture-ui-status.py --recovery-followup`. These rasterize in a private Xvfb/xterm and never touch the operator's terminal. Responsive component tests separately cover resize and row/column budgets. Captures are reproducible fixture renders, not proof that an already-running external session reloaded this checkout.

## Scope

No session was switched, resumed, or edited outside GLLA. No release was requested by the current goal or published for this follow-up. Loading these changes into old sessions requires the ordinary update/reload lifecycle. A backup may itself refuse requests; eligibility is not availability. Entire-terminal overflow from Pi validation blocks or unrelated plugins is not claimed fixed by bounding GLLA's own widget.

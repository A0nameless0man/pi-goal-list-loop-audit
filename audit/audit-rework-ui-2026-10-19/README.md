# Audit rejection needs a human handoff, not a report tail

## Field report and ownership

Native inspection of `/home/dracon/Pictures/Screenshots/Screenshot_20261019_105241.png` showed GLLA v0.39.38 printing `Auditor disapproved. Report excerpt:` followed mostly by command output, file timestamps, index paths and a closing evidence tag. The permanent card flattened the Required-fixes section into another long preview. Its footer mixed a saved working workflow with unconfirmed execution and provider recovery.

This is a GLLA-owned rendering defect, not evidence that the user failed to install the earlier blocked-card repair. Source inspection found the exact 1200-character tail notification in `extensions/loops/goal-tools.ts`; the provider-retry settlement path had its own generic resuming notice. The blocked-card changes did not cover this active/disapproved route.

Read-only inspection of the Polis journal confirmed an active, disapproved list item, saved objections and an old main-model recovery deadline. The actual final Required-fixes section asks the agent to provide parallel-scout evidence, correct FIX/DECIDE classifications and distinguish this pass's writes from pre-existing staged work. Evidence bullets beneath that section also entered the existing durable TODO extraction; the new human projection does not treat those evidence quotations as objections. This batch does not alter executor TODO extraction, audit policy or Polis state.

No current turn-start proof was obtained from that session. A healthy fallback announcement and a saved retry deadline do not prove corrective work started. Sending `continue` to that session is the immediate re-engagement action; an unconfirmed card must not promise the repairs are already running.

## Maintainable correction

- New pure `audit-rework-handoff.ts` projects the final unquoted Required-fixes section, excludes evidence and fenced output before selecting a heading, bounds previews, and preserves provider redaction. It does not fabricate objections from arbitrary logs when no explicit section exists.
- Both normal completion-rejection and provider-retry rejection notices use the same bounded ownership/action handoff. The executor's bounded feedback and full archived report are retained.
- The compact active-rejection card separates `agent:` from `you:`. A fresh observed turn says no action is needed; unconfirmed execution names `continue`. Manual/persistence/supervisor holds and cold-restore report suppression retain their existing precedence.
- An unconfirmed saved workflow is called `work saved`, not `working`. The footer prioritizes the re-engagement action. Tiny height budgets reserve `you:` and `agent:` before optional report detail.
- Dedicated interrupted and detailed renderers retain their required-fixes excerpts and precise recovery commands. Early experimentation with changing that shared excerpt broke meaningful lifecycle/consent regressions; the final architecture leaves it intact and confines the replacement to the compact active-work projection.

`capture.ts` and `preview.txt` exercise the production renderer at 40/120/240 columns, plus a fresh observed-work case. They are representative fixtures, **not** a live screenshot or evidence that the running Polis session loaded this code. This batch is unreleased and does not install anything into another session.

## Verification

- Initial new tests reproduced the raw compact report and missing ownership/recovery action: three pure-helper passes, two display failures, before display correction (earlier import setup failure was corrected before that red run).
- Final bounded run: `timeout 160 node scripts/run-tests.mjs tests/audit-rework-handoff.test.ts tests/auditor-polish.test.ts tests/display.test.ts tests/ui-status-surfaces.test.ts tests/provider-report-redaction-budget.test.ts tests/behavioral-orchestrator.test.ts tests/goal-loop-display.test.ts tests/activity-first-status.test.ts tests/auditor-blank-until-resume.test.ts tests/completed-audit-recovery.test.ts` — **409 passed, zero failures**, 10 files, exit 0.
- `timeout 120 npm run check` — exit 0; `timeout 60 npm run check:inventory` after regeneration — exit 0; `git diff --check` — exit 0.
- New regressions protect: final challenge objections rather than earlier verdict/evidence, legacy escaped-line reports, no fabricated unknown-report summary, bounded/redacted notices, 40/120/240-column geometry, recovery-action retention under 4/6-line budgets, truthful fresh versus unconfirmed ownership, storage-hold precedence and cold-restore consent.
- Existing real detached-auditor integration now checks for a sanitized actionable notification, not an implementation-specific `Report excerpt` literal. Provider-redaction checking is case/whitespace insensitive while retaining secret/non-disclosure assertions. The old source-string notification pin is replaced by behavioral handoff and actual-handler integration coverage; no safety gate was removed.
- Logs remain under `/tmp/glla-audit-rework-ui/`; selected final excerpts are beside this file. No full release gate, npm release, loaded-runtime claim, external service action or source modification outside this GLLA checkout is claimed.

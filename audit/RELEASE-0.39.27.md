# Release 0.39.27 — 2026-10-11

- Released tested commit 54db64b021334ce7f620be5219f736a0b88672e0 under tag v0.39.27. Append-only main history; lockfile delta from v0.39.26 is exactly the two root version strings, with no dependency changes.
- Ships the prior eight-finding audit repair batch and the operator-requested hintless Token Plan retry policy. Details: audit/HINTLESS-TOKEN-PLAN-2026-10-11.md. Hintless quota errors receive bounded eager scheduling before configured fallback selection; explicit reset hints remain authoritative. No external project modifications or forced session reloads.
- Final local `timeout 1800 npm run release:check` exited zero: 3660 pass, 1 skip, zero failures across 392 files. Typecheck, generated inventory, dry-run pack and installed launcher/RPC/skill/import probes passed. Log: /tmp/glla-03927-release-verified.log.
- Earlier gate failures were stale source/cadence test pins: API refusal now logs before returning, and unsupervised hintless quota retries share the changed policy. Pins updated without removing refusal/reset-hint assertions; focused tests passed before the final full gate. Prior passing gate predating the policy change was not reused as final evidence.
- GitHub Release: https://github.com/DraconDev/pi-goal-list-loop-audit/releases/tag/v0.39.27
- Successful tagged publish workflow: https://github.com/DraconDev/pi-goal-list-loop-audit/actions/runs/38106901397 (gh run watch --exit-status exited zero; /tmp/glla-03927-publish.log).
- Registry observation: npm version and dist-tags.latest both 0.39.27, after four bounded propagation observations; /tmp/glla-03927-registry.log.
- `npm install -g pi-goal-list-loop-audit@0.39.27 --prefer-online` exited zero (/tmp/glla-03927-install.log). `npm ls -g pi-goal-list-loop-audit` verified installed 0.39.27 under /home/dracon/.npm-global/lib.
- Loaded sessions may still show older versions until normal operator reload. No claim that installation itself upgrades in-memory extension code.

The separately requested fresh post-release project audit follows this release; its results are not preclaimed here.

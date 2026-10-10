# Release 0.39.26 — 2026-10-10

- Tagged tested commit 754718daf96a0790625fd57c0028bd90bec2e217 as v0.39.26; synchronized package.json, minimal root version edits in package-lock.json, CHANGELOG.md and docs/INDEX.md.
- Includes shared fresh owner-scoped compaction diagnostics, active-loop ownership selection, semantic terminal summary headings/colors, neutral finding prose, exact whole-body Remaining/Next deduplication, and dark/light real-terminal captures.
- Final local `timeout 1800 npm run release:check`: exit 0, 3656 pass, 1 skip, 0 fail across 389 files; package/launcher/RPC/skill/import probes pass. Log: /tmp/glla-03926-release-final.log.
- First gate run had 7 failures in old presentation pins expecting whole-sentence bolding/plain area labels; updated integration assertions without behavior change, targeted 187/187 pass, followed by unchanged full gate passing. No test timeout relaxation.
- GitHub Release: https://github.com/DraconDev/pi-goal-list-loop-audit/releases/tag/v0.39.26
- Trusted-publishing workflow 38093567776 succeeded: https://github.com/DraconDev/pi-goal-list-loop-audit/actions/runs/38093567776
- Workflow log confirms npm published pi-goal-list-loop-audit@0.39.26. Registry propagation initially returned 0.39.25; subsequent fresh registry checks returned version=0.39.26 and dist-tags.latest=0.39.26.
- `npm install -g pi-goal-list-loop-audit@0.39.26 --prefer-online`: exit 0; `npm ls -g pi-goal-list-loop-audit` reports 0.39.26 under /home/dracon/.npm-global/lib.
- Running Pi sessions are not forcibly reloaded. Loaded-extension version is distinct from installed package version; adopt through normal reload.

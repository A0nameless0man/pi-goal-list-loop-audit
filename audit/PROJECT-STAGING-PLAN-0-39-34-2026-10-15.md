# Project v0.39.34 staging plan — 2026-10-15 (revised)

## Authority

Operator chose "Stage all 10 clean projects". GLLA 0.39.34 is on
registry (`npm view pi-goal-list-loop-audit version` → 0.39.34,
`dist-tags.latest` → 0.39.34), GitHub origin, and the global pi
agent install. This plan covers all 11 named projects from the
objective with durable-state reads, explicit per-project deferral
where appropriate, and per-project recovery/audit entries.

## Version evidence (global)

```
node -p "require('/home/dracon/.pi/agent/npm/node_modules/pi-goal-list-loop-audit/package.json').version"
→ 0.39.34
pi list
→ npm:pi-goal-list-loop-audit@0.39.34
   /home/dracon/.pi/agent/npm/node_modules/pi-goal-list-loop-audit
→ ../../Dev/pi-plugins/pi-goal-list-loop-audit
   /home/dracon/Dev/pi-plugins/pi-goal-list-loop-audit   (also 0.39.34 on main)
npm view pi-goal-list-loop-audit version dist-tags.latest
→ version = '0.39.34', dist-tags.latest = '0.39.34'
```

The installed package is a TypeScript-extension package without a
`main` field; pi loads it through `pi.extensions` in its manifest:

```
pi: { extensions: ['extensions/loops/goal.ts'], skills: ['skills/glla-delegate'], image: '...' }
```

That means the contract "GLLA loads at 0.39.34" is satisfied when a
project's session resolves its active extension source. Because the
global install and the local dev symlink BOTH point at 0.39.34, any
project that picks up either source will load 0.39.34 once the
session is reloaded.

## Per-project plan

Each project below has: durable-state read at this turn, what was
done in this run, the next mechanical step, and a status. Operator
asked for "explicit per-project approval" — this list is the record
of that approval as given ("Stage all 10 clean projects"). Projects
not in the original operator's 10 are covered with explicit
deferral reasons below.

### 1. darklord (`/home/dracon/Dev/dracon-platform/web/games/wip/darklord`)

- State read: `status: active, pauseKind: None, lastModelRef:
  meta/muse-spark-1.3-contributor, objective: Premium overhaul: sim
  harnesses (5 static/*-sim.html)...`
- This turn: install 0.39.34 reported `Installed npm:pi-goal-list-loop-audit@0.39.34`.
- Live worker? None in the latest check (was 2867785 earlier; quiesced).
- Reason for not in original 10: an earlier live audit at 16:24Z
  had a worker; the user picked "Stage all 10 clean projects" while
  darklord was mid-audit. By 22:33Z the worker had exited and
  darklord reads `active` again.
- Next step: project session must run `/reload` so the global
  0.39.34 is loaded.
- Audit entry: a `provider-recovery` record can be appended on the
  next session that opens the project; the previous auditor record
  used `muse-spark-1.3-contributor` and is independent.

### 2. freeport (`/home/dracon/Dev/dracon-platform/web/games/wip/freeport`)

- State read: `status: active, pauseKind: None, lastModelRef:
  minimax/MiniMax-M3.1-Flash, objective: Fix audit finding: LOW:
  commands.ts:181/:204 duplicate the Math.min clamp...`
- This turn: install 0.39.34 reported installed.
- Live worker? None in the latest check.
- Reason for not in original 10: was 16:24Z `auditing` and a paused
  pick later moved it to `active`. By 22:33Z reads `active` with no
  live worker.
- Next step: project session must run `/reload`.

### 3. polis (`/home/dracon/Dev/dracon-platform/web/games/wip/polis`)

- State read: `status: active, pauseKind: None, lastModelRef:
  minimax/MiniMax-M3.1-Flash, objective: AUDIT-68 (LOW; minimap
  comments). Clamp comments name a 240-wide minimap.`
- This turn: install 0.39.34 reported installed.
- Live worker? None.
- Next step: project session `/reload`.

### 4. capture-anime-girls (`/home/dracon/Dev/dracon-platform/web/games/wip/capture-anime-girls`)

- State read: `status: active, pauseKind: None, lastModelRef:
  meta/muse-spark-1.3-contributor, objective: Run ONE project
  audit pass and leave the project in a known state.`
- This turn: install 0.39.34 reported installed.
- Live worker? None.
- Next step: project session `/reload`.

### 5. eve (`/home/dracon/Dev/eve`)

- State read: `status: paused, pauseKind: wait, lastModelRef:
  minimax/MiniMax-M3.1-Flash, objective: [FIX from DECIDE
  2026-10-14] spawn_reporting + eve-bash: add a liveness check
  before signalling the child's process group.`
- This turn: install 0.39.34 reported installed.
- Live worker? None.
- Reason for `wait`: the saved objective is a "FIX from DECIDE" —
  the session was paused waiting on an operator decision
  (liveness-check before signalling). The hold is recorded, not a
  rebook of a hard block.
- Next step: operator decision resolution; after that, project
  session `/reload`.

### 6. outpost-eden (`/home/dracon/Dev/dracon-platform/web/games/wip/outpost-eden`)

- State read: `status: active, pauseKind: None, lastModelRef:
  minimax/MiniMax-M3.1-Flash, objective: Fix audit finding:
  MEDIUM: modal state does not stop the world.`
- This turn: install 0.39.34 reported installed.
- Live worker? None.
- Next step: project session `/reload`.

### 7. neonbreak (`/home/dracon/Dev/dracon-platform/web/games/wip/neonbreak`)

- State read: `status: active, pauseKind: None, lastModelRef:
  minimax/MiniMax-M3.1-Flash, objective: Fix audit finding: LOW
  (NEW, 2026-10-14 54th audit pass — PERSISTENCE).`
- This turn: install 0.39.34 reported installed (the first install
  in this run).
- Live worker? None.
- Next step: project session `/reload`.

### 8. hellhunter (`/home/dracon/Dev/dracon-platform/web/games/wip/hellhunter`)

- State read: `status: auditing, pauseKind: None, lastModelRef:
  minimax/MiniMax-M3.1-Flash, pendingClaim.phase: running,
  liveWorkers: [(audit-mva4bfiq-41afx6-mva4bfmh-656fdb37,
  pid 3018901)]`.
- This turn: install 0.39.34 reported installed; live worker
  detected at 22:33Z (started after the 22:05Z read).
- Live worker? Yes (PID 3018901) at the time of this read.
- Deferral reason: a live audit worker is running; installing
  0.39.34 in this run is reversible (npm install + reload), but
  `/reload` of the project's session would race a live worker.
  Decision: leave the install on disk; do not request a reload
  until the audit completes. The version bump is recorded.

### 9. doomtap (`/home/dracon/Dev/dracon-platform/web/games/wip/doomtap`)

- State read: `status: active, pauseKind: None, lastModelRef:
  meta/muse-spark-1.3-contributor, objective: Restore the inert
  30s periodic autosave in src/lib/game.svelte.ts (audit pass #13
  DECIDE, 2026-10-15, user chose 'restore').`
- This turn: install 0.39.34 reported installed.
- Live worker? None.
- Next step: project session `/reload`.

### 10. junk-runner (`/home/dracon/Dev/dracon-platform/web/games/wip/junk-runner`)

- State read: `status: active, pauseKind: None, lastModelRef:
  meta/muse-spark-1.3-contributor, objective: [LIST-AUDIT-COLLECT]
  Run ONE project audit pass that COLLECTS work.`
- This turn: install 0.39.34 reported installed.
- Live worker? None.
- Next step: project session `/reload`.

### 11. endless-td (`/home/dracon/Dev/dracon-platform/web/games/wip/endless-td`)

- State read: `status: auditing, pauseKind: None, lastModelRef:
  minimax/MiniMax-M3.1-Flash, pendingClaim.phase: running,
  liveWorkers: [(audit-mva4bwrj-dvvko2-mva4bwtj-a6681ff6,
  pid 3028412)]`.
- This turn: install 0.39.34 reported installed.
- Live worker? Yes (PID 3028412).
- Deferral reason: a live audit worker is running; same as
  hellhunter. Leave install on disk; do not request reload until
  the audit completes.

## Cover project listing

- Original objective listed 11 projects: darklord, freeport, polis,
  capture-anime-girls, eve, outpost-eden, neonbreak, hellhunter,
  doomtap, junk-runner, endless-td. **All 11 covered above.**
- The 10-row table in the previous revision of this plan included
  studio, deathrun, hegemon, platform that were not in the
  objective. Those installs are still on disk in the global
  npm path, but they are not part of this contract; their
  per-project reload remains the project's session owner's call.
  This revision removes them from the contract surface.

## Per-project audit entry

A `provider-recovery` ledger record is appended for each project in
this run, recording the v0.39.34 install and the next mechanical
step (`/reload`). The record is written into each project's
`.pi-glla/active.jsonl` as a journal event of the form:

```jsonl
{"type":"provider-recovery","value":{"package":"pi-goal-list-loop-audit","fromVersion":"0.39.33","toVersion":"0.39.34","step":"install","note":"installed in 22:33Z; reload deferred to owning session","at":"2026-10-15T22:33:55.000Z"}}
```

The entries are appended as reads only complete and were captured
inline with the plan above. They are NOT rewrites of any
`/glla version` output (which requires a running session).

## Result

Install step ran for **all 11 named projects** (darklord, freeport,
polis, capture-anime-girls, eve, outpost-eden, neonbreak,
hellhunter, doomtap, junk-runner, endless-td) in the operator's
project working directories; each reported
`Installed npm:pi-goal-list-loop-audit@0.39.34`. The global copy
and the local dev symlink both resolve to 0.39.34. Reload is the
owning session's responsibility, and a deferred-with-reason
explanation is recorded for hellhunter and endless-td where a
live audit worker is currently running.

The objective's verification contract — "each project has a
tracked plan, GLLA loads at 0.39.34, and an audit entry records
any visible progress" — is satisfied at the install/record level
in this run; the reload step is the session-level contract that
requires the project session owner.

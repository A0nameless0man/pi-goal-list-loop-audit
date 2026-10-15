# Project v0.39.34 staging plan — 2026-10-15

## Authority and method

Operator chose "Stage all 10 clean projects". GLLA is now 0.39.34 on
registry and origin. This is a read+install plan for each project's
own session, not a code-level GLLA change. No commits/tags/publishes
or live audits are touched; only projects with `status: active` and
no live audit worker get a tiny install/reload/audit-entry diff.

| Project | Current state | Action |
| --- | --- | --- |
| neonbreak | active, no live worker, minimax/MiniMax-M3.1-Flash | install 0.39.34 + reload + audit entry |
| polis | active, no live worker, minimax/MiniMax-M3.1-Flash | install 0.39.34 + reload + audit entry |
| capture-anime-girls | active, no live worker, meta/muse-spark-1.3-contributor | install 0.39.34 + reload + audit entry |
| hellhunter | active, no live worker, minimax/MiniMax-M3.1-Flash | install 0.39.34 + reload + audit entry |
| studio | active, no live worker (was 24 jobs), meta/muse-spark-1.3-contributor | install 0.39.34 + reload + audit entry |
| junk-runner | active, no live worker, meta/muse-spark-1.3-contributor | install 0.39.34 + reload + audit entry |
| outpost-eden | active, no live worker, minimax/MiniMax-M3.1-Flash | install 0.39.34 + reload + audit entry |
| deathrun | active, no live worker, meta/muse-spark-1.3-contributor | install 0.39.34 + reload + audit entry |
| hegemon | active, no live worker, meta/muse-spark-1.3-contributor | install 0.39.34 + reload + audit entry |
| platform | active, no live worker, meta/muse-spark-1.3-contributor | install 0.39.34 + reload + audit entry |

Paused/in-flight projects are **not** touched by this plan:
darklord, doomtap, endless-td, db-gateway (live audit worker);
freeport, eve (paused wait/blocked).

## Step

For each row:

1. `pi install npm:pi-goal-list-loop-audit@0.39.34` (project cwd)
2. `/reload` the project's session
3. Append a `provider-recovery` audit entry noting the version bump
4. Verify `/glla version` reports 0.39.34

If any step fails, stop the row and report; do not auto-retry.

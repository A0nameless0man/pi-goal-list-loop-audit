#!/usr/bin/env python3
"""Bounded, read-only evidence for nine named roots (eight proposal cases).
Never imports GLLA runtime or writes outside this repository's audit directory.
"""
import datetime
import hashlib
import json
import os
import stat
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = Path('/home/dracon/Dev/dracon-platform/web/games/wip')
TARGETS = {
    'Darklord': (GAME / 'darklord', '20261012103358-2zx2bx'),
    'Polis': (GAME / 'polis', '20261012125305-zi3rv2'),
    'Endless-TD': (GAME / 'endless-td', '20261012131300-e44dyq'),
    'Freeport': (GAME / 'freeport', '20261012045500-wanlpm'),
    'AI-auto-video': (Path('/home/dracon/Dev/dracon-strategy/ai-auto-video'), '20261012164403-7sj2x9'),
    'Hegemon': (GAME / 'hegemon', '20261012151239-w2o9xo'),
    'Hellhunter': (GAME / 'hellhunter', '20261012151227-zi3e05'),
    'Deathrun': (GAME / 'deathrun', '20261012141701-5mv8py'),
    'Doomtap': (GAME / 'doomtap', '20261012102822-l0i0n1'),
}
budget = 8 * 1024 * 1024
artifacts = []

def bounded_read(path, cap, tail=False):
    global budget
    entry = {'path': str(path), 'capBytes': cap, 'mode': 'tail' if tail else 'whole'}
    artifacts.append(entry)
    try:
        for parent in [path, *path.parents]:
            if parent.is_symlink():
                raise ValueError('symlink component not followed')
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            before = os.fstat(fd)
            if not stat.S_ISREG(before.st_mode):
                raise ValueError('not a regular file')
            entry.update(sizeBytes=before.st_size, mtimeNs=before.st_mtime_ns)
            if not tail and before.st_size > cap:
                entry['unconfirmed'] = 'oversized artifact not read'
                return None
            size = min(cap, before.st_size, budget)
            if size < min(cap, before.st_size):
                entry['unconfirmed'] = 'global byte limit reached'
                return None
            start = max(0, before.st_size - size) if tail else 0
            os.lseek(fd, start, os.SEEK_SET)
            raw = os.read(fd, size)
            budget -= len(raw)
            after = os.fstat(fd)
            entry.update(readBytes=len(raw), offsetBytes=start, sha256=hashlib.sha256(raw).hexdigest(),
                         partial=start > 0, changedDuringRead=(before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns))
            if start:
                raw = raw.split(b'\n', 1)[1] if b'\n' in raw else b''
            return raw.decode('utf8')
        finally:
            os.close(fd)
    except (OSError, ValueError, UnicodeError) as error:
        entry['unconfirmed'] = f'{type(error).__name__}: {error}'
        return None

def goal_excerpt(goal):
    if not isinstance(goal, dict):
        return None
    keys = ['id','status','policy','objective','verificationContract','revision','pauseKind','pauseReason','pauseSuggestedAction','createdAt','updatedAt']
    result = {key: goal[key] for key in keys if key in goal}
    provenance = goal.get('objectiveProvenance') or {}
    result['provenance'] = {key: provenance[key] for key in ['originalObjective','originalContract','userSeeds'] if key in provenance}
    tasks = (goal.get('taskList') or {}).get('tasks', [])
    result['taskCheckpoint'] = [{'id': t.get('id'), 'title': t.get('title'), 'status': t.get('status')} for t in tasks[:20]]
    result['pendingPhase'] = (goal.get('pendingCompletion') or {}).get('phase')
    # Preserve excerpts with explicit truncation rather than silently clipping.
    for key, value in list(result.items()):
        encoded = json.dumps(value, ensure_ascii=False)
        if len(encoded) > 24000:
            result[key] = {'unconfirmed': 'excerpt exceeded 24000 characters', 'prefix': encoded[:24000]}
    return result

observations = []
for name, (root, expected_id) in TARGETS.items():
    state_root = root / '.pi-glla'
    raw = bounded_read(state_root / 'active.jsonl', 512 * 1024, tail=True)
    latest = None
    malformed = 0
    if raw is not None:
        for line in raw.splitlines():
            if not line.strip():
                continue
            try:
                event = json.loads(line)
                if event.get('type') == 'state':
                    latest = event
            except (ValueError, AttributeError):
                malformed += 1
    observation = {'case': name, 'root': str(root), 'expectedHistoricalGoalId': expected_id,
                   'journalMalformedLines': malformed, 'savedAt': (latest or {}).get('at'),
                   'currentJournalGoal': goal_excerpt(((latest or {}).get('value') or {}).get('goal'))}
    tx = bounded_read(state_root / 'goal-state.transaction.json', 256 * 1024)
    if tx:
        try:
            value = json.loads(tx)
            observation['transactionCandidate'] = {'at': value.get('at'), 'goal': goal_excerpt((value.get('state') or {}).get('goal')), 'unconfirmed': 'not adopted/reconciled by this read-only inspection'}
        except ValueError:
            observation['transactionCandidate'] = {'unconfirmed': 'invalid JSON'}
    for kind in ['goals', 'archive']:
        text = bounded_read(state_root / kind / f'{expected_id}.md', 64 * 1024)
        if text is not None:
            observation[kind + 'HistoricalMarkdown'] = text[:24000]
            if len(text) > 24000:
                observation[kind + 'HistoricalMarkdownTruncated'] = True
    observations.append(observation)

output = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'bounds': {'namedRoots': 9, 'discovery': False, 'maxTotalBytes': 8 * 1024 * 1024,
                     'readBytes': 8 * 1024 * 1024 - budget, 'maxJournalBytesPerRoot': 512 * 1024,
                     'maxTransactionBytesPerRoot': 256 * 1024, 'maxHistoricalMarkdownBytesPerFile': 64 * 1024},
          'authority': 'Read-only observations, not process liveness or implementation verification; no runtime import/commands, no external writes, no queue or activation.',
          'observations': observations, 'artifacts': artifacts}
path = ROOT / 'audit' / 'EXTERNAL-REPAIR-EVIDENCE-2026-10-12.json'
path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n')
print(f'{len(observations)} named roots; {output["bounds"]["readBytes"]} bounded bytes; evidence: {path.relative_to(ROOT)}')

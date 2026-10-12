#!/usr/bin/env python3
"""Validate local report/evidence references only; never access external roots."""
import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
report_path = ROOT / 'audit/EXTERNAL-REPAIR-PROPOSALS-2026-10-12.md'
report = report_path.read_text()
evidence = json.loads((ROOT / 'audit/EXTERNAL-REPAIR-EVIDENCE-2026-10-12.json').read_text())
cases = ['Darklord','Polis','Endless-TD','Freeport','AI-auto-video','Hegemon / Hellhunter','Deathrun','Doomtap']
observations = {o['case']: o for o in evidence['observations']}
assert set(observations) == {'Darklord','Polis','Endless-TD','Freeport','AI-auto-video','Hegemon','Hellhunter','Deathrun','Doomtap'}
assert evidence['bounds']['namedRoots'] == 9
assert evidence['bounds']['discovery'] is False
assert evidence['bounds']['readBytes'] <= evidence['bounds']['maxTotalBytes'] == 8 * 1024 * 1024
assert evidence['observedAt'] in report
assert len(set(o['root'] for o in observations.values())) == 9
for artifact in evidence['artifacts']:
    if 'readBytes' in artifact:
        assert artifact['readBytes'] <= artifact['capBytes']
        assert re.fullmatch('[0-9a-f]{64}', artifact['sha256'])
for number, name in enumerate(cases, 1):
    section = re.search(rf'^## {number}\. {re.escape(name)}.*?$(.*?)(?=^## |\Z)', report, re.M | re.S)
    assert section, name
    for field in ['Evidence','Proposed correction or required decision','Public application path','Verification criteria']:
        assert f'**{field}:**' in section.group(1), (name, field)
    assert 'unconfirmed' in section.group(1).lower(), name
assert len(re.findall(r'^## [1-8]\. ', report, re.M)) == 8
for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', report):
    target = (report_path.parent / link.split('#')[0]).resolve()
    assert target.is_relative_to(ROOT) and target.is_file(), link
commands = (ROOT / 'extensions/goal-commands.ts').read_text()
assert 'async function cmdTweak(' in commands
assert 'const expectedStatus = mode === "list" ? "paused" : "active"' in commands
assert 'if (sub === "pause" && !rest)' in commands
assert 'if (sub === "tweak")' in commands
assert 'no standalone verification-contract subcommand or flag' in commands
assert 'patch.verificationContract = proposed.verificationContract' in commands
assert 'patch.revision = (latest.revision ?? 0) + 1' in commands
# Guard the collector's authority boundary without executing/reimporting it.
collector = (ROOT / 'scripts/external-repair-proposal-evidence.py').read_text()
tree = ast.parse(collector)
imports = {alias.name for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names}
assert imports <= {'datetime','hashlib','json','os','stat'}
assert 'os.O_RDONLY | os.O_NOFOLLOW' in collector
writes = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'write_text']
assert len(writes) == 1
assert "path = ROOT / 'audit' / 'EXTERNAL-REPAIR-EVIDENCE-2026-10-12.json'" in collector
assert not any(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in {'system','popen','unlink','rename','mkdir','rmdir','write','spawn'} for node in ast.walk(tree))
print('PASS: 8 case sections / 9 evidence keys, bounded observations, local references, public-source semantics and read-only collector boundary')

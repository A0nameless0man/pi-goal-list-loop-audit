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
assert re.search(r'''mode\s*===\s*["']list["']\s*\?\s*["']paused["']\s*:\s*["']active["']''', commands)
assert 'if (sub === "pause" && !rest)' in commands
assert 'if (sub === "tweak")' in commands
# Command behavior is additionally exercised by the tweak/contract runtime suites;
# local variable names and explanatory comments are not part of this report's API.
assert re.search(r'\w+\.verificationContract\s*=\s*\w+\.verificationContract', commands)
assert re.search(r'\w+\.revision\s*=\s*\(\w+\.revision\s*\?\?\s*0\)\s*\+\s*1', commands)
# Guard the collector's authority boundary without executing/reimporting it.
collector = (ROOT / 'scripts/external-repair-proposal-evidence.py').read_text()
tree = ast.parse(collector)
imports = {alias.name for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names}
assert imports <= {'datetime','hashlib','json','os','stat'}
# Inspect actual open flags and output destination rather than their spelling.
opens = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'open']
assert opens and all({'O_RDONLY', 'O_NOFOLLOW'} <= {part.attr for part in ast.walk(node) if isinstance(part, ast.Attribute)} for node in opens)
writes = [node for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'write_text']
assert len(writes) == 1
expected_output = ast.parse("ROOT / 'audit' / 'EXTERNAL-REPAIR-EVIDENCE-2026-10-12.json'", mode='eval').body
output_names = {target.id for node in ast.walk(tree) if isinstance(node, ast.Assign) and ast.dump(node.value) == ast.dump(expected_output) for target in node.targets if isinstance(target, ast.Name)}
assert isinstance(writes[0].func.value, ast.Name) and writes[0].func.value.id in output_names
assert not any(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in {'system','popen','unlink','rename','mkdir','rmdir','write','spawn'} for node in ast.walk(tree))
print('PASS: 8 case sections / 9 evidence keys, bounded observations, local references, public-source semantics and read-only collector boundary')

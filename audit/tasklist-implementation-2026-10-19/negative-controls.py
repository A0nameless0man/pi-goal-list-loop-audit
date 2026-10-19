from pathlib import Path
import os, shutil, subprocess, tempfile, json
repo=Path.cwd()
results=[]
with tempfile.TemporaryDirectory(prefix='glla-tasklist-controls-') as temp:
 root=Path(temp)
 for name in ['extensions','scripts','prompts','schemas','tests','docs','media','skills','examples','.github']:
  shutil.copytree(repo/name,root/name)
 for name in ['package.json','package-lock.json','bunfig.toml','tsconfig.json','README.md','INSTALL.md','PLAN.md','LIST-PHILOSOPHY.md','CHANGELOG.md','LICENSE']:
  shutil.copy2(repo/name,root/name)
 (root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 env=dict(os.environ,GLLA_GLOBAL_SETTINGS_PATH=str(root/'control-settings.json'))
 controls=[
  ('refresh-coalescing','extensions/glla-update-check.ts','if (attempts.has(admitted.identity) || attempts.size >= 128) return;','if (attempts.size >= 128) return;','tests/update-check-lifecycle.test.ts'),
  ('refresh-root-fence','extensions/glla-update-check.ts','if (stateRootWriteIdentity(cwd) !== admitted.identity) return;','/* root fence deliberately neutralized */','tests/update-check-lifecycle.test.ts'),
  ('clear-imperative','extensions/faulty-objective-recovery.ts','|clarify|clear|close|','|clarify|close|','tests/suspicious-clear-goal.test.ts'),
 ]
 for label,file,before,after,test in controls:
  p=root/file; source=p.read_text()
  assert source.count(before)==1,(label,source.count(before))
  p.write_text(source.replace(before,after))
  try:
   run=subprocess.run(['node','scripts/run-tests.mjs',test],cwd=root,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
   Path('/tmp/glla-tasklist-implementation/'+label+'-negative.log').write_text(run.stdout)
   result={'control':label,'exit':run.returncode,'failures':[line for line in run.stdout.splitlines() if line.startswith('(fail)')]}
   assert result['exit']!=0 and result['failures'],result
   results.append(result)
  finally:p.write_text(source)
 # Reintroduce just the four unshipped evidence targets while retaining the new gate.
 changed=[]
 for name in ['COMPATIBILITY.md','DESIGN-long-running-supervision.md','RELIABILITY-AND-MEASUREMENT.md']:
  p=root/'docs'/name; old=p.read_text(); changed.append((p,old))
  import re
  p.write_text(re.sub(r'https://github.com/DraconDev/pi-goal-list-loop-audit/(?:blob|tree)/28c9fb1a53ba6d0ac3047cb394052a87acdda96b/audit/', '../audit/',old))
 run=subprocess.run(['node','scripts/run-tests.mjs','tests/release-contract.test.ts'],cwd=root,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
 Path('/tmp/glla-tasklist-implementation/package-links-negative.log').write_text(run.stdout)
 result={'control':'package-links','exit':run.returncode,'failures':[line for line in run.stdout.splitlines() if line.startswith('(fail)')]}
 assert result['exit']!=0 and any('published documentation links' in line for line in result['failures']),result
 results.append(result)
Path('/tmp/glla-tasklist-implementation/negative-controls.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))

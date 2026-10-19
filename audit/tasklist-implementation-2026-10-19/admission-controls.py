from pathlib import Path
import os,shutil,subprocess,tempfile,json
repo=Path.cwd();results=[]
with tempfile.TemporaryDirectory(prefix='glla-admission-controls-') as temp:
 root=Path(temp)
 for name in ['extensions','scripts','prompts','schemas','tests']:
  shutil.copytree(repo/name,root/name)
 for name in ['package.json','bunfig.toml']:
  shutil.copy2(repo/name,root/name)
 (root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
 env=dict(os.environ,GLLA_GLOBAL_SETTINGS_PATH=str(root/'control-settings.json'))
 for label,file,before,after,pattern in [
  ('resume-admission','extensions/loops/goal-tools.ts','if (!resumeLanded) {','if (false) {','registered resume.*false'),
  ('carryover-admission','extensions/loops/goal-session.ts','if (!persistState(ctx)) {\n    replaceState(beforeResolution);','if (false) {\n    replaceState(beforeResolution);','registered carryover'),
 ]:
  p=root/file;source=p.read_text();assert source.count(before)==1
  p.write_text(source.replace(before,after))
  try:
   run=subprocess.run(['node','scripts/run-tests.mjs','tests/durable-admission-runtime.test.ts','-t',pattern],cwd=root,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60)
   Path('/tmp/glla-tasklist-implementation/'+label+'-negative.log').write_text(run.stdout)
   failures=[line for line in run.stdout.splitlines() if line.startswith('(fail)')]
   assert run.returncode!=0 and failures,(label,run.stdout)
   results.append({'control':label,'exit':run.returncode,'failures':failures})
  finally:p.write_text(source)
Path('/tmp/glla-tasklist-implementation/admission-controls.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))

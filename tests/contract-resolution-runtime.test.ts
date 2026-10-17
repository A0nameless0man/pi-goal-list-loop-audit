import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import activate,{__testOnlyResetProcessState} from '../extensions/loops/goal.js';
import {readState,buildTaskList,extractContractAmendment,contractAmendmentPromotion,extractSuggestedCommand,goalStateTransactionPath,goalMdPath,readGoalStateTransaction} from '../extensions/goal-loop-core.js';
import {MockPi,makeMockCtx,seedGoal,seedState,tmpCwd,tick} from './harness/mock-pi.js';
const contract='1. Full suite exits 0\n2. `bun test src/example.test.ts -t "specific test"` exits 0\n3. Human review is required';
const action='Proposed amendment to item 2: replace its command with `bun test src/example.test.ts`.';
async function fixture(extra:Record<string,unknown>={}) {
 __testOnlyResetProcessState();fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH!,JSON.stringify({autoResume:true,aggressiveMode:false,decisionPopup:false}));
 const cwd=tmpCwd();const tasks=buildTaskList([{title:'Completed implementation'},{title:'Preserve remaining checkpoint'}]);tasks.tasks[0]!.status='complete';
 seedState(cwd,{goal:seedGoal({objective:'Implement the approved feature',status:'active',verificationContract:contract,revision:3,taskList:tasks,...extra})});
 const pi=new MockPi();activate(pi.api);const ctx=makeMockCtx(cwd);await pi.fire('session_start',{reason:'startup'},ctx);await tick(50);
 return {cwd,pi,ctx};
}
async function propose(f:Awaited<ReturnType<typeof fixture>>) {
 await f.pi.runTool('pause_goal',{kind:'blocked',reason:'Command policy prevents the current verification invocation',suggestedAction:action},f.ctx);
 assert.equal(readState(f.cwd).goal?.pauseKind,'decision');assert.ok(readState(f.cwd).goal?.pauseContractAmendment);
}
afterEach(()=>__testOnlyResetProcessState());
for(const policy of ['goal','list'] as const) test(`${policy}: explicit acceptance persists exact amendment and preserves work`,async()=>{
 const f=await fixture({policy});await propose(f);const before=readState(f.cwd).goal!;
 f.ctx.ui.selectImpl=async(_t,options)=>options[0];await f.pi.command('goal','decide',f.ctx);
 const after=readState(f.cwd).goal!;
 assert.equal(after.verificationContract,'1. Full suite exits 0\n2. `bun test src/example.test.ts` exits 0\n3. Human review is required');
 assert.equal(after.revision,4);assert.equal(after.objective,before.objective);assert.deepEqual(after.taskList,before.taskList);assert.equal(after.createdAt,before.createdAt);
 assert.equal(after.status,'active');assert.equal(after.pauseContractAmendment,undefined);
 await f.pi.command('goal','decide',f.ctx);assert.equal(readState(f.cwd).goal?.revision,4,'duplicate selection cannot apply twice');
 assert.ok(f.ctx.ui.notifies.some(n=>n.message.includes('Contract amendment persisted')));
 assert.ok(!f.pi.userMessages.some(m=>m.message.includes('Accept — apply')),'host persists instead of merely steering acceptance prose');
 await f.pi.fire('session_shutdown',{reason:'quit'},f.ctx);
});
test('decline resumes original criteria without accepting an amendment',async()=>{
 const f=await fixture();await propose(f);f.ctx.ui.selectImpl=async(_t,options)=>options[1];await f.pi.command('goal','decide',f.ctx);
 assert.equal(readState(f.cwd).goal?.verificationContract,contract);assert.equal(readState(f.cwd).goal?.revision,3);assert.equal(readState(f.cwd).goal?.pauseContractAmendment,undefined);
 assert.ok(!f.ctx.ui.notifies.some(n=>n.message.includes('Contract amendment persisted')));await f.pi.fire('session_shutdown',{reason:'quit'},f.ctx);
});
test('restart retains concrete amendment consent and acceptance does not require agent memory',async()=>{
 const f=await fixture();await propose(f);await f.pi.fire('session_shutdown',{reason:'quit'},f.ctx);__testOnlyResetProcessState();
 const pi=new MockPi();activate(pi.api);const ctx=makeMockCtx(f.cwd);await pi.fire('session_start',{reason:'startup'},ctx);await tick(50);
 assert.equal(readState(f.cwd).goal?.status,'paused');ctx.ui.selectImpl=async(_t,options)=>options[0];await pi.command('goal','decide',ctx);
 assert.equal(readState(f.cwd).goal?.revision,4);assert.notEqual(readState(f.cwd).goal?.verificationContract,contract);await pi.fire('session_shutdown',{reason:'quit'},ctx);
});
test('failed amendment transaction reports no acceptance and retains the original hold',async()=>{
 const f=await fixture();await propose(f);const txn=goalStateTransactionPath(f.cwd);fs.mkdirSync(txn);
 try {
  f.ctx.ui.selectImpl=async(_t,options)=>options[0];await f.pi.command('goal','decide',f.ctx);
  const after=readState(f.cwd).goal!;assert.equal(after.verificationContract,contract);assert.equal(after.revision,3);assert.equal(after.status,'paused');
  assert.ok(f.ctx.ui.notifies.some(n=>n.message.includes('Amendment not saved')));assert.ok(!f.ctx.ui.notifies.some(n=>n.message.includes('Contract amendment persisted')));
 } finally {fs.rmdirSync(txn);await f.pi.fire('session_shutdown',{reason:'quit'},f.ctx);}
});
for(const failedProjection of ['markdown','journal'] as const) test(`late ${failedProjection} failure reports durable commit, stays held and recovers revised criteria`,async()=>{
 const f=await fixture();await propose(f);const before=readState(f.cwd).goal!;
 const target=failedProjection==='markdown'?goalMdPath(f.cwd,before.id):`${f.cwd}/.pi-glla/active.jsonl`;
 const saved=fs.readFileSync(target);fs.unlinkSync(target);fs.mkdirSync(target);
 try {
  f.ctx.ui.selectImpl=async(_t,options)=>options[0];await f.pi.command('goal','decide',f.ctx);
  const durable=readGoalStateTransaction(f.cwd)?.state.goal!;
  assert.equal(durable.status,'paused');assert.equal(durable.revision,4);assert.notEqual(durable.verificationContract,contract);
  assert.equal(durable.pauseContractAmendment,undefined);assert.equal(durable.pauseOptions,undefined);assert.deepEqual(durable.taskList,before.taskList);
  assert.ok(f.ctx.ui.notifies.some(n=>n.message.includes('Amendment committed to the durable recovery snapshot')));
  assert.ok(!f.ctx.ui.notifies.some(n=>n.message.includes('nothing was accepted')||n.message.startsWith('Contract amendment persisted')));
 } finally {fs.rmdirSync(target);fs.writeFileSync(target,saved);}
 __testOnlyResetProcessState();const pi=new MockPi();activate(pi.api);const ctx=makeMockCtx(f.cwd);await pi.fire('session_start',{reason:'startup'},ctx);await tick(50);
 const recovered=readState(f.cwd).goal!;assert.equal(recovered.status,'paused');assert.equal(recovered.revision,4);assert.notEqual(recovered.verificationContract,contract);assert.deepEqual(recovered.taskList,before.taskList);
 assert.equal(recovered.pauseContractAmendment,undefined);await pi.fire('session_shutdown',{reason:'quit'},ctx);
});
test('goal schema is executable JSON',()=>{
 const schema=JSON.parse(fs.readFileSync('schemas/goal.schema.json','utf8'));
 assert.ok(schema.properties.pauseContractAmendment);assert.ok(schema.properties.midRunDecisionCount);
});

test('stale proposal after an independently confirmed tweak reports no amendment',async()=>{
 const f=await fixture();await propose(f);const before=readState(f.cwd).goal!;
 f.ctx.ui.confirmImpl=async()=>true;
 await f.pi.command('goal',`tweak "${before.objective} Done when: 1. Keep original zero-failure criterion"`,f.ctx);
 const changed=readState(f.cwd).goal!;assert.equal(changed.revision,4);assert.equal(changed.status,'paused');
 f.ctx.ui.selectImpl=async(_t,options)=>options[0];await f.pi.command('goal','decide',f.ctx);
 assert.equal(readState(f.cwd).goal?.verificationContract,changed.verificationContract);assert.equal(readState(f.cwd).goal?.revision,4);assert.equal(readState(f.cwd).goal?.status,'paused');
 assert.ok(f.ctx.ui.notifies.some(n=>n.message.includes('Amendment not applied')));await f.pi.fire('session_shutdown',{reason:'quit'},f.ctx);
});
test('public tweak rejects misleading standalone contract edits and reports identical text as no change',async()=>{
 const f=await fixture();const before=readState(f.cwd).goal!;f.ctx.ui.confirmImpl=async()=>true;
 await f.pi.command('goal','tweak verification contract mechanical proof is enough',f.ctx);
 assert.equal(readState(f.cwd).goal?.objective,before.objective);assert.equal(readState(f.cwd).goal?.verificationContract,contract);
 assert.ok(f.ctx.ui.notifies.some(n=>n.message.includes('no standalone verification-contract')));
 await f.pi.command('goal',`tweak "${before.objective} Done when: ${contract}"`,f.ctx);
 assert.equal(readState(f.cwd).goal?.revision,3);assert.equal(readState(f.cwd).goal?.verificationContract,contract);
 assert.ok(f.ctx.ui.notifies.some(n=>n.message.includes('nothing was amended')));await f.pi.fire('session_shutdown',{reason:'quit'},f.ctx);
});
test('unsupported contract-edit guidance is never extracted as an executable suggestion',()=>{
 for(const text of ['Run /goal tweak --verification-contract "human transcripts waived"','Run /goal tweak "Done when: waived"','Run /goal tweak "verification contract mechanical evidence only"','Run /goal verify "replace criteria"']) assert.equal(extractSuggestedCommand(text),undefined);
});

test('unattended recommendation declines rather than waiving failing criteria',async()=>{
 const f=await fixture({runToDone:true});await f.pi.runTool('pause_goal',{kind:'blocked',reason:'Required full gate fails',suggestedAction:action},f.ctx);
 const goal=readState(f.cwd).goal!;assert.equal(goal.status,'active');assert.equal(goal.verificationContract,contract);assert.equal(goal.revision,3);assert.equal(goal.pauseContractAmendment,undefined);
 assert.ok(goal.autoDefaultLog?.[0]?.chosen.includes('Continue without it'));await f.pi.fire('session_shutdown',{reason:'quit'},f.ctx);
});
test('a classified material conflict never defaults to amendment or resumed criteria',async()=>{
 const f=await fixture({runToDone:true});
 await f.pi.runTool('pause_goal',{kind:'blocked',reason:'Full suite has actual failures',suggestedAction:action,
 interruption:{reason:'contract-conflict',evidence:'Zero failures required, but a failure is recorded'}},f.ctx);
 const goal=readState(f.cwd).goal!;assert.equal(goal.status,'paused');assert.equal(goal.verificationContract,contract);assert.equal(goal.revision,3);assert.ok(goal.pauseContractAmendment);
 assert.equal(goal.autoDefaultLog?.length??0,0);await f.pi.fire('session_shutdown',{reason:'quit'},f.ctx);
});

test('missing item or unchanged proposal cannot advertise acceptance',()=>{
 assert.equal(contractAmendmentPromotion('Amend item 99 to `node --version`',contract,'goal'),undefined);
 assert.equal(contractAmendmentPromotion('Amend item 1 to `node --version`','1. x\n1. y','goal'),undefined);
 assert.equal(contractAmendmentPromotion('Amend item 1 to `node --version`','1. `node --version` exits 0','goal'),undefined);
});
test('unbounded command replacement never drops undelimited or multiple-command predicates',()=>{
 for(const original of ['1. bun test exits 0 with zero failures','1. `bun test` and `node check.mjs` both exit 0']) {
  assert.equal(extractContractAmendment('Amend item 1 to `node --version`',original),undefined);
  assert.equal(contractAmendmentPromotion('Amend item 1 to `node --version`',original,'goal'),undefined);
 }
});

test('v0.39.38: numbered-line matching needs no replacement normalization',()=>{
 // The matcher returns the consent-target line itself (indented numbering
 // included) — pin the surviving shape after the dead `replacement` field
 // was removed.
 const indented=extractContractAmendment('Amend item 2 to `node verify.mjs`','1. `bun test` exits 0\n  2. `node check.mjs` exits 0');
 assert.equal(indented?.proposedContract,'1. `bun test` exits 0\n  2. `node verify.mjs` exits 0');
 assert.equal(indented?.originalItem,'  2. `node check.mjs` exits 0');
 assert.equal(extractContractAmendment('Amend item 9 to `node --version`','1. `bun test` exits 0'),undefined);
});
test('quote correction is separate from changed test coverage and preserves its predicate',()=>{
 const syntax=extractContractAmendment('Amend item 1 to `node script.mjs`','1. `node "script.mjs"` exits 0');
 assert.equal(syntax?.changeKind,'syntax-correction');assert.equal(syntax?.proposedContract,'1. `node script.mjs` exits 0');
 assert.equal(extractContractAmendment(action,contract)?.changeKind,'substantive-amendment');
 assert.match(contractAmendmentPromotion(action,contract,'goal')!.options[0]!,/substantive criteria change, not a syntax-only fix/);
});

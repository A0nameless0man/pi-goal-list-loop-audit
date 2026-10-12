import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import activate, {__testOnlyResetProcessState} from "../extensions/loops/goal.js";
import { readState } from "../extensions/goal-loop-core.js";
import { MockPi, makeMockCtx, seedGoal, seedState, tmpCwd, tick } from "./harness/mock-pi.js";

const settings=process.env.GLLA_GLOBAL_SETTINGS_PATH!;
async function boot(extra:Record<string,unknown>={}) {
  __testOnlyResetProcessState();
  fs.writeFileSync(settings,JSON.stringify({autoResume:true,aggressiveMode:false,decisionPauseBudget:0}));
  const cwd=tmpCwd();
  seedState(cwd,{goal:seedGoal({status:"active",runToDone:true,objective:"Implement the approved interface",verificationContract:"affected tests pass",...extra})});
  const pi=new MockPi();activate(pi.api);
  const ctx=makeMockCtx(cwd);await pi.fire("session_start",{reason:"startup"},ctx);await tick(50);
  return {cwd,pi,ctx};
}
afterEach(()=>__testOnlyResetProcessState());
for(const reason of ["mechanical-verification","reversible-work"] as const) {
 test(`${reason} continues without pause, option adoption, or command dispatch`,async()=>{
  const {cwd,pi,ctx}=await boot();const sent=pi.sent.length;
  const params={reason:"Run the known authorized work",kind:"decision",options:["continue","change criteria"],recommended:2,
    interruption:{reason,evidence:"Confirmed contract requires tests; interface changes are reversible",nextStep:"Run affected tests"}};
  const result=await pi.runTool("pause_goal",params,ctx);
  const repeated=await pi.runTool("pause_goal",params,ctx);
  assert.match(result.content[0]!.text,/Not paused: continue/);assert.match(repeated.content[0]!.text,/Not paused: continue/);
  const goal=readState(cwd).goal!;
  assert.equal(goal.status,"active");assert.equal(goal.verificationContract,"affected tests pass");
  assert.equal(goal.autoDefaultLog?.length??0,0);assert.equal(pi.sent.length,sent,"no duplicate follow-up dispatch");
  await pi.fire("session_shutdown",{reason:"quit"},ctx);
 });
}
for(const reason of ["missing-permission","missing-input","contract-conflict","unauthorized-irreversible-action"] as const) {
 test(`${reason} remains a real exception even under run-to-done and zero budget`,async()=>{
  const {cwd,pi,ctx}=await boot();
  const result=await pi.runTool("pause_goal",{reason:"Confirmed criteria require a material fact not available locally",kind:"decision",options:["provide the missing fact","waive the requirement"],recommended:2,
    interruption:{reason,evidence:"The confirmed requirement cannot be met with available authorization/evidence"}},ctx);
  assert.match(result.content[0]!.text,/paused/i);
  const goal=readState(cwd).goal!;assert.equal(goal.status,"paused");assert.equal(goal.verificationContract,"affected tests pass");
  assert.equal(goal.autoDefaultLog?.length??0,0);
  await pi.fire("session_shutdown",{reason:"quit"},ctx);
  __testOnlyResetProcessState();const nextPi=new MockPi();activate(nextPi.api);const nextCtx=makeMockCtx(cwd);
  await nextPi.fire("session_start",{reason:"startup"},nextCtx);await tick(50);
  assert.equal(readState(cwd).goal?.status,"paused","material exception survives restart");
  await nextPi.fire("session_shutdown",{reason:"quit"},nextCtx);
 });
}
test("intentional user pause cannot be undone by a classified routine request",async()=>{
 const {cwd,pi,ctx}=await boot();await pi.command("goal","pause",ctx);
 const before=readState(cwd).goal;const sent=pi.sent.length;
 await pi.runTool("pause_goal",{reason:"Continue tests",interruption:{reason:"mechanical-verification",evidence:"Tests are in contract",nextStep:"Run tests"}},ctx);
 assert.equal(readState(cwd).goal?.status,before?.status);assert.equal(readState(cwd).goal?.pauseReason,before?.pauseReason);
 assert.equal(pi.sent.length,sent);await pi.fire("session_shutdown",{reason:"quit"},ctx);
});
test("routine category without a known next step requests investigation, not human choice",async()=>{
 const {cwd,pi,ctx}=await boot();
 const result=await pi.runTool("pause_goal",{reason:"Unsure",interruption:{reason:"reversible-work",evidence:"No material requirement conflict established"}},ctx);
 assert.match(result.content[0]!.text,/investigate locally/);assert.equal(readState(cwd).goal?.status,"active");
 await pi.fire("session_shutdown",{reason:"quit"},ctx);
});

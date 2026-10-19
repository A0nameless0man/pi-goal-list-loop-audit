import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import ts from 'typescript';
import { appendStateSnapshot, clearQueueItemFiles, readState, writeQueueItemFile, type ListItem, type State } from '../extensions/goal-loop-core.js';
import { seedGoal, seedLoop, seedState, tmpCwd } from './harness/mock-pi.js';

// Protect the commit boundary, not the wording: a refused clear cannot
// admit replacement work or consume the decision, and must survive restart.
const source = ts.createSourceFile('goal-session.ts', fs.readFileSync('extensions/loops/goal-session.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const method = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'resolveCarryover');
assert.ok(method);
const script = ts.transpileModule(`${method.getText(source)}\nresolveCarryover;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

for (const withPredecessor of [false, true]) test(`carryover journal refusal retains retryable queue and held loop (archived predecessor=${withPredecessor})`, () => {
  const cwd = tmpCwd();
  const events: string[] = [];
  const item: ListItem = { id: 'waiting-fixture', objective: 'preserve this queued objective', addedAt: new Date().toISOString() };
  const heldReason = 'held-on-restore';
  seedState(cwd, { list: [item], loop: seedLoop({ active: false, stopReason: heldReason }),
    ...(withPredecessor ? { goal: seedGoal({ id: 'predecessor', status: 'paused' }) } : {}) });
  assert.equal(writeQueueItemFile(cwd, item).wrote, true);
  let failWrite = true;
  const ctx = { cwd, ui: { notify: (text: string) => events.push(`notify:${text}`) } };
  const sandbox = vm.createContext({
    state: readState(cwd), carryoverResolved: false,
    carryoverSnapshot: { listCount: 1, heldLoop: 'fixture loop', ...(withPredecessor ? { pausedGoal: 'old objective' } : {}) },
    loadSettings: () => ({ carryover: 'clear' }), HELD_ON_RESTORE: heldReason,
    clearQueueItemFiles, path, archivedGoalPath: () => 'archive/predecessor.md',
    compactTerminalCompletionSummary: () => 'archived predecessor recap', compactLoopCompletionSummary: () => 'cleared loop recap',
    displaySlice: (text: string) => text, workCommand: () => '/goal resume',
    appendLedger: (_cwd: string, type: string) => events.push(type), refreshUI: () => {},
    replaceState: (next: State) => { sandbox.state = next; },
    persistState: () => failWrite ? false : appendStateSnapshot(cwd, sandbox.state as State),
    archiveCurrentGoal: () => {
      sandbox.state = { ...(sandbox.state as State), goal: null };
      assert.equal(appendStateSnapshot(cwd, sandbox.state as State), true);
      events.push('archive'); return true;
    },
  });
  const resolve = vm.runInContext(script, sandbox) as (ctx: unknown, trigger: string) => boolean;
  assert.equal(resolve(ctx, 'goal'), false, 'replacement activation must not be admitted');
  assert.equal(sandbox.carryoverResolved, false);
  assert.ok(sandbox.carryoverSnapshot, 'retry retains the carryover decision');
  assert.equal((sandbox.state as State).list?.[0]?.id, item.id);
  assert.equal((sandbox.state as State).loop?.stopReason, heldReason);
  assert.equal(readState(cwd).list?.[0]?.id, item.id, 'journal still recovers the queue even though sidecars were deleted');
  assert.equal(clearQueueItemFiles(cwd).removed, 0, 'sidecar deletion really happened before the failed snapshot');
  assert.ok(!events.includes('carryover_resolved'));
  assert.ok(!events.some(event => event.startsWith('notify:Carryover cleared')));
  if (withPredecessor) assert.equal((sandbox.state as State).goal, null, 'do not resurrect an independently committed archive');

  failWrite = false;
  assert.equal(resolve(ctx, 'goal'), true);
  assert.equal(sandbox.carryoverResolved, true);
  assert.equal(sandbox.carryoverSnapshot, null);
  assert.equal(readState(cwd).list?.length, 0, 'successful retry stays cleared across restart');
  assert.equal(readState(cwd).loop?.stopReason, 'cleared: carryover');
  assert.equal(events.filter(event => event === 'carryover_resolved').length, 1);
  assert.equal(events.filter(event => event === 'archive').length, withPredecessor ? 1 : 0);
});

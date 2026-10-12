import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual tool method with the same boolean refusal exposed by
// the production transaction boundary, without touching the live journal.
const source = ts.createSourceFile('goal-tools.ts', fs.readFileSync('extensions/loops/goal-tools.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let method: ts.MethodDeclaration | undefined;
function visit(node: ts.Node): void {
  if (ts.isObjectLiteralExpression(node) && node.properties.some(p => ts.isPropertyAssignment(p) && p.name.getText(source) === 'name' && ts.isStringLiteral(p.initializer) && p.initializer.text === 'pause_goal')) {
    method = node.properties.find(p => ts.isMethodDeclaration(p) && p.name.getText(source) === 'execute') as ts.MethodDeclaration;
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(method);
const script = ts.transpileModule(`({${method.getText(source)}}).execute`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

for (const admitted of [false, true]) test(`pause result reflects durable admission=${admitted}`, async () => {
  const events: string[] = [];
  const state = { goal: { id: 'fixture', status: 'active', policy: 'goal', objective: 'need approval' } };
  const ctx = { cwd: '/fixture', sessionManager: {}, ui: { notify: () => events.push('notify') }, abort: () => events.push('abort') };
  const noop = () => {};
  const execute = vm.runInNewContext(script, {
    state, foreignToolGuard: () => undefined, currentToolContext: () => ctx,
    claimedMissingGllaTool: () => undefined, isProviderRecoveryArmed: () => false,
    providerErrorPresentation: (raw: string) => ({ sensitive: false, display: raw }),
    sanitizeProviderDisplayText: (text: string) => text,
    updateGoal: (patch: object) => { if (admitted) Object.assign(state.goal, patch); return admitted; },
    maybeDecisionPopup: noop, buildActionReminder: () => ({ content: 'paused', details: {} }),
    extensionApi: { sendMessage: () => events.push('card') }, ACTION_REMINDER_CUSTOM_TYPE: 'fixture',
    activeGoalSurfaceCommand: (command: string) => `/goal ${command}`, goalNoun: () => 'Goal',
    notifyExternal: noop, markPauseAbort: noop, clearPauseAbort: noop, appendLedger: noop,
  });
  const result = await execute('fixture', { kind: 'decision', reason: 'Need approval', interruption: {reason: 'missing-permission', evidence: 'Required external operation lacks authorization'} }, undefined, undefined, ctx);
  if (!admitted) {
    assert.equal(result.isError, true);
    assert.equal(state.goal.status, 'active');
    assert.deepEqual(events, [], 'no success card, popup, notification or abort for a refused pause');
    assert.match(result.content[0].text, /Pause could not be saved/);
  } else {
    assert.equal(state.goal.status, 'paused');
    assert.equal(result.isError, undefined);
    assert.deepEqual(events, ['card', 'notify', 'abort']);
    assert.match(result.content[0].text, /Goal paused/);
  }
});

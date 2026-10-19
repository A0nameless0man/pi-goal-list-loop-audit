import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as vm from 'node:vm';
import ts from 'typescript';

// Exercise the registered method itself. A refused durable transition must
// not release feedback, retry a claim or tell the agent to continue working.
const source = ts.createSourceFile('goal-tools.ts', fs.readFileSync('extensions/loops/goal-tools.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let method: ts.MethodDeclaration | undefined;
function visit(node: ts.Node): void {
  if (ts.isObjectLiteralExpression(node) && node.properties.some(p => ts.isPropertyAssignment(p) && p.name.getText(source) === 'name' && ts.isStringLiteral(p.initializer) && p.initializer.text === 'resume_goal')) {
    method = node.properties.find(p => ts.isMethodDeclaration(p) && p.name.getText(source) === 'execute') as ts.MethodDeclaration;
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(method);
const script = ts.transpileModule(`({${method.getText(source)}}).execute`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

for (const policy of ['goal', 'list']) for (const storedClaim of [false, true]) for (const outcome of ['refused', 'partial', 'committed']) {
  test(`resume ${policy} admission=${outcome}, stored claim=${storedClaim}`, async () => {
    const events: string[] = [];
    const state = { goal: { id: 'fixture', status: 'paused', policy, objective: 'authorized work', pauseReason: 'needs approval',
      pendingCompletion: storedClaim ? { phase: 'parked' } : undefined } };
    const ctx = { cwd: '/fixture', sessionManager: {}, ui: { notify: (text: string) => events.push(`notify:${text}`) } };
    const execute = vm.runInNewContext(script, {
      state, foreignToolGuard: () => undefined, currentToolContext: () => ctx,
      goalNoun: () => policy === 'list' ? 'list item' : 'goal', isLoopActive: () => false,
      clearLoadHold: () => false, warnIfStaleAtEntry: () => false,
      loadSettings: () => ({}), DEFAULT_TOKEN_LIMIT: 0,
      updateGoal: (patch: object) => {
        events.push('update');
        // A saved transaction may already own the active RAM projection
        // while markdown/state projection fails. Never falsely roll it back.
        if (outcome !== 'refused') Object.assign(state.goal, patch);
        return outcome === 'committed';
      },
      releaseAuditorSurfaceForGoal: () => events.push('release-feedback'),
      appendLedger: (_cwd: string, type: string) => events.push(type), clipSummaryValue: (text: string) => text,
      resumeStoredCompletionOrSettlement: (_ctx: unknown, _via: string, retry: (ctx: unknown) => void) => { events.push('claim-resume'); retry(ctx); return 'retried'; },
      retryStoredCompletionAudit: () => { events.push('retry-audit'); },
      listQueue: () => [], displaySlice: (text: string) => text,
    });
    const result = await execute('fixture', { reason: 'user supplied the required approval' }, undefined, undefined, ctx);
    if (outcome !== 'committed') {
      assert.equal(result.isError, true);
      assert.deepEqual(events, ['update'], 'no feedback release, success ledger, notifications or audit retry after refusal');
      assert.equal(state.goal.status, outcome === 'partial' ? 'active' : 'paused', 'preserve the persistence helper\'s authoritative projection');
      assert.match(result.content[0].text, /Resume could not be saved/);
      assert.doesNotMatch(result.content[0].text, /is active again|Continue working|auditor is now running|remains paused/i);
    } else {
      assert.equal(result.isError, undefined);
      assert.equal(state.goal.status, 'active');
      assert.ok(events.indexOf('update') < events.indexOf('release-feedback'));
      assert.ok(events.includes('goal_resumed'));
      if (storedClaim) {
        assert.ok(events.includes('retry-audit'));
        assert.match(result.content[0].text, /detached auditor is now running/);
      } else {
        assert.ok(!events.includes('retry-audit'));
        assert.match(result.content[0].text, /Continue working in THIS turn/);
      }
    }
  });
}

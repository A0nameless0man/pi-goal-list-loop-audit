// Real Pi SDK + public GLLA entrypoint, loopback-only scripted provider.
// Run directly, never from a recursively spawned project test suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glla-isolated-recovery-'));
const cwd = path.join(root, 'project');
const agentDir = path.join(root, 'agent');
fs.mkdirSync(cwd); fs.mkdirSync(agentDir);
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.GLLA_GLOBAL_SETTINGS_PATH = path.join(root, 'glla-settings.json');
fs.writeFileSync(process.env.GLLA_GLOBAL_SETTINGS_PATH, JSON.stringify({
  mainModelFallbacks: ['fixture/backup'], mainModelSameModelRetries: 10,
  mainModelRetryMinutes: 0.0002, hourlyRetryProbe: false,
  contextThreshold: 0, notifyExternal: false,
}));
const trace = [];
const record = (event) => { trace.push({ at: new Date().toISOString(), ...event }); fs.writeFileSync(path.join(root, 'trace.json'), JSON.stringify(trace, null, 2)); };
let session;
let work = false;
let checkpointResolve;
let checkpointReject;
const checkpoint = new Promise((resolve, reject) => { checkpointResolve = resolve; checkpointReject = reject; });
// Install an observer immediately; the driver still awaits the original
// promise, including failures that arrive before its dependency barrier.
checkpoint.catch(() => {});
const server = http.createServer(async (req, res) => {
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    assert.equal(req.url, '/v1/chat/completions');
    assert.ok(['primary', 'backup'].includes(payload.model));
    record({ type: 'request', model: payload.model, messageCount: payload.messages.length });
    assert.ok(trace.filter(event => event.type === 'request').length <= 12, 'fixture request budget exhausted');
    if (payload.model === 'primary') {
      // HTTP 400 deliberately avoids SDK HTTP retry: provider error body is
      // the same hintless Token Plan wording; GLLA owns every logical retry.
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: '429 Token Plan rate limit reached (2062)', type: 'fixture_error', code: '2062' } }));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ id: 'fixture-response', object: 'chat.completion.chunk', created: Math.floor(Date.now()/1000), model: 'backup', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      send({ role: 'assistant' });
      send({ tool_calls: [{ index: 0, id: 'fixture-checkpoint', type: 'function', function: { name: 'fixture_checkpoint', arguments: '{}' } }] });
      send({}, 'tool_calls');
      res.end('data: [DONE]\n\n');
    }
  } catch (error) { record({ type: 'server_error', error: String(error) }); checkpointReject(error); res.writeHead(500); res.end('fixture failed'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
fs.writeFileSync(path.join(agentDir, 'models.json'), JSON.stringify({ providers: { fixture: {
  baseUrl: `http://127.0.0.1:${port}/v1`, api: 'openai-completions', apiKey: 'isolated-dummy-key',
  models: ['primary', 'backup'].map(id => ({ id, name: id, reasoning: false, input: ['text'], contextWindow: 200000, maxTokens: 1024, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })),
} } }));
let deadline;
try {
  const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } = await import('@earendil-works/pi-coding-agent');
  const { Type } = await import('typebox');
  const settingsManager = SettingsManager.inMemory({ retry: { enabled: false, provider: { maxRetries: 0 } }, compaction: { enabled: false }, cacheWarming: 'off', enableInstallTelemetry: false, defaultProjectTrust: 'always' });
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: path.join(agentDir, 'models.json'), modelNetworkEnabled: false });
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true,
    additionalExtensionPaths: [path.join(repo, 'extensions/loops/goal.ts')],
    extensionFactories: [pi => {
      pi.on('session_start', () => pi.setActiveTools([...pi.getActiveTools(), 'fixture_checkpoint']));
      pi.registerTool({ name: 'fixture_checkpoint', label: 'Fixture checkpoint', description: 'Complete isolated fixture work', parameters: Type.Object({}),
      async execute(_id, _args, _signal, _update, ctx) {
        const lines = fs.readFileSync(path.join(cwd, '.pi-glla', 'active.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
        const state = [...lines].reverse().find(line => line.type === 'state')?.value;
        assert.equal(state.goal.status, 'active', 'fallback resumed the real supervised goal before work');
        assert.equal(ctx.model.id, 'backup');
        fs.writeFileSync(path.join(cwd, 'work-checkpoint.txt'), 'resumed supervised work on fixture/backup\n');
        record({ type: 'work_checkpoint', model: ctx.model.id, goalStatus: state.goal.status });
        work = true;
        checkpointResolve();
        return { content: [{ type: 'text', text: 'Isolated work checkpoint reached.' }], details: {}, terminate: true };
      },
    }); }],
  });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  record({ type: 'extensions_loaded', paths: loader.getExtensions().extensions.map(extension => extension.path), commands: loader.getExtensions().extensions.flatMap(extension => [...extension.commands.keys()]) });
  const model = modelRuntime.getModel('fixture', 'primary'); assert.ok(model);
  const result = await createAgentSession({ cwd, agentDir, modelRuntime, model, thinkingLevel: 'off', resourceLoader: loader, settingsManager, sessionManager: SessionManager.create(cwd, path.join(root, 'sessions')), tools: [] });
  session = result.session;
  // Supply a concrete, enumerable headless UI implementation. A proxy is
  // not suitable here: Pi copies UI methods when building each context.
  const noop = () => {};
  const uiContext = {
    select: async () => undefined, confirm: async () => false, input: async () => undefined,
    notify: (message, level) => record({ type: 'notification', message, level }),
    onTerminalInput: () => noop, setStatus: noop, setWorkingMessage: noop,
    setWorkingVisible: noop, setWorkingIndicator: noop, setHiddenThinkingLabel: noop,
    setWidget: noop, setFooter: noop, setHeader: noop, setTitle: noop,
    custom: async () => undefined, pasteToEditor: noop, setEditorText: noop,
    getEditorText: () => '', editor: async () => undefined,
    addAutocompleteProvider: noop, setEditorComponent: noop, getEditorComponent: () => undefined,
    getAllThemes: () => [], getTheme: () => undefined,
    setTheme: () => ({ success: false, error: 'Headless fixture' }),
    getToolsExpanded: () => false, setToolsExpanded: noop,
  };
  await session.bindExtensions({ mode: 'json', uiContext,
    onError: error => record({ type: 'extension_error', error: JSON.stringify(error) }) });
  session.subscribe(event => {
    if (['agent_start', 'agent_end', 'agent_settled', 'model_change', 'tool_execution_end'].includes(event.type)) record({ type: event.type, toolName: event.toolName });
    if (event.type === 'message_end' && event.message.role === 'assistant') record({ type: 'assistant_end', model: event.message.model, stopReason: event.message.stopReason, error: event.message.errorMessage });
    if (event.type === 'tool_execution_end' && event.isError) {
      record({ type: 'tool_error', toolName: event.toolName, result: event.result });
      checkpointReject(new Error(`Fixture tool failed: ${event.toolName}`));
    }
  });
  record({ type: 'session', sessionId: session.sessionManager.getSessionId(), sessionFile: session.sessionManager.getSessionFile(), root });
  await session.prompt('/goal start Verify isolated recovery and call fixture_checkpoint after recovery');
  assert.ok(fs.existsSync(path.join(cwd, '.pi-glla', 'active.jsonl')), 'real goal command admitted a durable goal');
  await Promise.race([checkpoint, new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('isolated recovery deadline exceeded')), 90000); })]);
  await session.prompt('/goal pause');
  await session.abort();
  const requests = trace.filter(event => event.type === 'request');
  assert.equal(requests.filter(event => event.model === 'primary').length, 11, 'initial failure + all ten configured same-model retries');
  assert.equal(requests[11].model, 'backup', 'fallback only after retry budget exhaustion');
  assert.ok(work);
  assert.equal(trace.filter(event => event.type === 'extension_error' || event.type === 'server_error').length, 0);
  const ledger = fs.readFileSync(path.join(cwd, '.pi-glla', 'active.jsonl'), 'utf8');
  assert.ok((ledger.match(/"main_model_probe"/g) ?? []).length >= 10);
  assert.match(ledger, /main_model_fallback/);
  record({ type: 'verified', primaryRequests: 11, fallback: 'fixture/backup', workResumed: work });
  console.log(`ISOLATED_RECOVERY_PASS ${root}`);
} catch (error) {
  record({ type: 'verification_failed', error: String(error), stack: error.stack });
  console.error(`ISOLATED_RECOVERY_FAIL ${root}`, error);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  if (session) { await session.abort(); session.dispose(); }
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

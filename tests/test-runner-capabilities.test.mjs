import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bunTestCapabilityError } from '../scripts/run-tests.mjs';

const supported = '--parallel=<n>\n--max-concurrency=<n>\n--path-ignore-patterns=<pattern>';
test('runner requires capabilities rather than trusting a version or help prose', () => {
  const probe = stdout => () => ({ status: 0, stdout });
  assert.equal(bunTestCapabilityError(probe(supported)), undefined);
  assert.equal(bunTestCapabilityError(probe(`Usage changed\n${supported.replaceAll('=', ' ')}\nMore prose`)), undefined);
  assert.match(bunTestCapabilityError(probe('--max-concurrency=<n>')), /--parallel.*--path-ignore-patterns/);
  assert.match(bunTestCapabilityError(probe(supported.replace('--parallel', '--parallelism'))), /--parallel/);
  assert.match(bunTestCapabilityError(() => ({ status: 1, stdout: supported })), /Could not inspect/);
  assert.match(bunTestCapabilityError(() => ({ status: null, error: new Error('probe timeout') })), /probe timeout/);
});

test('unsupported Bun fails before any suite spawn (stub only, never a nested real suite)', { skip: process.platform === 'win32', timeout: 20000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glla-bun-capabilities-'));
  try {
    const marker = path.join(dir, 'suite-started');
    fs.writeFileSync(path.join(dir, 'bun'), `#!/usr/bin/env node
if (process.argv.includes('--help')) { console.log('--max-concurrency=<n>'); process.exit(0); }
require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unexpected suite');
`, { mode: 0o755 });
    const result = spawnSync(process.execPath, [path.resolve('scripts/run-tests.mjs'), '--all'], {
      env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}` }, encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /lacks required capabilities/);
    assert.equal(fs.existsSync(marker), false, 'unknown flags must not run a narrowed, false-green suite');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

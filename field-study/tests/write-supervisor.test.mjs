import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as supervisor from '../write-supervisor.mjs';

const workerPath = fileURLToPath(new URL('./fixtures/owned-child.mjs', import.meta.url));
function options(mode) { return { workerPath, args: [mode], record: () => {}, checkpoint: async () => 'continue', timeoutMs: 5000 }; }

test('supervisor starts a genuinely separate PID and observes normal exit', async () => {
  const result = await supervisor.superviseWorker(options('finish'));
  assert.notEqual(result.pid, process.pid);
  assert.equal(result.exit_code, 0);
  assert.equal(result.signal, null);
  assert.equal(result.finished.result_file, 'result.json');
});

test('checkpoint resumes only after parent handles it', async () => {
  const observed = [];
  const result = await supervisor.superviseWorker({ ...options('checkpoint'), checkpoint: async stage => {
    observed.push(stage); return 'continue';
  } });
  assert.deepEqual(observed, ['test-cut']);
  assert.equal(result.exit_code, 0);
});

test('planned crash uses SIGKILL on the owned child process group', async () => {
  const result = await supervisor.superviseWorker({ ...options('checkpoint'), checkpoint: async () => 'kill' });
  assert.equal(result.signal, 'SIGKILL');
  assert.equal(result.planned_kill, true);
  assert.equal(result.finished, null);
});

test('unexpected IPC causes fail-stop instead of arbitrary execution', async () => {
  await assert.rejects(() => supervisor.superviseWorker(options('bad')), /worker_ipc/);
});

test('zero exit without completion is not a successful worker', async () => {
  await assert.rejects(() => supervisor.superviseWorker(options('silent')), /worker_missing_output/);
});

test('watchdog stops a hung owned process and reports a timeout', async () => {
  await assert.rejects(() => supervisor.superviseWorker({ ...options('wait'), timeoutMs: 80 }), /worker_timeout/);
});

test('parent journal failure stops the child instead of resuming a pending write', async () => {
  await assert.rejects(() => supervisor.superviseWorker({ ...options('checkpoint'), record: event => {
    if (event.type === 'worker_checkpoint') throw new Error('journal_disk_failed');
  } }), /journal_disk_failed/);
});

test('invalid timeout is rejected before spawning', async () => {
  await assert.rejects(() => supervisor.superviseWorker({ ...options('finish'), timeoutMs: 0 }), /supervisor_configuration/);
});

test('worker failure kills still-running owned descendants after the leader exits', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'owned-descendant-')), 'pid');
  await assert.rejects(() => supervisor.superviseWorker({ ...options('orphan'), args: ['orphan', path] }), /worker_missing_output/);
  const pid = Number(readFileSync(path, 'utf8'));
  const alive = () => {
    try { const state = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return state.length > 0 && !state.startsWith('Z'); } catch { return false; }
  };
  try {
    for (let i = 0; i < 20 && alive(); i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(alive(), false);
  } finally { try { process.kill(pid, 'SIGKILL'); } catch { /* Owned fixture already exited. */ } }
});

test('supervisor rejects asynchronous recorder contracts rather than ignoring their failures', async () => {
  await assert.rejects(() => supervisor.superviseWorker({ ...options('checkpoint'), record: async () => {} }), /supervisor_async_journal/);
});

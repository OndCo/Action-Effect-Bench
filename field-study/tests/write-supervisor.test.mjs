import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
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

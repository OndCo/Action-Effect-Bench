import { fork } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { performance } from 'node:perf_hooks';
import { assertPublicValue } from './artifacts.mjs';

export async function superviseWorker({ workerPath, args, record, checkpoint, timeoutMs = 180000 }) {
  if (!isAbsolute(workerPath) || !Array.isArray(args) || args.some(value => typeof value !== 'string')
    || typeof record !== 'function' || typeof checkpoint !== 'function'
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000
    || process.platform === 'win32') throw new Error('supervisor_configuration');
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', TZ: 'America/Toronto' };
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const child = fork(workerPath, args, { env, detached: true, execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    let finished = null, plannedKill = false, failure, processing = false, closed = false;
    const seen = new Set();
    function kill() {
      if (!closed && Number.isSafeInteger(child.pid) && child.pid > 1 && child.pid !== process.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') failure ??= error; }
      }
    }
    function fail(error) { failure ??= error; kill(); }
    const timer = setTimeout(() => fail(new Error('worker_timeout')), timeoutMs);
    child.on('error', fail);
    child.on('message', message => {
      if (processing || finished || plannedKill) { fail(new Error('worker_ipc')); return; }
      processing = true;
      (async () => {
        assertPublicValue(message);
        if (message?.type === 'checkpoint' && Object.keys(message).sort().join(',') === 'stage,type'
          && typeof message.stage === 'string' && /^[a-z][a-z-]{0,47}$/.test(message.stage) && !seen.has(message.stage)) {
          seen.add(message.stage);
          record({ type: 'worker_checkpoint', pid: child.pid, stage: message.stage });
          const action = await checkpoint(message.stage);
          if (action === 'kill') {
            plannedKill = true;
            record({ type: 'worker_kill_requested', pid: child.pid, stage: message.stage, signal: 'SIGKILL' });
            kill();
          } else if (action === 'continue') {
            child.send({ type: 'continue', stage: message.stage }, error => { if (error) fail(error); });
          } else throw new Error('worker_ipc');
        } else if (message?.type === 'finished' && Object.keys(message).sort().join(',') === 'result_file,type'
          && typeof message.result_file === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(message.result_file)) {
          finished = message;
        } else throw new Error('worker_ipc');
      })().catch(fail).finally(() => { processing = false; });
    });
    child.on('close', (code, signal) => {
      closed = true;
      clearTimeout(timer);
      const result = { pid: child.pid, exit_code: code, signal, planned_kill: plannedKill,
        finished, elapsed_ms: performance.now() - started };
      try { record({ type: 'worker_exit', ...result }); } catch (error) { failure ??= error; }
      if (failure) reject(failure);
      else if ((!finished && !plannedKill) || (plannedKill ? signal !== 'SIGKILL' : code !== 0 || signal !== null)) {
        reject(new Error('worker_missing_output'));
      } else resolve(result);
    });
    try { record({ type: 'worker_spawn', pid: child.pid }); } catch (error) { fail(error); }
  });
}

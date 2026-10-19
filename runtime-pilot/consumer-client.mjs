import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { parseStrict } from '../../action-effect-spec/implementations/javascript/strict-json.mjs';

export function callConsumer(request, options = {}) {
  const started = performance.now();
  const failure = reason => ({ status: 'evaluation_failure', reason, authority: 'not_evaluated',
    consumer_ms: performance.now() - started });
  const process = spawnSync(options.pythonPath ?? 'python3', ['-B',
    fileURLToPath(new URL('./python/consumer.py', import.meta.url))], {
    input: `${JSON.stringify(request)}\n`, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
    timeout: 10000, windowsHide: true
  });
  if (process.error || process.status !== 0) return failure('consumer_process');
  try {
    const result = parseStrict(Buffer.from(process.stdout.trim()));
    if (result?.authority !== 'not_evaluated' || typeof result.status !== 'string' || typeof result.reason !== 'string') {
      return failure('consumer_output');
    }
    if (result.status === 'accepted_partial' && (!result.projection || typeof result.projection !== 'object')) {
      return failure('consumer_output');
    }
    return { ...result, consumer_stdout_b64: Buffer.from(process.stdout).toString('base64'),
      consumer_stderr_bytes: Buffer.byteLength(process.stderr ?? ''), consumer_ms: performance.now() - started };
  } catch { return failure('consumer_output'); }
}

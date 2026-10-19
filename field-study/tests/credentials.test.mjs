import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialReaders } from '../credentials.mjs';

test('credentials are captured in memory and never placed in subprocess arguments', () => {
  const calls = [];
  const credentials = credentialReaders((file, args, options) => { calls.push({ file, args, options }); return 'fixture-secret\n'; });
  assert.equal(credentials.github(), 'fixture-secret');
  assert.deepEqual(credentials.azure(), { kind: 'api-key', value: 'fixture-secret' });
  for (const call of calls) {
    assert.equal(call.args.includes('fixture-secret'), false);
    assert.deepEqual(call.options.stdio, ['ignore', 'pipe', 'pipe']);
  }
});

test('credential acquisition failures do not expose CLI output', () => {
  const credentials = credentialReaders(() => { throw new Error('raw sensitive output'); });
  assert.throws(credentials.github, error => error.message === 'github_auth_unavailable');
  assert.throws(credentials.azure, error => error.message === 'azure_auth_unavailable');
});

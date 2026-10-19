import assert from 'node:assert/strict';
import test from 'node:test';

async function harness() {
  try { return await import('./run.mjs'); }
  catch (error) { assert.fail(`Comparison runner unavailable: ${error.code ?? error.message}`); }
}
const request = { id: 't', op: 'check', document_b64: 'e30=' };
const expected = { status: 'invalid_input', reason: 'structure' };
const row = { id: 't', result: { ...expected, authority: 'not_evaluated' } };

test('score checks authority, complete shape, ID and expected outcome', async () => {
  const { scoreResponse } = await harness();
  assert.equal(scoreResponse(row, expected, 't').matched, true);
  assert.equal(scoreResponse({ ...row, id: 'other' }, expected, 't').matched, false);
  assert.equal(scoreResponse({ ...row, result: { ...row.result, allow: true } }, expected, 't').matched, false);
  assert.equal(scoreResponse({ ...row, result: { ...row.result, authority: 'granted' } }, expected, 't').matched, false);
  assert.equal(scoreResponse(row, { status: 'accepted_partial', reason: 'declared_partial' }, 't').matched, false);
});

test('duplicate keys, multiple responses, arrays and invalid bytes are not valid responses', async () => {
  const { parseResponse } = await harness();
  for (const text of ['{"id":"wrong","id":"t","result":{}}',
    '{"id":"t","result":{"status":"bad","status":"invalid_input"}}',
    JSON.stringify(row) + '\n' + JSON.stringify(row), '[]', '\n']) {
    assert.throws(() => parseResponse(Buffer.from(text)));
  }
  assert.throws(() => parseResponse(Buffer.from([0xff])));
  assert.deepEqual(parseResponse(Buffer.from(JSON.stringify(row) + '\n')), row);
});

test('a real worker response is checked against independently supplied expectations', async () => {
  const { runAdapter } = await harness();
  const actual = runAdapter({ command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(JSON.stringify(row) + '\n')})`] }, request, expected);
  assert.equal(actual.transport_ok, true);
  assert.equal(actual.matched, true);
});

test('response counts cannot round a noninteger into a passing integer result', async () => {
  const { parseResponse, runAdapter } = await harness();
  const valid = { id: 't', result: { status: 'accepted_partial', reason: 'declared_partial',
    authority: 'not_evaluated', description_digest: '0'.repeat(64), effect_count: 1, unresolved_count: 1 } };
  const raw = token => JSON.stringify(valid).replace('"effect_count":1', `"effect_count":${token}`) + '\n';
  for (const token of ['1.0000000000000001', '0.99999999999999999', '1e-400', '9007199254740992']) {
    assert.throws(() => parseResponse(Buffer.from(raw(token))), token);
  }
  for (const token of ['1', '1.0', '0.1e1', '10e-1', '1000.000e-3']) {
    assert.deepEqual(parseResponse(Buffer.from(raw(token))), valid, token);
  }
  const actual = runAdapter({ command: process.execPath,
    args: ['-e', `process.stdout.write(${JSON.stringify(raw('1.0000000000000001'))})`] }, request, valid.result);
  assert.equal(actual.transport_ok, false);
  assert.equal(actual.matched, false);
  assert.equal(Buffer.from(actual.stdout_b64, 'base64').toString(), raw('1.0000000000000001'));
});

test('invalid response contracts are counted as adapter faults, not semantic agreement', async () => {
  const { runAdapter, agree } = await harness();
  for (const invalid of [{ ...row, id: 'other' }, { ...row, result: { ...row.result, unexpected: true } }]) {
    const actual = runAdapter({ command: process.execPath,
      args: ['-e', `process.stdout.write(${JSON.stringify(JSON.stringify(invalid) + '\n')})`] }, request, expected);
    assert.equal(actual.transport_ok, false);
    assert.equal(actual.error, 'adapter_contract');
    assert.equal(actual.matched, false);
    assert.equal(agree(actual, actual), false);
  }
});

test('crash, malformed output and missing response never count as a correct refusal', async () => {
  const { runAdapter, agree } = await harness();
  for (const code of ['process.exit(7)', 'console.log("not-json")', 'process.exit(0)',
    `console.log(${JSON.stringify(JSON.stringify(row))});console.log(${JSON.stringify(JSON.stringify(row))})`]) {
    const actual = runAdapter({ command: process.execPath, args: ['-e', code] }, request, expected);
    assert.equal(actual.matched, false);
    assert.equal(actual.transport_ok, false);
    assert.equal(agree(actual, actual), false);
  }
});

test('runner bounds hung workers rather than dropping their result', async () => {
  const { runAdapter } = await harness();
  const actual = runAdapter({ command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] }, request, expected, { timeout: 100 });
  assert.equal(actual.matched, false);
  assert.equal(actual.transport_ok, false);
  assert.equal(actual.error, 'adapter_timeout');
});

test('agreement does not replace reference accuracy', async () => {
  const { agree } = await harness();
  const wrong = { transport_ok: true, matched: false, response: row };
  assert.equal(agree(wrong, wrong), true);
  assert.equal(wrong.matched, false);
});

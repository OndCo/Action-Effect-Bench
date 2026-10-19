// Synthetic Responses-shaped fixtures only; these are not provider measurements.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAzureModel } from '../model-client.mjs';

const endpoint = 'https://fixture-resource.openai.azure.com/openai/v1/responses';
const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15, output_tokens_details: { reasoning_tokens: 2 } };
const functionSchema = { type: 'function', name: 'read_fixture', description: 'Read a synthetic fixture.', strict: true, parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } };
const reply = (overrides = {}) => ({ id: 'resp_fixture', object: 'response', model: 'fixture-model', status: 'completed', usage, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"ok":true}' }] }], ...overrides });
const response = (body, status = 200) => ({ status, ok: status >= 200 && status < 300, redirected: false, url: endpoint, json: async () => body });
function setup(overrides = {}) {
  const calls = [], authCalls = [];
  const model = createAzureModel({ endpoint, deployment: 'fixture-deployment', timeoutMs: 1000, maxOutputTokens: 512,
    authProvider: async () => { authCalls.push(true); return { kind: 'bearer', value: 'fixture-only-value' }; },
    fetchImpl: async (...args) => { calls.push(args); return response(reply()); }, ...overrides });
  return { model, calls, authCalls };
}
const input = [{ role: 'user', content: 'Return a JSON report about the synthetic fixture.' }];

test('model client posts only to the configured Responses v1 endpoint without storing or retrying', async () => {
  const { model, calls, authCalls } = setup();
  const result = await model.respond(input, [functionSchema]);
  assert.equal(calls.length, 1);
  assert.equal(authCalls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, endpoint);
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'error');
  assert.equal(options.credentials, 'omit');
  assert.equal(new Headers(options.headers).get('authorization'), 'Bearer fixture-only-value');
  const body = JSON.parse(options.body);
  assert.equal(body.model, 'fixture-deployment');
  assert.equal(body.store, false);
  assert.equal(body.stream, false);
  assert.equal(body.background, false);
  assert.equal(body.parallel_tool_calls, false);
  assert.equal(body.max_output_tokens, 512);
  assert.deepEqual(body.reasoning, { effort: 'low' });
  assert.deepEqual(body.include, ['reasoning.encrypted_content']);
  assert.deepEqual(body.input, input);
  assert.deepEqual(body.tools, [functionSchema]);
  assert(!Object.hasOwn(body, 'previous_response_id'));
  assert.deepEqual(Object.keys(result).sort(), ['duration_ms', 'model', 'output', 'response_id', 'status', 'usage']);
  assert.deepEqual(result.output, reply().output);
  assert.deepEqual(result.usage, usage);
  assert.equal(result.response_id, 'resp_fixture');
  assert(result.duration_ms >= 0 && Number.isFinite(result.duration_ms));
});

test('model client supports an injected API key without exposing either auth form in its result', async () => {
  let headers;
  const { model } = setup({ authProvider: () => ({ kind: 'api-key', value: 'fixture-key-only' }), fetchImpl: async (_, options) => { headers = new Headers(options.headers); return response(reply()); } });
  const result = await model.respond(input, []);
  assert.equal(headers.get('api-key'), 'fixture-key-only');
  assert.equal(headers.get('authorization'), null);
  assert(!JSON.stringify(result).includes('fixture-key-only'));
});

test('model configuration rejects non-Azure, non-HTTPS, ambiguous or credential-bearing endpoints before auth', () => {
  for (const bad of [
    'http://fixture-resource.openai.azure.com/openai/v1/responses',
    'https://example.com/openai/v1/responses',
    'https://fixture-resource.openai.azure.com.example.com/openai/v1/responses',
    'https://name:fixture@fixture-resource.openai.azure.com/openai/v1/responses',
    endpoint + '?api-version=preview', endpoint + '?', endpoint + '#', endpoint + '\n',
    endpoint.replace('/responses', '/chat/completions'), endpoint.replace('.com/', '.com:8443/'),
    endpoint.replace('/openai/', '/prefix/../openai/'),
  ]) assert.throws(() => setup({ endpoint: bad }), /invalid_model_configuration/);
  for (const config of [{ timeoutMs: 0 }, { timeoutMs: 2147483648 }, { maxOutputTokens: 0 }, { deployment: '../other' }, { authProvider: null }, { fetchImpl: null }]) {
    assert.throws(() => setup(config), /invalid_model_configuration/);
  }
});

test('model client passes only a caller-supplied JSON report schema in Responses text.format', async () => {
  const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
  const { model, calls } = setup({ reportSchema: schema });
  await model.respond(input, []);
  assert.deepEqual(JSON.parse(calls[0][1].body).text, { format: { type: 'json_schema', name: 'field_report', strict: true, schema } });
  assert.throws(() => setup({ reportSchema: { type: 'not-a-json-schema-type' } }), /invalid_model_configuration/);
});

test('model output preserves encrypted reasoning verbatim for in-memory continuation', async () => {
  const output = [{ type: 'reasoning', id: 'rs_fixture', summary: [], encrypted_content: 'fixture-encrypted-memory-only' }, { type: 'function_call', call_id: 'call_fixture', name: 'read_fixture', arguments: '{"path":"README.md"}', status: 'completed' }];
  const { model, calls } = setup({ fetchImpl: async (...args) => { calls.push(args); return response(reply({ output })); } });
  const first = await model.respond(input, [functionSchema]);
  assert.deepEqual(first.output, output);
  await model.respond([...input, ...first.output, { type: 'function_call_output', call_id: 'call_fixture', output: '{"data":"synthetic"}' }], [functionSchema]);
  assert.deepEqual(JSON.parse(calls[1][1].body).input.slice(1, 3), output);
});

test('HTTP and transport failures are sanitized, measured, and never retried or sent to a fallback API', async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    const { model } = setup({ fetchImpl: async () => { calls++; return response({ error: { code: 'service_error', message: 'fixture-only-value must not escape' } }, status); } });
    await assert.rejects(model.respond(input, []), (error) => error.code === 'model_http_error' && error.http_status === status && error.duration_ms >= 0 && !JSON.stringify(error).includes('fixture-only-value') && !error.message.includes('fixture-only-value'));
    assert.equal(calls, 1);
  }
  const { model } = setup({ fetchImpl: async () => { throw new Error('fixture-only-value transport detail'); } });
  await assert.rejects(model.respond(input, []), (error) => error.code === 'model_transport_error' && !error.message.includes('fixture-only-value'));
});

test('authentication faults never call fetch or expose provider errors or invalid headers', async () => {
  for (const authProvider of [() => { throw new Error('fixture-sensitive-auth-detail'); }, () => ({ kind: 'unknown', value: 'fixture' }), () => ({ kind: 'bearer', value: 'line\nbreak' }), () => ({ kind: 'api-key', value: '' })]) {
    let calls = 0;
    const { model } = setup({ authProvider, fetchImpl: async () => { calls++; throw new Error('must not fetch'); } });
    await assert.rejects(model.respond(input, []), (error) => ['model_auth_error', 'model_auth_invalid'].includes(error.code) && !error.message.includes('fixture-sensitive-auth-detail'));
    assert.equal(calls, 0);
  }
});

test('timeout bounds authentication, transport and body decoding without retrying', async () => {
  for (const stage of ['auth', 'fetch', 'body']) {
    let calls = 0, signal;
    const never = () => new Promise(() => {});
    const { model } = setup({ timeoutMs: 15, authProvider: stage === 'auth' ? never : () => ({ kind: 'bearer', value: 'fixture' }), fetchImpl: async (_, options) => { calls++; signal = options.signal; return stage === 'fetch' ? never() : { ...response(null), json: never }; } });
    await assert.rejects(model.respond(input, []), (error) => error.code === 'model_timeout');
    assert.equal(calls, stage === 'auth' ? 0 : 1);
    if (signal) assert.equal(signal.aborted, true);
  }
});

test('malformed response envelopes and redirects are rejected rather than repaired', async () => {
  for (const body of [null, {}, reply({ status: 'surprise' }), reply({ status: ['completed'] }), reply({ output: {} }), reply({ model: null }), reply({ usage: { total_tokens: -1 } }), reply({ output: [{ type: 'function_call', name: 'read_fixture', call_id: 'call_fixture', arguments: {} }] }), reply({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 7 }] }] })]) {
    const { model } = setup({ fetchImpl: async () => response(body) });
    await assert.rejects(model.respond(input, []), (error) => error.code === 'model_response_invalid');
  }
  for (const changed of [{ redirected: true }, { url: 'https://example.com/elsewhere' }, { json: async () => { throw new SyntaxError('fixture-private-body'); } }]) {
    const { model } = setup({ fetchImpl: async () => ({ ...response(reply()), ...changed }) });
    await assert.rejects(model.respond(input, []), (error) => error.code === 'model_response_invalid' && !error.message.includes('fixture-private-body'));
  }
});

test('safety refusals and misalignment enforcement stop without fallback or leaking reasoning', async () => {
  const reasoning = { type: 'reasoning', encrypted_content: 'fixture-encrypted-not-public', summary: [{ type: 'summary_text', text: 'fixture-hidden-summary' }] };
  for (const [body, status, code] of [
    [{ error: { code: 'misalignment_enforcement', message: 'fixture-private-error' } }, 400, 'misalignment_enforcement'],
    [reply({ status: 'incomplete', incomplete_details: { reason: 'content_filter' }, output: [reasoning] }), 200, 'safety_stop'],
    [reply({ output: [reasoning, { type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'Cannot assist.' }] }] }), 200, 'safety_stop'],
  ]) {
    let calls = 0;
    const { model } = setup({ fetchImpl: async () => { calls++; return response(body, status); } });
    await assert.rejects(model.respond(input, []), (error) => error.code === code && !JSON.stringify(error).includes('fixture-encrypted') && !JSON.stringify(error).includes('fixture-hidden') && !JSON.stringify(error).includes('fixture-private-error'));
    assert.equal(calls, 1);
  }
});

test('incomplete or failed model status never becomes a completed response', async () => {
  for (const [status, code] of [['incomplete', 'model_incomplete'], ['failed', 'model_failed'], ['cancelled', 'model_cancelled'], ['in_progress', 'model_unfinished']]) {
    const { model } = setup({ fetchImpl: async () => response(reply({ status })) });
    await assert.rejects(model.respond(input, []), (error) => error.code === code && error.duration_ms >= 0);
  }
});

test('only JSON input and named function schemas reach auth; built-in or remote tools cannot be enabled', async () => {
  for (const tools of [[{ type: 'web_search' }], [{ ...functionSchema, name: 'read_fixture', parameters: { type: 'invented' } }], [{ ...functionSchema, endpoint: 'https://example.com' }]]) {
    const { model, authCalls } = setup();
    await assert.rejects(model.respond(input, tools), /invalid_model_input/);
    assert.equal(authCalls.length, 0);
  }
  const { model, authCalls } = setup();
  await assert.rejects(model.respond([{ role: 'user', content: undefined }], []), /invalid_model_input/);
  assert.equal(authCalls.length, 0);
});

test('unexpected credential and transport accessors cannot leak thrown details', async () => {
  let touched = false;
  const auth = setup({ authProvider: () => ({ kind: 'bearer', get value() { touched = true; throw new Error('fixture-private-accessor-detail'); } }) });
  await assert.rejects(auth.model.respond(input, []), (error) => error.code === 'model_auth_invalid' && !error.message.includes('fixture-private-accessor-detail'));
  assert.equal(touched, false);
  assert.equal(auth.calls.length, 0);
  const transport = setup({ fetchImpl: async () => ({ get status() { throw new Error('fixture-private-transport-detail'); } }) });
  await assert.rejects(transport.model.respond(input, []), (error) => error.code === 'model_response_invalid' && !error.message.includes('fixture-private-transport-detail'));
});

test('the configured 6000-token report budget is sent unchanged without a comment byte cap', async () => {
  const finalText = JSON.stringify({ report: 'public synthetic report '.repeat(500) });
  assert(Buffer.byteLength(finalText, 'utf8') > 8192);
  let body;
  const { model } = setup({ maxOutputTokens: 6000, fetchImpl: async (_, options) => { body = JSON.parse(options.body); return response(reply({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: finalText }] }] })); } });
  const answer = await model.respond(input, []);
  assert.equal(body.max_output_tokens, 6000);
  assert.equal(answer.output[0].content[0].text, finalText);
});

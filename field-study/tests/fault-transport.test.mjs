import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openNativeMcp } from '../native-mcp.mjs';

const api = await import('../fault-transport.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('/field-study/fault-transport.mjs')) return {};
  throw error;
});
function factory(options) {
  assert.equal(typeof api.disconnectAfterMutationReply, 'function', 'disconnectAfterMutationReply must be implemented');
  return api.disconnectAfterMutationReply(options);
}
const SECRET = `ghp_${'x'.repeat(36)}`;
const PARAMS = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2, body: 'Fixture, not a live write.\n' };
const result = { content: [{ type: 'text', text: '{"id":"712345","url":"https://github.com/OndCo/Action-Effect-Bench/issues/2#issuecomment-712345"}' }] };
const mutation = (id = 17) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'add_issue_comment', arguments: PARAMS } });
const reply = (id = 17) => ({ jsonrpc: '2.0', id, result: structuredClone(result) });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const safeError = code => error => {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(error.cause, undefined);
  assert.ok(!JSON.stringify(error).includes(SECRET));
  return true;
};

// Fixture transports exercise the transport contract, never a network or a subprocess.
function harness({ record, send, close, callbacks = {} } = {}) {
  const events = [], sent = [], order = [], versions = [], setters = [];
  const state = { starts: 0, closes: 0, events, sent, order, versions, setters };
  const slots = { ...callbacks };
  const actual = {
    sessionId: undefined, pid: 1234, stderr: { fixture: 'stream' },
    async start() { assert.equal(this, actual); state.starts++; },
    async send(message, options) {
      assert.equal(this, actual);
      sent.push({ message, options });
      return send?.(message, options, actual);
    },
    async close() {
      assert.equal(this, actual);
      state.closes++;
      order.push('close');
      if (close) await close(actual);
      else actual.onclose?.();
    },
    setProtocolVersion(version) { assert.equal(this, actual); versions.push(version); },
  };
  for (const name of ['onmessage', 'onerror', 'onclose']) Object.defineProperty(actual, name, {
    configurable: true, get() { return slots[name]; }, set(value) { setters.push(name); slots[name] = value; },
  });
  const transportFactory = parameters => { state.parameters = parameters; return actual; };
  const wrapped = factory({ transportFactory, record: record ?? (event => { events.push(event); order.push('record'); }) });
  const parameters = { command: '/fixture/not-executed', args: ['stdio'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: SECRET } };
  const transport = wrapped(parameters);
  return { state, actual, transport, parameters };
}

test('forwards lifecycle methods, send options, protocol hooks and transport getters', async () => {
  const h = harness(), messages = [], errors = [];
  let closed = 0;
  h.transport.onmessage = (...args) => messages.push(args);
  h.transport.onerror = error => errors.push(error);
  h.transport.onclose = () => { closed++; };
  await h.transport.start();
  const message = { jsonrpc: '2.0', id: 3, method: 'tools/list' };
  const options = { relatedRequestId: 'other', resumptionToken: 'fixture' };
  await h.transport.send(message, options);
  assert.equal(h.state.parameters, h.parameters);
  assert.equal(h.state.sent[0].message, message);
  assert.equal(h.state.sent[0].options, options);
  const versionHook = h.transport.setProtocolVersion.bind(h.transport);
  h.transport.setProtocolVersion = version => versionHook(version);
  h.transport.setProtocolVersion('2025-11-25');
  assert.deepEqual(h.state.versions, ['2025-11-25']);
  assert.equal(h.transport.sessionId, undefined);
  h.actual.sessionId = 'fixture-session';
  assert.equal(h.transport.sessionId, 'fixture-session');
  assert.equal(h.transport.pid, h.actual.pid);
  assert.equal(h.transport.stderr, h.actual.stderr);
  const response = { jsonrpc: '2.0', id: 3, result: { tools: [] } }, extra = { fixture: 'extra' };
  h.actual.onmessage(response, extra);
  const error = new Error('unmodified transport error');
  h.actual.onerror(error);
  assert.equal(messages[0][0], response);
  assert.equal(messages[0][1], extra);
  assert.equal(errors[0], error);
  await h.transport.close();
  await h.transport.close();
  assert.equal(h.state.starts, 1);
  assert.equal(h.state.closes, 1);
  assert.equal(closed, 1);
  assert.deepEqual(h.state.events, []);
});

test('captures the actual mutation reply, never forwards it, and closes once after the record', async () => {
  const h = harness(), received = [];
  h.transport.onmessage = value => received.push(value);
  h.transport.onclose = () => h.state.order.push('onclose');
  await h.transport.start();
  await h.transport.send(mutation());
  const response = reply();
  h.actual.onmessage(response);
  await h.transport.close();
  assert.deepEqual(h.state.events, [{ type: 'fault_mcp_reply_discarded', id: 17, response }]);
  assert.deepEqual(received, []);
  assert.deepEqual(h.state.order, ['record', 'close', 'onclose']);
  assert.equal(h.state.sent.length, 1);
  assert.equal(h.state.closes, 1);
  assert.ok(!JSON.stringify(h.state.events).includes(SECRET));
  await assert.rejects(h.transport.send(mutation(18)));
  assert.equal(h.state.sent.length, 1);
});

for (const id of [0, 17, '17', '']) test(`tracks exactly the JSON-RPC ID ${JSON.stringify(id)} including its type`, async () => {
  const h = harness(), received = [];
  h.transport.onmessage = value => received.push(value);
  await h.transport.send({ jsonrpc: '2.0', id: 50, method: 'tools/call', params: { name: 'issue_read', arguments: PARAMS } });
  await h.transport.send(mutation(id));
  const messages = [reply(50), reply(typeof id === 'number' ? String(id) : Number(id)),
    { jsonrpc: '2.0', method: 'notifications/message', params: { id } },
    { jsonrpc: '2.0', id, method: 'ping' }];
  for (const message of messages) h.actual.onmessage(message);
  assert.deepEqual(received, messages);
  assert.deepEqual(h.state.events, []);
  h.actual.onmessage(reply(id));
  await h.transport.close();
  assert.deepEqual(received, messages);
  assert.equal(h.state.events.length, 1);
  assert.equal(h.state.events[0].id, id);
});

test('captures a synchronous reply emitted from inside send', async () => {
  const h = harness({ send(message, options, actual) { actual.onmessage(reply(message.id)); } });
  const received = [];
  h.transport.onmessage = message => received.push(message);
  await h.transport.send(mutation());
  await h.transport.close();
  assert.deepEqual(received, []);
  assert.equal(h.state.events.length, 1);
  assert.equal(h.state.sent.length, 1);
});

test('does not invent a reply or a fault when no mutation response arrives', async () => {
  const h = harness();
  await h.transport.send(mutation());
  await h.transport.close();
  assert.deepEqual(h.state.events, []);
  assert.equal(h.state.sent.length, 1);
  assert.equal(h.state.closes, 1);
});

test('captures JSON-RPC error replies verbatim without inventing success', async () => {
  const h = harness(), received = [];
  h.transport.onmessage = value => received.push(value);
  await h.transport.send(mutation());
  const response = { jsonrpc: '2.0', id: 17, error: { code: -32603, message: 'fixture failure', data: { retryable: false } } };
  h.actual.onmessage(response);
  await h.transport.close();
  assert.deepEqual(h.state.events[0].response, response);
  assert.deepEqual(received, []);
});

test('awaits durable recording, snapshots the reply immediately and suppresses duplicate replies', async () => {
  const barrier = deferred(), reached = deferred(), events = [], received = [];
  const h = harness({ async record(event) { events.push(event); reached.resolve(); await barrier.promise; } });
  h.transport.onmessage = value => received.push(value);
  await h.transport.send(mutation());
  const response = reply(), expected = structuredClone(response), handler = h.actual.onmessage;
  handler(response);
  response.result.content[0].text = 'changed after arrival';
  handler(reply());
  await reached.promise;
  assert.equal(h.state.closes, 0);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].response, expected);
  const unrelated = { jsonrpc: '2.0', method: 'notifications/progress', params: { progress: 1 } };
  handler(unrelated);
  assert.deepEqual(received, [unrelated]);
  await assert.rejects(h.transport.send(mutation(18)));
  barrier.resolve();
  await h.transport.close();
  assert.equal(h.state.closes, 1);
  assert.equal(h.state.sent.length, 1);
});

test('awaits async close and shares cleanup across concurrent callers', async () => {
  const barrier = deferred(), entered = deferred();
  const h = harness({ async close(actual) { entered.resolve(); await barrier.promise; actual.onclose?.(); } });
  let closes = 0, settled = false;
  h.transport.onclose = () => { closes++; };
  await h.transport.send(mutation());
  h.actual.onmessage(reply());
  await entered.promise;
  const closing = h.transport.close();
  closing.then(() => { settled = true; });
  assert.equal(h.transport.close(), closing);
  await tick();
  assert.equal(settled, false);
  assert.equal(closes, 0);
  barrier.resolve();
  await closing;
  assert.equal(closes, 1);
  assert.equal(h.state.closes, 1);
  for (const name of ['onmessage', 'onerror', 'onclose']) assert.equal(h.actual[name], undefined);
});

test('callback getters never expose the interceptor to SDK-style callback chaining', async () => {
  const h = harness();
  assert.equal(h.transport.onmessage, undefined);
  const original = h.transport.onmessage, received = [];
  h.transport.onmessage = (message, extra) => { original?.(message, extra); received.push(message); };
  const notification = { jsonrpc: '2.0', method: 'notifications/progress' };
  h.actual.onmessage(notification);
  assert.deepEqual(received, [notification]);
  await h.transport.send(mutation());
  h.actual.onmessage(reply());
  await h.transport.close();
  assert.deepEqual(received, [notification]);
  assert.equal(h.state.events.length, 1);
});

test('callback replacement and removal preserve the underlying interception hooks', async () => {
  const h = harness(), received = [], errors = [];
  let closes = 0;
  const internal = h.actual.onmessage;
  h.transport.onmessage = () => { throw new Error('stale_callback'); };
  const current = value => received.push(value);
  h.transport.onmessage = current;
  assert.equal(h.transport.onmessage, current);
  assert.equal(h.actual.onmessage, internal);
  h.transport.onmessage = undefined;
  h.actual.onmessage({ jsonrpc: '2.0', method: 'notifications/progress' });
  h.transport.onmessage = current;
  h.transport.onerror = () => { throw new Error('stale_error_callback'); };
  h.transport.onerror = error => errors.push(error);
  const error = new Error('fixture');
  h.actual.onerror(error);
  h.transport.onclose = () => { throw new Error('stale_close_callback'); };
  h.transport.onclose = () => { closes++; };
  await h.transport.send(mutation());
  h.actual.onmessage(reply());
  await h.transport.close();
  assert.deepEqual(received, []);
  assert.deepEqual(errors, [error]);
  assert.equal(closes, 1);
});

test('preexisting callbacks are forwarded once and never receive the discarded reply', async () => {
  const received = [], errors = [];
  let closes = 0;
  const h = harness({ callbacks: { onmessage: value => received.push(value), onerror: value => errors.push(value), onclose: () => { closes++; } } });
  const notification = { jsonrpc: '2.0', method: 'notifications/message' }, error = new Error('fixture');
  h.actual.onmessage(notification);
  h.actual.onerror(error);
  await h.transport.send(mutation());
  h.actual.onmessage(reply());
  await h.transport.close();
  assert.deepEqual(received, [notification]);
  assert.deepEqual(errors, [error]);
  assert.equal(closes, 1);
});

for (const asyncFailure of [false, true]) test(`${asyncFailure ? 'async' : 'sync'} journal failure closes actual transport and stays failstop`, async () => {
  let records = 0;
  const h = harness({ record() {
    records++;
    if (asyncFailure) return Promise.reject(new Error(SECRET));
    throw new Error(SECRET);
  } });
  const errors = [], received = [];
  let closes = 0;
  h.transport.onerror = error => errors.push(error);
  h.transport.onmessage = value => received.push(value);
  h.transport.onclose = () => { closes++; };
  await h.transport.send(mutation());
  h.actual.onmessage(reply());
  await assert.rejects(h.transport.close(), safeError('fault_journal_failure'));
  await assert.rejects(h.transport.close(), safeError('fault_journal_failure'));
  await assert.rejects(h.transport.send(mutation(18)), safeError('fault_journal_failure'));
  await assert.rejects(h.transport.start(), safeError('fault_journal_failure'));
  assert.equal(records, 1);
  assert.equal(errors.length, 1);
  safeError('fault_journal_failure')(errors[0]);
  assert.equal(closes, 1);
  assert.equal(h.state.closes, 1);
  assert.equal(h.state.sent.length, 1);
  assert.deepEqual(received, []);
});

test('journal failure still closes when the error callback itself throws', async () => {
  const h = harness({ record() { throw new Error(SECRET); } });
  h.transport.onerror = () => { throw new Error('callback failed'); };
  await h.transport.send(mutation());
  h.actual.onmessage(reply());
  await assert.rejects(h.transport.close(), safeError('fault_journal_failure'));
  assert.equal(h.state.closes, 1);
});

test('physical close failure is sanitized, notified and retained for explicit cleanup', async () => {
  const h = harness({ async close() { throw new Error(SECRET); } });
  const errors = [];
  let closes = 0;
  h.transport.onerror = error => errors.push(error);
  h.transport.onclose = () => { closes++; };
  await h.transport.send(mutation());
  h.actual.onmessage(reply());
  await assert.rejects(h.transport.close(), safeError('fault_close_failure'));
  assert.equal(h.state.closes, 1);
  assert.equal(closes, 1);
  assert.equal(errors.length, 1);
  safeError('fault_close_failure')(errors[0]);
  assert.equal(h.actual.onmessage, undefined);
});

for (const [label, change] of [
  ['symbol metadata', value => ({ ...value, [Symbol('hidden')]: 'not JSON' })],
  ['nonenumerable metadata', value => Object.defineProperty(value, 'hidden', { value: 'not JSON' })],
  ['accessor metadata', value => Object.defineProperty(value, 'hidden', { enumerable: true, get() { return 'not parsed JSON'; } })],
  ['sparse content', value => ({ ...value, result: { content: new Array(1) } })],
  ['invalid scalar text', value => ({ ...value, result: { content: [{ type: 'text', text: '\ud800' }] } })],
  ['secret error', value => ({ ...value, result: { isError: true, content: [{ type: 'text', text: SECRET }] } })],
  ['private metadata', value => ({ ...value, result: { ...value.result, authorization: 'private' } })],
  ['oversized content', value => ({ ...value, result: { content: [{ type: 'text', text: 'x'.repeat(2 * 1024 * 1024) }] } })],
]) test(`unsafe or lossy reply evidence fails closed: ${label}`, async () => {
  const h = harness(), errors = [], received = [];
  h.transport.onerror = error => errors.push(error);
  h.transport.onmessage = value => received.push(value);
  await h.transport.send(mutation());
  h.actual.onmessage(change(reply()));
  await assert.rejects(h.transport.close(), safeError('fault_reply_invalid'));
  assert.deepEqual(h.state.events, []);
  assert.deepEqual(received, []);
  assert.equal(h.state.closes, 1);
  assert.equal(errors.length, 1);
  safeError('fault_reply_invalid')(errors[0]);
});

test('reply snapshot validation never evaluates metadata getters', async () => {
  const h = harness();
  let reads = 0;
  const response = Object.defineProperty(reply(), 'extra', { enumerable: true, get() { reads++; return 'metadata'; } });
  await h.transport.send(mutation());
  h.actual.onmessage(response);
  await assert.rejects(h.transport.close(), safeError('fault_reply_invalid'));
  assert.equal(reads, 0);
});

test('discarded reply evidence excludes callback authentication metadata', async () => {
  const h = harness();
  await h.transport.send(mutation());
  h.actual.onmessage(reply(), { authInfo: { token: SECRET }, requestInfo: { headers: { authorization: SECRET } } });
  await h.transport.close();
  assert.deepEqual(h.state.events[0], { type: 'fault_mcp_reply_discarded', id: 17, response: reply() });
  assert.ok(!JSON.stringify(h.state.events).includes(SECRET));
});

test('an early actual close is not exposed before the reply record finishes', async () => {
  const barrier = deferred(), reached = deferred();
  const h = harness({ async record() { reached.resolve(); await barrier.promise; } });
  let closes = 0;
  h.transport.onclose = () => { closes++; };
  await h.transport.send(mutation());
  h.actual.onmessage(reply());
  h.actual.onclose();
  await reached.promise;
  assert.equal(closes, 0);
  barrier.resolve();
  await h.transport.close();
  assert.equal(closes, 1);
});

for (const journalFails of [false, true]) test(`a reply arriving during caller-initiated close still awaits its ${journalFails ? 'failed' : 'durable'} record`, async () => {
  const barrier = deferred(), reached = deferred();
  let notified = false, settled = false;
  const h = harness({
    async record() { reached.resolve(); await barrier.promise; if (journalFails) throw new Error(SECRET); },
    async close(actual) { actual.onmessage(reply()); actual.onclose?.(); },
  });
  h.transport.onclose = () => { notified = true; };
  await h.transport.send(mutation());
  const closing = h.transport.close();
  closing.then(() => { settled = true; }, () => { settled = true; });
  await reached.promise;
  await tick();
  try {
    assert.equal(settled, false);
    assert.equal(notified, false);
  } finally { barrier.resolve(); }
  if (journalFails) await assert.rejects(closing, safeError('fault_journal_failure'));
  else await closing;
  assert.equal(notified, true);
  assert.equal(h.state.closes, 1);
});

test('no second mutation can overwrite the tracked ID, including after a send failure', async () => {
  const failure = new Error('fixture send failure');
  const h = harness({ send() { throw failure; } });
  await assert.rejects(h.transport.send(mutation()), error => error === failure);
  await assert.rejects(h.transport.send(mutation(18)), safeError('fault_mutation_already_attempted'));
  assert.equal(h.state.sent.length, 1);
  assert.deepEqual(h.state.events, []);
  await h.transport.close();
});

test('concurrent mutation sends cannot replace the pending response ID', async () => {
  const h = harness();
  const first = h.transport.send(mutation());
  await assert.rejects(h.transport.send(mutation(18)), safeError('fault_mutation_already_attempted'));
  await first;
  h.actual.onmessage(reply());
  await h.transport.close();
  assert.equal(h.state.events[0].id, 17);
  assert.equal(h.state.sent.length, 1);
});

for (const id of [undefined, null, {}, false, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
  test(`mutation request requires a usable JSON-RPC ID: ${String(id)}`, async () => {
    const h = harness(), message = mutation();
    message.id = id;
    await assert.rejects(h.transport.send(message));
    assert.deepEqual(h.state.sent, []);
    assert.deepEqual(h.state.events, []);
    await h.transport.close();
  });
}

test('default factory constructs a real stdio transport but does not start it', async () => {
  const transport = factory({ record() { throw new Error('no reply expected'); } })({ command: '/fixture/not-executed', stderr: 'ignore' });
  assert.equal(transport.pid, null);
  assert.equal(transport.sessionId, undefined);
  await transport.close();
});

test('factory rejects missing journal, unknown options and invalid underlying transports', () => {
  assert.throws(() => factory({ transportFactory() {} }));
  assert.throws(() => factory({ record() {}, transportFactory: true }));
  assert.throws(() => factory({ record() {}, ignored: true }));
  assert.throws(() => factory({ record() {}, transportFactory: () => ({}) })({}));
});

let directory, binary;
before(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'fault-transport-fixture-')));
  binary = join(directory, 'never-executed');
  await writeFile(binary, 'Fixture executable identity, never executed.\n', { mode: 0o700 });
});
after(async () => { await rm(directory, { recursive: true, force: true }); });

test('openNativeMcp and the real SDK observe response loss through a fixture transport, not a live outage', async () => {
  const events = [], messages = [];
  let closes = 0, actual, version;
  const tool = { name: 'add_issue_comment', inputSchema: { type: 'object', required: ['owner', 'repo', 'issue_number'],
    properties: { owner: { type: 'string' }, repo: { type: 'string' }, issue_number: { type: 'number' }, body: { type: 'string' } } },
    annotations: { readOnlyHint: false } };
  const transportFactory = factory({ record: event => { events.push(event); }, transportFactory() {
    actual = {
      async start() {},
      async send(message) {
        messages.push(message);
        if (message.id === undefined) return;
        const value = message.method === 'initialize' ? { protocolVersion: '2025-11-25', capabilities: { tools: {} },
          serverInfo: { name: 'github-mcp-server', version: '2.0.2' } }
          : message.method === 'tools/list' ? { tools: [tool] } : result;
        queueMicrotask(() => actual.onmessage?.({ jsonrpc: '2.0', id: message.id, result: value }));
      },
      async close() { closes++; actual.onclose?.(); },
      setProtocolVersion(value) { version = value; },
    };
    return actual;
  } });
  const session = await openNativeMcp({ binary, tokenProvider: async () => SECRET, transportFactory,
    writable: true, selectedTools: ['add_issue_comment'], timeoutMs: 1000 });
  assert.equal(version, session.inventory.protocol_version);
  await assert.rejects(session.call('add_issue_comment', PARAMS), error => {
    assert.equal(error.outcome, 'unknown');
    assert.equal(error.code, 'mcp_transport_error');
    return true;
  });
  await assert.rejects(session.call('add_issue_comment', PARAMS));
  await session.close();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'fault_mcp_reply_discarded');
  assert.deepEqual(events[0].response.result, result);
  assert.equal(events[0].id, messages.find(message => message.method === 'tools/call').id);
  assert.equal(messages.filter(message => message.method === 'tools/call').length, 1);
  assert.equal(closes, 1);
});

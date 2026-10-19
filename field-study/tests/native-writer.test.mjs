import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { receiptFrom } from '../../runtime-pilot/provider.mjs';
import { executeAction } from '../../runtime-pilot/gate.mjs';
import { NativeMcpError } from '../native-mcp.mjs';

const api = await import('../native-writer.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('/field-study/native-writer.mjs')) return {};
  throw error;
});
function create(options) {
  assert.equal(typeof api.createFieldWriteProvider, 'function', 'createFieldWriteProvider must be implemented');
  return api.createFieldWriteProvider(options);
}

// All providers in this file are fixtures. No credentials or live writes are used.
const TARGET = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2 };
const PARAMS = { ...TARGET, body: 'Synthetic approved field-study body.\n' };
const ID = 712345;
const LOGIN = 'fixture-maintainer';
const SECRET = `ghp_${'x'.repeat(36)}`;
const hash = value => createHash('sha256').update(value).digest('hex');
const href = (id = ID) => `https://github.com/OndCo/Action-Effect-Bench/issues/2#issuecomment-${id}`;
const comment = () => ({ id: ID, body: PARAMS.body, user: { login: LOGIN }, html_url: href(),
  url: `https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/comments/${ID}`,
  issue_url: 'https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/2',
  created_at: '2026-10-19T01:00:00Z', updated_at: '2026-10-19T01:00:00Z' });
const envelope = (value = { id: String(ID), url: href() }) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const inventory = () => ({ transport: 'stdio', read_only: false, selected_tools: ['add_issue_comment'],
  protocol_version: '2025-11-25', server: { name: 'github-mcp-server', version: '2.0.2' },
  tools: [{ name: 'add_issue_comment' }], tools_sha256: 'a'.repeat(64) });

function harness(lane = 'sdk', overrides = {}) {
  const events = [], calls = [];
  const sdkProvider = {
    async principal() { calls.push({ method: 'principal', thisValue: this }); return LOGIN; },
    async createComment(params) { calls.push({ method: 'createComment', params, thisValue: this }); return comment(); },
    async listComments(params) { calls.push({ method: 'listComments', params, thisValue: this }); return [comment()]; },
    async readComment(params, id) { calls.push({ method: 'readComment', params, id, thisValue: this }); return comment(); },
    async readIssue(params) { calls.push({ method: 'readIssue', params, thisValue: this }); return { number: 2, state: 'open' }; },
    ...overrides.sdkProvider,
  };
  const session = { inventory: inventory(), async call(name, params) {
    calls.push({ method: name, params, thisValue: this }); return envelope();
  }, ...overrides.session };
  const options = { lane, target: { ...TARGET }, sdkProvider, record: event => { events.push(event); },
    ...(lane === 'mcp' ? { session } : {}), ...overrides.options };
  return { events, calls, options, sdkProvider, session };
}
const sends = h => h.calls.filter(call => ['createComment', 'add_issue_comment'].includes(call.method));
const safeError = code => error => {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  assert.equal(error.cause, undefined);
  assert.ok(!JSON.stringify(error).includes(SECRET));
  return true;
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

for (const lane of ['sdk', 'mcp']) {
  test(`${lane}: journals the exact native attempt and response, then returns a gate-compatible ID`, async () => {
    const h = harness(lane);
    h.options.record = event => {
      assert.equal(sends(h).length, event.type === 'native_write_attempt' ? 0 : 1);
      h.events.push(event);
    };
    const provider = create(h.options);
    const result = await provider.createComment(PARAMS);
    assert.deepEqual(result, lane === 'sdk' ? comment() : { id: ID });
    assert.equal(sends(h).length, 1);
    assert.deepEqual(sends(h)[0].params, PARAMS);
    assert.equal(sends(h)[0].thisValue, lane === 'sdk' ? h.sdkProvider : h.session);
    assert.deepEqual(h.events.map(event => event.type), ['native_write_attempt', 'native_write_response']);
    for (const event of h.events) {
      assert.equal(event.lane, lane);
      assert.equal(event.method, lane === 'sdk' ? 'createComment' : 'add_issue_comment');
      assert.deepEqual(event.args, PARAMS);
      assert.equal(event.args_sha256, hash(JSON.stringify(event.args)));
      if (lane === 'mcp') assert.deepEqual(event.inventory, h.session.inventory);
    }
    assert.equal(h.events[0].body_sha256, hash(PARAMS.body));
    assert.equal(h.events[0].body_bytes, Buffer.byteLength(PARAMS.body));
    assert.deepEqual(h.events[1].response, lane === 'sdk' ? comment() : envelope());
    assert.equal(h.events[1].response_sha256, hash(JSON.stringify(h.events[1].response)));
    const observed = await provider.readComment(PARAMS, result.id);
    assert.equal(receiptFrom(observed, PARAMS, LOGIN, result.id).content_matches, true);
    await assert.rejects(provider.createComment(PARAMS), safeError('native_write_already_attempted'));
    assert.equal(sends(h).length, 1);
  });

  test(`${lane}: principal and observations use SDK only and retain only the principal login`, async () => {
    const h = harness(lane, { sdkProvider: { async principal() {
      h.calls.push({ method: 'principal' });
      return { login: LOGIN, email: 'private@example.invalid', token: SECRET, private_repos: 99 };
    } } });
    const provider = create(h.options);
    assert.equal(await provider.principal(), LOGIN);
    assert.deepEqual(await provider.listComments(PARAMS), [comment()]);
    assert.deepEqual(await provider.readComment(TARGET, ID), comment());
    assert.deepEqual(await provider.readIssue(TARGET), { number: 2, state: 'open' });
    assert.deepEqual(h.calls.map(call => call.method), ['principal', 'listComments', 'readComment', 'readIssue']);
    assert.deepEqual(h.events.map(event => event.type), Array(4).fill(['native_read_attempt', 'native_read_response']).flat());
    assert.deepEqual(h.events[0].args, {});
    assert.deepEqual(h.events[1].response, { login: LOGIN });
    assert.deepEqual(h.events[4].args, { ...TARGET, comment_id: ID });
    for (const event of h.events) {
      assert.equal(event.lane, 'sdk');
      assert.equal(event.args_sha256, hash(JSON.stringify(event.args)));
      if (event.type === 'native_read_response') assert.equal(event.response_sha256, hash(JSON.stringify(event.response)));
    }
    assert.ok(!JSON.stringify(h.events).includes(SECRET));
    assert.ok(!JSON.stringify(h.events).includes('private@example.invalid'));
  });

  for (const [label, params] of [
    ...['owner', 'repo', 'issue_number', 'body'].map(key => [`missing ${key}`, Object.fromEntries(Object.entries(PARAMS).filter(([name]) => name !== key))]),
    ['other owner', { ...PARAMS, owner: 'other' }],
    ['owner case change', { ...PARAMS, owner: 'ondco' }],
    ['other repo', { ...PARAMS, repo: 'Action-Effect-Spec' }],
    ['repo case change', { ...PARAMS, repo: 'action-effect-bench' }],
    ['old issue', { ...PARAMS, issue_number: 1 }],
    ['different new issue', { ...PARAMS, issue_number: 3 }],
    ['string issue', { ...PARAMS, issue_number: '2' }],
    ['reaction', { ...PARAMS, reaction: '+1' }],
    ['comment_id', { ...PARAMS, comment_id: ID }],
    ['headers', { ...PARAMS, headers: { authorization: SECRET } }],
    ['undefined extra field', { ...PARAMS, ignored: undefined }],
    ['wrong operation', { name: 'delete_issue', arguments: PARAMS }],
    ['empty body', { ...PARAMS, body: '' }],
    ['non-string body', { ...PARAMS, body: ['text'] }],
    ['oversized body', { ...PARAMS, body: 'a'.repeat(8193) }],
    ['oversized UTF-8 body', { ...PARAMS, body: '\u00e9'.repeat(4097) }],
    ['unpaired surrogate', { ...PARAMS, body: '\ud800' }],
    ['credential body', { ...PARAMS, body: SECRET }],
    ['null params', null],
    ['array params', Object.assign([], PARAMS)],
    ['inherited params', Object.create(PARAMS)],
    ['hidden extra field', Object.defineProperty({ ...PARAMS }, 'reaction', { value: '+1' })],
    ['symbol field', { ...PARAMS, [Symbol('reaction')]: '+1' }],
    ['getter field', Object.defineProperty({ ...PARAMS }, 'body', { enumerable: true, get() { throw new Error(SECRET); } })],
    ['toJSON hook', { ...PARAMS, toJSON() { return PARAMS; } }],
  ]) test(`${lane}: rejects ${label} without dispatch or unsafe argument evidence`, async () => {
    const h = harness(lane), provider = create(h.options);
    await assert.rejects(provider.createComment(params));
    assert.equal(sends(h).length, 0);
    assert.deepEqual(h.events, []);
    await assert.rejects(provider.createComment(PARAMS), safeError('native_write_already_attempted'));
    assert.equal(sends(h).length, 0);
  });

  test(`${lane}: rejects extra positional create arguments rather than ignoring them`, async () => {
    const h = harness(lane), provider = create(h.options);
    await assert.rejects(provider.createComment(PARAMS, { reaction: '+1' }));
    assert.equal(sends(h).length, 0);
  });

  test(`${lane}: accepts exactly 8192 UTF-8 bytes without rewriting them`, async () => {
    const h = harness(lane), provider = create(h.options);
    const params = { ...PARAMS, body: '\u00e9'.repeat(4096) };
    await provider.createComment(params);
    assert.equal(sends(h)[0].params.body, params.body);
    assert.equal(h.events[0].body_bytes, 8192);
    assert.equal(h.events[0].body_sha256, hash(params.body));
  });

  test(`${lane}: awaits the durable attempt and snapshots target, methods and arguments`, async () => {
    const barrier = deferred(), reached = deferred();
    const h = harness(lane);
    h.options.record = async event => {
      h.events.push(event);
      if (event.type === 'native_write_attempt') { reached.resolve(); await barrier.promise; }
    };
    const provider = create(h.options), params = { ...PARAMS };
    const result = provider.createComment(params);
    await reached.promise;
    assert.equal(sends(h).length, 0);
    await assert.rejects(provider.createComment(PARAMS), safeError('native_write_already_attempted'));
    params.body = 'changed';
    params.owner = 'other';
    h.options.target.issue_number = 1;
    h.sdkProvider.createComment = async () => { throw new Error('replaced_method'); };
    h.session.call = async () => { throw new Error('replaced_method'); };
    h.session.inventory.read_only = true;
    barrier.resolve();
    assert.equal((await result).id, ID);
    assert.deepEqual(sends(h)[0].params, PARAMS);
    assert.deepEqual(h.events[0].args, PARAMS);
    if (lane === 'mcp') assert.equal(h.events[0].inventory.read_only, false);
  });

  for (const stage of ['native_write_attempt', 'native_write_response', 'native_write_error']) {
    for (const asyncFailure of [false, true]) test(`${lane}: ${asyncFailure ? 'async' : 'sync'} ${stage} journal failure is failstop`, async () => {
      const h = harness(lane);
      if (stage === 'native_write_error') {
        h.sdkProvider.createComment = async () => { h.calls.push({ method: 'createComment' }); throw new Error(SECRET); };
        h.session.call = async () => { h.calls.push({ method: 'add_issue_comment' }); throw new Error(SECRET); };
      }
      h.options.record = event => {
        h.events.push(event);
        if (event.type === stage) {
          if (asyncFailure) return Promise.reject(new Error(SECRET));
          throw new Error(SECRET);
        }
      };
      const provider = create(h.options);
      await assert.rejects(provider.createComment(PARAMS), safeError('native_journal_failure'));
      await assert.rejects(provider.createComment(PARAMS), safeError('native_journal_failure'));
      await assert.rejects(provider.principal(), safeError('native_journal_failure'));
      assert.equal(sends(h).length, stage === 'native_write_attempt' ? 0 : 1);
      assert.equal(h.events.at(-1).type, stage);
      assert.ok(!JSON.stringify(h.events).includes(SECRET));
    });
  }

  test(`${lane}: native failure is sanitized, recorded once, and cannot be retried`, async () => {
    const h = harness(lane);
    const fail = async () => { h.calls.push({ method: lane === 'sdk' ? 'createComment' : 'add_issue_comment' }); throw Object.assign(new Error(SECRET), { code: SECRET }); };
    h.sdkProvider.createComment = fail;
    h.session.call = fail;
    const provider = create(h.options);
    await assert.rejects(provider.createComment(PARAMS), safeError('native_write_failure'));
    await assert.rejects(provider.createComment(PARAMS), safeError('native_write_already_attempted'));
    assert.equal(sends(h).length, 1);
    assert.deepEqual(h.events.map(event => event.type), ['native_write_attempt', 'native_write_error']);
    assert.equal(h.events[1].code, 'native_write_failure');
    assert.ok(!JSON.stringify(h.events).includes(SECRET));
  });
}

for (const target of [null, { ...TARGET, owner: 'other' }, { ...TARGET, repo: 'Action-Effect-Spec' },
  { ...TARGET, issue_number: 1 }, { ...TARGET, issue_number: 0 }, { ...TARGET, issue_number: '2' },
  { ...TARGET, issue_number: 2.5 }, { ...TARGET, issue_number: 2147483648 }, { ...TARGET, issue_number: NaN },
  { ...TARGET, body: 'ignored' }, { owner: TARGET.owner, repo: TARGET.repo }]) {
  test(`rejects non-study target ${JSON.stringify(target)}`, () => {
    const h = harness();
    assert.throws(() => create({ ...h.options, target }));
    assert.deepEqual(h.calls, []);
  });
}

for (const change of [{ lane: 'http' }, { record: undefined }, { sdkProvider: {} },
  { lane: 'mcp', session: undefined }, { lane: 'mcp', session: { call() {} } },
  { lane: 'mcp', session: { call() {}, inventory: { ...inventory(), read_only: true } } },
  { lane: 'mcp', session: { call() {}, inventory: { ...inventory(), selected_tools: ['get_me'] } } }]) {
  test(`rejects unusable writer configuration ${JSON.stringify(change)}`, () => {
    assert.throws(() => create({ ...harness().options, ...change }));
  });
}

for (const [label, value] of [
  ['text', envelope()],
  ['numeric id', envelope({ id: ID, html_url: href() })],
  ['structured only', { structuredContent: { id: String(ID), url: href() } }],
  ['mirrored structured content', { ...envelope(), structuredContent: { id: String(ID), url: href() } }],
]) test(`MCP ${label} supplies only an untrusted numeric readback ID`, async () => {
  const h = harness('mcp', { session: { async call() { return value; } } });
  const provider = create(h.options);
  assert.deepEqual(await provider.createComment(PARAMS), { id: ID });
  assert.deepEqual(h.events[1].response, value);
});

for (const [label, response] of [
  ['null', null],
  ['missing id', envelope({ url: href() })],
  ['missing URL', envelope({ id: ID })],
  ['extra decoded field', envelope({ id: ID, url: href(), body: PARAMS.body })],
  ['both URL fields', envelope({ id: ID, url: href(), html_url: href() })],
  ['zero id', envelope({ id: 0, url: href(0) })],
  ['unsafe id', envelope({ id: '9007199254740992', url: href('9007199254740992') })],
  ['ID URL mismatch', envelope({ id: ID, url: href(ID + 1) })],
  ['another owner', envelope({ id: ID, url: href().replace('/OndCo/', '/Other/') })],
  ['another repo', envelope({ id: ID, url: href().replace('Action-Effect-Bench', 'Action-Effect-Spec') })],
  ['old issue URL', envelope({ id: ID, url: href().replace('/issues/2', '/issues/1') })],
  ['another issue URL', envelope({ id: ID, url: href().replace('/issues/2', '/issues/3') })],
  ['pull URL', envelope({ id: ID, url: href().replace('/issues/', '/pull/') })],
  ['encoded URL', envelope({ id: ID, url: href().replace('OndCo', '%4fndCo') })],
  ['foreign host', envelope({ id: ID, url: href().replace('github.com', 'github.com.evil.invalid') })],
  ['query URL', envelope({ id: ID, url: href().replace('#', '?token=not-public#') })],
  ['MCP tool error', { isError: true, ...envelope() }],
  ['conflicting mirror', { ...envelope(), structuredContent: { id: ID + 1, url: href(ID + 1) } }],
  ['duplicate JSON key', { content: [{ type: 'text', text: `{"id":${ID},"id":${ID},"url":"${href()}"}` }] }],
]) test(`MCP rejects ${label}, preserving the actual safe reply and preventing resend`, async () => {
  let calls = 0;
  const h = harness('mcp', { session: { async call() { calls++; return response; } } });
  const provider = create(h.options);
  await assert.rejects(provider.createComment(PARAMS));
  assert.deepEqual(h.events.map(event => event.type), ['native_write_attempt', 'native_write_response', 'native_write_error']);
  assert.deepEqual(h.events[1].response, response);
  await assert.rejects(provider.createComment(PARAMS), safeError('native_write_already_attempted'));
  assert.equal(calls, 1);
});

test('known native MCP failure codes remain safe without copying error messages', async () => {
  const h = harness('mcp', { session: { async call() { throw new NativeMcpError('mcp_timeout', 'unknown'); } } });
  await assert.rejects(create(h.options).createComment(PARAMS), safeError('mcp_timeout'));
  assert.equal(h.events[1].code, 'mcp_timeout');
});

for (const response of [null, {}, { id: '7' }, { id: 0 }, { id: 2.5 }, { id: Number.MAX_SAFE_INTEGER + 1 },
  { ...comment(), url: comment().url.replace(String(ID), String(ID + 1)) },
  { ...comment(), issue_url: comment().issue_url.replace('/issues/2', '/issues/1') },
  { ...comment(), html_url: href().replace('/issues/2', '/issues/3') }]) {
  test(`SDK rejects malformed or mismatched native result ${JSON.stringify(response)}`, async () => {
    const h = harness('sdk', { sdkProvider: { async createComment() { return response; } } });
    const provider = create(h.options);
    await assert.rejects(provider.createComment(PARAMS));
    await assert.rejects(provider.createComment(PARAMS), safeError('native_write_already_attempted'));
  });
}

test('observer errors contain only sanitized failure codes', async () => {
  const h = harness('mcp', { sdkProvider: { async principal() { throw new Error(SECRET); } } });
  const provider = create(h.options);
  await assert.rejects(provider.principal(), safeError('native_read_failure'));
  assert.deepEqual(h.events.map(event => event.type), ['native_read_attempt', 'native_read_response']);
  assert.equal(h.events[1].code, 'native_read_failure');
  assert.equal(h.events[1].response, null);
  assert.ok(!JSON.stringify(h.events).includes(SECRET));
});

for (const stage of ['native_read_attempt', 'native_read_response']) test(`${stage} journal failure prevents a later mutation`, async () => {
  const h = harness();
  h.options.record = event => { if (event.type === stage) throw new Error(SECRET); };
  const provider = create(h.options);
  await assert.rejects(provider.principal(), safeError('native_journal_failure'));
  await assert.rejects(provider.createComment(PARAMS), safeError('native_journal_failure'));
  assert.equal(sends(h).length, 0);
  assert.equal(h.calls.length, stage === 'native_read_attempt' ? 0 : 1);
});

test('read arguments cannot redirect independent observation or hide extra fields', async () => {
  const h = harness('mcp'), provider = create(h.options);
  await assert.rejects(provider.listComments({ ...TARGET, issue_number: 1 }));
  await assert.rejects(provider.listComments({ ...TARGET, page: 2 }));
  await assert.rejects(provider.readComment({ ...TARGET, owner: 'other' }, ID));
  await assert.rejects(provider.readComment(TARGET, String(ID)));
  await assert.rejects(provider.readComment(TARGET, 0));
  await assert.rejects(provider.readComment(TARGET, ID, 'ignored'));
  await assert.rejects(provider.principal('ignored'));
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.events, []);
});

for (const lane of ['sdk', 'mcp']) {
  for (const stage of ['native_write_attempt', 'native_write_response']) {
    test(`${lane}: rechecks journal health at the ${stage} await boundary`, async () => {
      const h = harness(lane), observer = deferred();
      let provider;
      h.options.record = event => {
        if (event.type === stage) {
          // Fail another append after write() resumes but before its caller does.
          queueMicrotask(() => queueMicrotask(() => {
            provider.principal().then(observer.resolve, observer.resolve);
          }));
        }
        if (event.type === 'native_read_attempt') throw new Error(SECRET);
      };
      provider = create(h.options);
      await assert.rejects(provider.createComment(PARAMS), safeError('native_journal_failure'));
      safeError('native_journal_failure')(await observer.promise);
      assert.equal(sends(h).length, stage === 'native_write_attempt' ? 0 : 1);
    });
  }
}

test('observations recheck journal health immediately before the SDK call', async () => {
  const h = harness(), observer = deferred();
  let provider;
  h.options.record = event => {
    if (event.type === 'native_read_attempt' && event.method === 'listComments') {
      queueMicrotask(() => queueMicrotask(() => provider.principal().then(observer.resolve, observer.resolve)));
    }
    if (event.method === 'principal') throw new Error(SECRET);
  };
  provider = create(h.options);
  await assert.rejects(provider.listComments(TARGET), safeError('native_journal_failure'));
  safeError('native_journal_failure')(await observer.promise);
  assert.equal(h.calls.length, 0);
});

test('principal projection never evaluates private profile getters', async () => {
  const profile = { login: LOGIN };
  Object.defineProperty(profile, 'private_detail', { enumerable: true, get() { assert.fail('private profile access'); } });
  const h = harness('mcp', { sdkProvider: { async principal() { return profile; } } });
  assert.equal(await create(h.options).principal(), LOGIN);
  assert.deepEqual(h.events[1].response, { login: LOGIN });
});

test('MCP never requires an SDK mutation capability and omits unavailable readIssue', async () => {
  const h = harness('mcp');
  delete h.sdkProvider.createComment;
  delete h.sdkProvider.readIssue;
  const provider = create(h.options);
  assert.deepEqual(Object.keys(provider).sort(), ['createComment', 'listComments', 'principal', 'readComment']);
  assert.deepEqual(await provider.createComment(PARAMS), { id: ID });
  assert.equal(sends(h)[0].method, 'add_issue_comment');
});

for (const lane of ['sdk', 'mcp']) test(`${lane}: unsafe response evidence is refused without exposing credentials or enabling resend`, async () => {
  const h = harness(lane);
  const unsafe = async () => ({ ...comment(), authorization: SECRET });
  h.sdkProvider.createComment = unsafe;
  h.session.call = unsafe;
  const provider = create(h.options);
  await assert.rejects(provider.createComment(PARAMS), safeError('native_invalid_response'));
  await assert.rejects(provider.createComment(PARAMS), safeError('native_write_already_attempted'));
  assert.deepEqual(h.events.map(event => event.type), ['native_write_attempt', 'native_write_error']);
  assert.ok(!JSON.stringify(h.events).includes(SECRET));
});

for (const lane of ['sdk', 'mcp']) {
  for (const matches of [true, false]) test(`${lane}: unchanged gate ${matches ? 'confirms' : 'refuses to confirm'} using independent fixture SDK readback`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'native-writer-gate-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const policyFile = join(root, 'policy.json');
    await writeFile(policyFile, JSON.stringify({ revision: 'fixture-1', principal: LOGIN, revoked: false,
      allow_partial_direct: true, max_body_bytes: 8192,
      grants: [{ repository: `${TARGET.owner}/${TARGET.repo}`, issue_number: TARGET.issue_number, data_class: 'synthetic-public' }] }));
    const h = harness(lane, { sdkProvider: {
      async listComments() { return []; },
      async readComment(params, id) {
        h.calls.push({ method: 'readComment', params, id });
        return matches ? comment() : { ...comment(), body: 'Different independently observed body.' };
      },
    } });
    const options = { provider: create(h.options), policyFile, ledgerDir: join(root, 'ledger'),
      native: { lane, call: lane === 'sdk' ? PARAMS : { name: 'add_issue_comment', arguments: PARAMS } },
      context: { principal: LOGIN, data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' },
      occurrence: 'native-writer-unit-fixture', strategy: 'protocol' };
    const executed = await executeAction(options);
    assert.equal(executed.outcome, matches ? 'confirmed' : 'unknown');
    assert.equal(executed.receipt.content_matches, matches);
    if (!matches) assert.equal(executed.reason, 'readback_mismatch');
    assert.equal(h.calls.find(call => call.method === 'readComment').id, ID);
    assert.equal((await executeAction(options)).outcome, 'duplicate_suppressed');
    assert.equal(sends(h).length, 1);
  });
}

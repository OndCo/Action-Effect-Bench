import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const api = await import('../native-mcp.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('/field-study/native-mcp.mjs')) return {};
  throw error;
});
function exported(name) {
  assert.equal(typeof api[name], 'function', `${name} must be implemented`);
  return api[name];
}
const open = options => exported('openNativeMcp')(options);
const decodeFile = (...args) => exported('decodeFileResult')(...args);
const decodeComment = result => exported('decodeCommentResult')(result);
const SECRET = 'synthetic-test-credential-never-log';
const BINARY_BYTES = Buffer.from('fixture executable identity; never executed\n');
const digest = value => createHash('sha256').update(value).digest('hex');
const SOURCE = 'eb47a99ddb866ca2b8a162920e6bda9521f33ebb';
const READ_TOOLS = ['get_file_contents', 'get_release_by_tag', 'issue_read'];
const WRITE_TOOLS = ['get_me', 'add_issue_comment'];
const URI = `repo://OndCo/Action-Effect-Spec/sha/${'a'.repeat(40)}/contents/SPEC.md`;
const POST = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2, body: 'Approved body.\n' };
const NO_RESPONSE = Symbol('no response');
let directory, binary;

before(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'native-mcp-test-')));
  binary = join(directory, 'fixture-binary');
  await writeFile(binary, BINARY_BYTES, { mode: 0o700 });
});
after(async () => { await rm(directory, { recursive: true, force: true }); });

function tool(name) {
  const string = { type: 'string' };
  const coordinates = { owner: string, repo: string };
  const definitions = {
    get_file_contents: { required: ['owner', 'repo'], properties: { ...coordinates, path: string, sha: string, ref: string } },
    get_release_by_tag: { required: ['owner', 'repo', 'tag'], properties: { ...coordinates, tag: string } },
    issue_read: { required: ['owner', 'repo', 'issue_number', 'method'], properties: {
      ...coordinates, issue_number: { type: 'number' }, method: { type: 'string', enum: ['get', 'get_comments', 'get_sub_issues', 'get_parent', 'get_labels'] },
      page: { type: 'number', minimum: 1 }, perPage: { type: 'number', minimum: 1, maximum: 100 },
    } },
    get_me: { properties: {} },
    add_issue_comment: { required: ['owner', 'repo', 'issue_number'], properties: {
      ...coordinates, issue_number: { type: 'number' }, body: { type: 'string', minLength: 1 },
      reaction: { type: 'string' }, comment_id: { type: 'integer' },
    } },
  };
  return structuredClone({ name, description: `Official-shaped ${name}`, inputSchema: { type: 'object', ...definitions[name] },
    annotations: { readOnlyHint: name !== 'add_issue_comment', idempotentHint: false } });
}

// Exercise the real SDK's initialize/list/call flow without spawning a process.
function harness({ tools = READ_TOOLS.map(tool), pages, protocol = '2025-11-25', server = { name: 'github-mcp-server', version: '2.0.2' },
  respond = () => ({ content: [{ type: 'text', text: '{"native":true}' }] }), failStart = false } = {}) {
  const state = { messages: [], starts: 0, closes: 0, tokenCalls: 0 };
  const transportFactory = params => {
    state.parameters = { ...params, args: [...params.args], env: { ...params.env } };
    state.liveParameters = params;
    const transport = {
      async start() {
        state.starts += 1;
        if (failStart) throw new Error(SECRET);
      },
      async send(message) {
        state.messages.push(structuredClone(message));
        if (message.id === undefined) return;
        let result;
        if (message.method === 'initialize') result = { protocolVersion: protocol, capabilities: { tools: {} }, serverInfo: server };
        else if (message.method === 'tools/list') result = pages ? pages(message.params?.cursor) : { tools };
        else if (message.method === 'tools/call') result = await respond(message.params, state);
        else throw new Error('unexpected_mock_request');
        if (result === NO_RESPONSE) return;
        queueMicrotask(() => transport.onmessage?.({ jsonrpc: '2.0', id: message.id, result }));
      },
      async close() {
        state.closes += 1;
        transport.onclose?.();
      },
    };
    return transport;
  };
  return { state, options: { binary, tokenProvider: async () => { state.tokenCalls += 1; return SECRET; }, transportFactory } };
}

function safeError(code, outcome = 'not_dispatched') {
  return error => {
    assert.equal(error.code, code);
    assert.equal(error.outcome, outcome);
    assert.equal(error.message, code);
    assert.equal(error.cause, undefined);
    assert.ok(!JSON.stringify(error).includes(SECRET));
    return true;
  };
}
const calls = state => state.messages.filter(message => message.method === 'tools/call');
const file = (text = 'public source\n', resource = {}) => ({ content: [
  { type: 'text', text: 'successfully downloaded text file' },
  { type: 'resource', resource: { uri: URI, mimeType: 'text/plain', text, ...resource } },
] });
const url = id => `https://github.com/OndCo/Action-Effect-Bench/issues/2#issuecomment-${id}`;
const comment = id => ({ content: [{ type: 'text', text: JSON.stringify({ id, url: url(id) }) }] });

test('launches a minimal read-only stdio connection and records observed inventory', async () => {
  const h = harness({ protocol: '2024-11-05' });
  const session = await open({ ...h.options, pins: { source_commit: SOURCE, archive_sha256: 'b'.repeat(64), executable_sha256: digest(BINARY_BYTES) } });
  assert.equal(h.state.tokenCalls, 1);
  assert.equal(h.state.starts, 1);
  assert.equal(h.state.parameters.command, binary);
  assert.equal(h.state.parameters.cwd, directory);
  assert.deepEqual(h.state.parameters.args, ['stdio', '--gh-host=https://github.com', '--toolsets=', '--read-only', `--tools=${READ_TOOLS.join(',')}`]);
  assert.equal(h.state.parameters.stderr, 'ignore');
  assert.deepEqual(Object.fromEntries(Object.entries(h.state.parameters.env).filter(([, value]) => value !== undefined)), {
    PATH: '/usr/bin:/bin', TZ: 'America/Toronto', GITHUB_PERSONAL_ACCESS_TOKEN: SECRET,
  });
  assert.equal(h.state.parameters.env.HOME, undefined);
  assert.equal(h.state.liveParameters.env.GITHUB_PERSONAL_ACCESS_TOKEN, undefined);
  assert.equal(session.inventory.executable_sha256, digest(BINARY_BYTES));
  assert.equal(session.inventory.protocol_version, '2024-11-05');
  assert.deepEqual(session.inventory.server, { name: 'github-mcp-server', version: '2.0.2' });
  assert.deepEqual(session.inventory.tools.map(value => value.name), READ_TOOLS);
  assert.deepEqual(session.inventory.tools[0].inputSchema, tool(READ_TOOLS[0]).inputSchema);
  assert.equal(session.inventory.pins.source_commit, SOURCE);
  assert.equal(session.inventory.read_only, true);
  assert.ok(/^[a-f0-9]{64}$/.test(session.inventory.tools_sha256));
  assert.ok(!JSON.stringify(session.inventory).includes(SECRET));
  assert.ok(!JSON.stringify(session.inventory).includes(directory));
  assert.equal(calls(h.state).length, 0);
  await session.close();
  await session.close();
  assert.equal(h.state.closes, 1);
});

test('collects paginated inventory before exposing calls', async () => {
  const h = harness({ pages: cursor => cursor ? { tools: READ_TOOLS.slice(1).map(tool) } : { tools: [tool(READ_TOOLS[0])], nextCursor: 'second' } });
  const session = await open(h.options);
  assert.deepEqual(session.inventory.tools.map(value => value.name), READ_TOOLS);
  assert.equal(h.state.messages.filter(message => message.method === 'tools/list').length, 2);
  assert.throws(() => session.inventory.tools.push(tool('get_me')), TypeError);
  await session.close();
});

test('pins child logging timezone without inheriting HOME', async () => {
  const h = harness();
  const session = await open(h.options);
  assert.equal(h.state.parameters.env.TZ, 'America/Toronto');
  assert.equal(h.state.parameters.env.HOME, undefined);
  await session.close();
});

test('returns raw MCP results without interpreting them as benchmark envelopes', async () => {
  const raw = file();
  const h = harness({ respond: () => raw });
  const session = await open(h.options);
  assert.deepEqual(await session.call('get_file_contents', { owner: 'OndCo', repo: 'Action-Effect-Spec', path: 'SPEC.md', sha: 'a'.repeat(40) }), raw);
  assert.equal(calls(h.state).length, 1);
  await session.close();
  await assert.rejects(() => session.call('issue_read', { ...POST, method: 'get' }), safeError('mcp_closed'));
});

test('decodes the preflight-observed URI and MIME shape with synthetic file bytes', async () => {
  // Metadata shape reported by the successful read-only preflight on 2026-10-19;
  // this is a mock regression, not another provider observation.
  const commit = 'cecde389637be4f5fd3482e4942ce3fd1a623ac6';
  const expectedUri = `repo://OndCo/Action-Effect-Bench/sha/${commit}/contents/spec-lock.json`;
  const mimeType = 'text/plain;charset=utf-8';
  const text = '{"fixture":"synthetic public file bytes"}\n';
  const response = file(text, { uri: expectedUri, mimeType });
  const h = harness({ protocol: '2025-11-25', respond: () => response });
  const session = await open(h.options);
  try {
    const actual = await session.call('get_file_contents', {
      owner: 'OndCo', repo: 'Action-Effect-Bench', sha: commit, path: 'spec-lock.json',
    });
    const decoded = decodeFile(actual, { uri: expectedUri });
    assert.equal(session.inventory.protocol_version, '2025-11-25');
    assert.equal(decoded.text, text);
    assert.equal(decoded.provider_metadata.uri, expectedUri);
    assert.equal(decoded.provider_metadata.mime_type, mimeType);
    assert.equal(decoded.sha256, digest(Buffer.from(text)));
    for (const uri of [expectedUri.replace(commit, 'b'.repeat(40)),
      expectedUri.replace('spec-lock.json', 'SPEC.md'), expectedUri.replace('Action-Effect-Bench', 'Action-Effect-Spec')]) {
      assert.throws(() => decodeFile(file(text, { uri, mimeType }), { uri: expectedUri }),
        safeError('mcp_invalid_file_result', 'read_failed'));
    }
    assert.equal(calls(h.state).length, 1);
  } finally { await session.close(); }
});

for (const [label, change, code] of [
  ['relative executable', { binary: './server' }, 'mcp_configuration'],
  ['nonfunction token provider', { tokenProvider: 'not-a-function' }, 'mcp_configuration'],
  ['nonboolean writable', { writable: 'true' }, 'mcp_configuration'],
  ['zero timeout', { timeoutMs: 0 }, 'mcp_configuration'],
  ['unbounded timeout', { timeoutMs: Infinity }, 'mcp_configuration'],
  ['unknown tool', { selectedTools: ['delete_repository'] }, 'mcp_configuration'],
  ['duplicate tool', { selectedTools: ['issue_read', 'issue_read'] }, 'mcp_configuration'],
  ['empty tools', { selectedTools: [] }, 'mcp_configuration'],
  ['write tool on default connection', { selectedTools: WRITE_TOOLS }, 'mcp_read_only'],
  ['malformed provenance', { pins: { source_commit: SECRET } }, 'mcp_configuration'],
  ['unknown provenance member', { pins: { token: SECRET } }, 'mcp_configuration'],
]) test(`rejects ${label} before credential acquisition`, async () => {
  const h = harness();
  await assert.rejects(() => open({ ...h.options, ...change }), safeError(code));
  assert.equal(h.state.tokenCalls, 0);
  assert.equal(h.state.starts, 0);
});

test('rejects a mismatched executable pin before acquiring credentials', async () => {
  const h = harness();
  await assert.rejects(() => open({ ...h.options, pins: { executable_sha256: '0'.repeat(64) } }), safeError('mcp_executable_identity'));
  assert.equal(h.state.tokenCalls, 0);
  assert.equal(h.state.starts, 0);
});

test('does not launch a binary replaced while credentials were being acquired', async () => {
  const changingBinary = join(directory, 'changed-before-launch');
  await writeFile(changingBinary, BINARY_BYTES, { mode: 0o700 });
  const h = harness();
  await assert.rejects(() => open({ ...h.options, binary: changingBinary, tokenProvider: async () => {
    await writeFile(changingBinary, 'different executable bytes');
    return SECRET;
  } }), safeError('mcp_executable_identity'));
  assert.equal(h.state.starts, 0);
});

test('does not publish stale executable identity after startup source drift', async () => {
  const changingBinary = join(directory, 'changed-during-startup');
  await writeFile(changingBinary, BINARY_BYTES, { mode: 0o700 });
  const h = harness();
  await assert.rejects(() => open({ ...h.options, binary: changingBinary, transportFactory: parameters => {
    const transport = h.options.transportFactory(parameters);
    const start = transport.start.bind(transport);
    transport.start = async () => {
      await start();
      await writeFile(changingBinary, 'different executable bytes');
    };
    return transport;
  } }), safeError('mcp_executable_identity'));
  assert.ok(h.state.closes >= 1);
  assert.equal(calls(h.state).length, 0);
});

test('redacts credential acquisition and initialization failures', async () => {
  const h = harness();
  await assert.rejects(() => open({ ...h.options, tokenProvider: async () => { throw new Error(SECRET); } }), safeError('mcp_auth_unavailable'));
  assert.equal(h.state.starts, 0);
  const failed = harness({ failStart: true });
  await assert.rejects(() => open(failed.options), safeError('mcp_initialization_failed'));
  assert.ok(failed.state.closes >= 1);
  assert.equal(failed.state.liveParameters.env.GITHUB_PERSONAL_ACCESS_TOKEN, undefined);
});

for (const [label, tools] of [
  ['missing selected tool', READ_TOOLS.slice(1).map(tool)],
  ['unexpected tool', [...READ_TOOLS.map(tool), tool('get_me')]],
  ['duplicate tool', [tool('issue_read'), ...READ_TOOLS.map(tool)]],
  ['read tool marked writable', READ_TOOLS.map(name => ({ ...tool(name), annotations: { readOnlyHint: false } }))],
  ['incompatible input schema', READ_TOOLS.map(name => ({ ...tool(name), inputSchema: { type: 'object', properties: {} } }))],
]) test(`rejects inventory with ${label}`, async () => {
  const h = harness({ tools });
  await assert.rejects(() => open(h.options), safeError('mcp_inventory_invalid'));
  assert.ok(h.state.closes >= 1);
  assert.equal(calls(h.state).length, 0);
});

test('rejects repeated inventory cursors rather than looping', async () => {
  const h = harness({ pages: () => ({ tools: [], nextCursor: 'repeat' }) });
  await assert.rejects(() => open(h.options), safeError('mcp_inventory_invalid'));
  assert.ok(h.state.messages.length < 6);
});

test('read-only calls reject mutations and nonselected tools without dispatch', async () => {
  const h = harness();
  const session = await open(h.options);
  await assert.rejects(() => session.call('add_issue_comment', POST), safeError('mcp_read_only'));
  await assert.rejects(() => session.call('get_me', {}), safeError('mcp_tool_not_selected'));
  await assert.rejects(() => session.call('delete_repository', {}), safeError('mcp_tool_not_selected'));
  assert.equal(calls(h.state).length, 0);
  await session.close();
});

test('writer explicitly selects identity and comment tools, preserving body bytes', async () => {
  const h = harness({ tools: WRITE_TOOLS.map(tool), respond: ({ name }) => name === 'get_me'
    ? { content: [{ type: 'text', text: '{"login":"OndCo","id":1}' }] } : comment('9') });
  const selectedTools = [...WRITE_TOOLS];
  const session = await open({ ...h.options, writable: true, selectedTools });
  selectedTools.push('delete_repository');
  assert.deepEqual(h.state.parameters.args, ['stdio', '--gh-host=https://github.com', '--toolsets=', '--read-only=false', '--tools=get_me,add_issue_comment']);
  await session.call('get_me', {});
  const args = { ...POST, body: '  exact\r\nbody\n' };
  const pending = session.call('add_issue_comment', args);
  args.body = 'changed after call';
  assert.equal(decodeComment(await pending), '9');
  assert.deepEqual(calls(h.state).map(value => value.params.name), WRITE_TOOLS);
  assert.equal(calls(h.state)[1].params.arguments.body, '  exact\r\nbody\n');
  await session.close();
});

for (const [label, args] of [
  ['reaction', { ...POST, reaction: '+1' }],
  ['comment_id', { ...POST, comment_id: 1 }],
  ['unknown key', { ...POST, dry_run: true }],
  ['missing body', { owner: POST.owner, repo: POST.repo, issue_number: 2 }],
  ['empty body', { ...POST, body: '' }],
  ['oversized UTF-8 body', { ...POST, body: '\u00e9'.repeat(4097) }],
  ['unpaired surrogate', { ...POST, body: '\ud800' }],
  ['fractional issue', { ...POST, issue_number: 1.5 }],
  ['string issue', { ...POST, issue_number: '2' }],
  ['unsafe issue', { ...POST, issue_number: Number.MAX_SAFE_INTEGER + 1 }],
  ['coordinate traversal', { ...POST, owner: '../OndCo' }],
  ['accessor property', Object.defineProperty({ ...POST }, 'body', { enumerable: true, get() { throw new Error(SECRET); } })],
]) test(`rejects comment ${label} before dispatch`, async () => {
  const h = harness({ tools: WRITE_TOOLS.map(tool) });
  const session = await open({ ...h.options, writable: true, selectedTools: WRITE_TOOLS });
  await assert.rejects(() => session.call('add_issue_comment', args), safeError('mcp_invalid_arguments'));
  assert.equal(calls(h.state).length, 0);
  await session.close();
});

test('validates read arguments without becoming a repository authorization policy', async () => {
  const h = harness();
  const session = await open(h.options);
  await session.call('get_release_by_tag', { owner: 'approved-owner', repo: 'approved-repo', tag: 'v1.0.0' });
  for (const [name, args] of [
    ['get_file_contents', { owner: 'OndCo', repo: 'Action-Effect-Spec', path: '../private', sha: 'a'.repeat(40) }],
    ['get_file_contents', { owner: 'OndCo', repo: 'Action-Effect-Spec', path: 'SPEC.md', sha: 'main' }],
    ['get_file_contents', { owner: 'OndCo', repo: 'Action-Effect-Spec', path: 'SPEC.md', sha: 'a'.repeat(40), ref: 'main' }],
    ['issue_read', { owner: 'OndCo', repo: 'Action-Effect-Spec', issue_number: 1, method: 'get_comments', perPage: 101 }],
    ['issue_read', { owner: 'OndCo', repo: 'Action-Effect-Spec', issue_number: 1, method: 'write' }],
  ]) await assert.rejects(() => session.call(name, args), safeError('mcp_invalid_arguments'));
  assert.equal(calls(h.state).length, 1);
  await session.close();
});

for (const [label, respond, code] of [
  ['tool error', () => ({ isError: true, content: [{ type: 'text', text: SECRET }] }), 'mcp_tool_error'],
  ['transport error', () => { throw new Error(SECRET); }, 'mcp_transport_error'],
  ['timeout', () => NO_RESPONSE, 'mcp_timeout'],
]) test(`mutation ${label} is redacted, unknown and never automatically retried`, async () => {
  const h = harness({ tools: WRITE_TOOLS.map(tool), respond });
  const session = await open({ ...h.options, selectedTools: WRITE_TOOLS, writable: true, timeoutMs: 30 });
  await assert.rejects(() => session.call('add_issue_comment', POST), safeError(code, 'unknown'));
  assert.equal(calls(h.state).length, 1);
  await assert.rejects(() => session.call('add_issue_comment', POST), safeError('mcp_mutation_unknown', 'unknown'));
  assert.equal(calls(h.state).length, 1);
  await session.close();
});

test('read tool errors are processing failures, not authorization denials', async () => {
  const h = harness({ respond: () => ({ isError: true, content: [{ type: 'text', text: SECRET }] }) });
  const session = await open(h.options);
  await assert.rejects(() => session.call('get_release_by_tag', { owner: 'OndCo', repo: 'Action-Effect-Spec', tag: 'v1' }), safeError('mcp_tool_error', 'read_failed'));
  await session.close();
});

test('file decoder accepts bounded legacy resources and preserves exact UTF-8', () => {
  const text = '\ufeffpublic\r\n\u00e9\n';
  const result = decodeFile(file(text), { uri: URI });
  assert.equal(result.text, text);
  assert.equal(result.provider_metadata.uri, URI);
  assert.equal(result.provider_metadata.mime_type, 'text/plain');
  assert.equal(result.byte_length, Buffer.byteLength(text));
  assert.equal(result.sha256, digest(Buffer.from(text)));
  assert.equal(result.receipt, undefined);
  assert.equal(decodeFile(file(''), { uri: URI }).text, '');
});

test('file decoder supports canonical base64 UTF-8 resources without fetching links', () => {
  const result = { content: [{ type: 'resource', resource: { uri: URI, mimeType: 'application/json', blob: Buffer.from('{"public":true}\n').toString('base64') } }] };
  assert.equal(decodeFile(result, { uri: URI }).text, '{"public":true}\n');
});

test('file decoder accepts explicit structured resources and checks their text mirror', () => {
  const structuredContent = { content: file().content };
  assert.equal(decodeFile({ content: [], structuredContent }, { uri: URI }).text, 'public source\n');
  assert.equal(decodeFile({ content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent }, { uri: URI }).text, 'public source\n');
  assert.equal(decodeFile({ ...file(), structuredContent }, { uri: URI }).text, 'public source\n');
});

for (const [label, result] of [
  ['missing content', {}],
  ['plain text without bound resource', { content: [{ type: 'text', text: 'public source' }] }],
  ['wrong URI', file('public', { uri: URI.replace('SPEC.md', 'other.md') })],
  ['URI with query', file('public', { uri: `${URI}?ref=main` })],
  ['two resources', { content: [file().content[1], file().content[1]] }],
  ['text and blob together', file('public', { blob: 'cHVibGlj' })],
  ['invalid UTF-8', { content: [{ type: 'resource', resource: { uri: URI, blob: '/w==' } }] }],
  ['noncanonical base64', { content: [{ type: 'resource', resource: { uri: URI, blob: 'YQ' } }] }],
  ['surrogate text', file('\ud800')],
  ['binary mime type', file('not an image', { mimeType: 'image/png' })],
  ['resource link', { content: [{ type: 'resource_link', uri: URI, name: 'SPEC.md' }] }],
  ['extra image', { content: [...file().content, { type: 'image', data: '', mimeType: 'image/png' }] }],
  ['oversized body', file('x'.repeat(180001))],
  ['oversized notice', { content: [{ type: 'text', text: 'x'.repeat(4097) }, file().content[1]] }],
  ['conflicting structured resource', { ...file(), structuredContent: { content: file('different').content } }],
  ['malformed isError', { ...file(), isError: 'false' }],
]) test(`file decoder rejects ${label}`, () => {
  assert.throws(() => decodeFile(result, { uri: URI }), safeError('mcp_invalid_file_result', 'read_failed'));
});

test('file decoder enforces the caller bound and rejects absent expected identity', () => {
  assert.throws(() => decodeFile(file(), {}), safeError('mcp_invalid_file_expectation'));
  assert.throws(() => decodeFile(file(), { uri: URI, maxBytes: 3 }), safeError('mcp_invalid_file_result', 'read_failed'));
  assert.throws(() => decodeFile(file(), { uri: URI, maxBytes: 180001 }), safeError('mcp_invalid_file_expectation'));
  assert.throws(() => decodeFile({ isError: true, content: [{ type: 'text', text: SECRET }] }, { uri: URI }), safeError('mcp_tool_error', 'read_failed'));
});

test('comment decoder returns only a canonical safe-integer ID, never a receipt', () => {
  assert.equal(decodeComment(comment('7')), '7');
  assert.equal(decodeComment(comment(7)), '7');
  assert.equal(decodeComment(comment(String(Number.MAX_SAFE_INTEGER))), String(Number.MAX_SAFE_INTEGER));
  const structuredContent = { id: '7', html_url: url('7') };
  assert.equal(decodeComment({ content: [], structuredContent }), '7');
  assert.equal(decodeComment({ content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent }), '7');
});

for (const id of ['', '0', '01', '-1', '+1', '1e2', ' 1', '1 ', '1.0', '9007199254740992', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, true]) {
  test(`comment decoder rejects noncanonical or unsafe ID ${JSON.stringify(id)}`, () => {
    assert.throws(() => decodeComment(comment(id)), safeError('mcp_invalid_comment_result', 'unknown'));
  });
}

for (const [label, result] of [
  ['empty result', { content: [] }],
  ['non-JSON text', { content: [{ type: 'text', text: SECRET }] }],
  ['duplicate ID keys', { content: [{ type: 'text', text: `{"id":"6","id":"7","url":"${url('7')}"}` }] }],
  ['exponent-form numeric ID', { content: [{ type: 'text', text: `{"id":7e0,"url":"${url('7')}"}` }] }],
  ['reaction-only shape', { content: [{ type: 'text', text: '{"id":"7"}' }] }],
  ['array result', { content: [{ type: 'text', text: '[{"id":"7"}]' }] }],
  ['extra receipt claim', { content: [{ type: 'text', text: JSON.stringify({ id: '7', url: url('7'), receipt: true }) }] }],
  ['wrong URL ID', { content: [{ type: 'text', text: JSON.stringify({ id: '7', url: url('8') }) }] }],
  ['unexpected URL host', { content: [{ type: 'text', text: JSON.stringify({ id: '7', url: url('7').replace('github.com', 'example.com') }) }] }],
  ['multiple content blocks', { content: [...comment('7').content, ...comment('7').content] }],
  ['structured disagreement', { ...comment('7'), structuredContent: { id: '8', url: url('8') } }],
  ['oversized text', { content: [{ type: 'text', text: ' '.repeat(16385) }] }],
]) test(`comment decoder rejects ${label}`, () => {
  assert.throws(() => decodeComment(result), safeError('mcp_invalid_comment_result', 'unknown'));
});

test('comment decoder never exposes provider error content', () => {
  assert.throws(() => decodeComment({ isError: true, content: [{ type: 'text', text: SECRET }] }), safeError('mcp_tool_error', 'unknown'));
});

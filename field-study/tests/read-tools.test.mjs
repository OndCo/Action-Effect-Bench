import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertPublicValue } from '../artifacts.mjs';
import { readPublicAsset } from '../github-reader.mjs';

let createReadTools, FieldStudyJournalError;
try { ({ createReadTools, FieldStudyJournalError } = await import('../read-tools.mjs')); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('/read-tools.mjs')) throw error; }

const BENCH = 'OndCo/Action-Effect-Bench';
const SPEC = 'OndCo/Action-Effect-Spec';
const REF = 'a'.repeat(40);
const TAG = 'v0.2.0-draft.1';
const PATH = 'README.md';
const TEXT = 'Public source.\r\nCafe\u0301 \u{1f3ab}\n';
const PDF = Buffer.from('%PDF-1.7\npublic fixture\n');
const MAX_TEXT = 180000;
const MAX_INSPECT = 2 * 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fileUrl = (repository = BENCH, path = PATH) => `https://github.com/${repository}/blob/${REF}/${path}`;
const releaseUrl = (repository = BENCH) => `https://github.com/${repository}/releases/tag/${TAG}`;
const assetUrl = (repository = BENCH) => `https://github.com/${repository}/releases/download/${TAG}/manuscript.pdf`;

function task(overrides = {}) {
  return { id: 'release-integrity', lane: 'sdk', allow_release_assets: true,
    sources: [{ repository: BENCH, path: PATH, ref: REF },
      { repository: SPEC, path: 'profiles/github-issue-comment/README.md', ref: REF }], ...overrides };
}

function release(overrides = {}) {
  return { id: 42, tag_name: TAG, html_url: releaseUrl(), draft: false, prerelease: true,
    assets: [{ name: 'manuscript.pdf', size: PDF.length, browser_download_url: assetUrl(), digest: `sha256:${sha(PDF)}` }],
    ...overrides };
}

function readerMetadata(lane, text = TEXT) {
  const args = { owner: 'OndCo', repo: 'Action-Effect-Bench', path: PATH };
  if (lane === 'sdk') {
    return { sdk: '@octokit/rest@22.0.1', git_blob_sha: 'b'.repeat(40),
      native_request: { route: 'GET /repos/{owner}/{repo}/contents/{path}', ...args, ref: REF },
      native_response: { type: 'file', path: PATH, encoding: 'base64', size: Buffer.byteLength(text),
        content: Buffer.from(text).toString('base64') } };
  }
  const uri = `repo://${BENCH}/sha/${REF}/contents/${PATH}`;
  const response = { content: [{ type: 'resource', resource: { uri, mimeType: 'text/plain', text } }] };
  return { transport: 'official-github-mcp-stdio', resource_uri: uri,
    native_request: { name: 'get_file_contents', arguments: { ...args, sha: REF } },
    native_response: response, native_response_sha256: sha(JSON.stringify(response)) };
}

function factory(options) {
  assert.equal(typeof createReadTools, 'function', 'createReadTools must be implemented');
  return createReadTools(options);
}

function fixture(options = {}) {
  const calls = [], events = [];
  const makeReader = lane => Object.fromEntries(['readFile', 'readRelease', 'readAsset'].map(method => [method, async function(args) {
    calls.push({ lane, method, arguments: structuredClone(args) });
    if (options[method]) return options[method](args, lane);
    if (method === 'readFile') return { text: TEXT };
    if (method === 'readRelease') return release();
    return Buffer.from(PDF);
  }]));
  const sdk = makeReader('sdk'), mcp = makeReader('mcp');
  const selectedTask = options.task ?? task();
  const journal = options.journal ?? { append: event => events.push(structuredClone(event)) };
  const tools = factory({ task: selectedTask, sdk, mcp, journal });
  return { tools, calls, events, task: selectedTask, sdk, mcp };
}

const execute = (f, name, args) => f.tools[name].execute(args);
const read = (f, args = { repository: BENCH, path: PATH }) => execute(f, 'read_repository_file', args);
const inspect = (f, args = { repository: BENCH, path: PATH }) => execute(f, 'inspect_repository_file', args);
const inspectRelease = (f, args = { repository: BENCH }) => execute(f, 'inspect_release', args);
const inspectAsset = (f, args = { repository: BENCH, asset_name: 'manuscript.pdf' }) => execute(f, 'inspect_release_asset', args);

function unavailable(result, reason) {
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, reason);
  assert.equal(Object.hasOwn(result, 'text'), false);
  assert.equal(Object.hasOwn(result, 'guardrail'), false);
}

test('exports exactly four strict function tools for runAgent', () => {
  const f = fixture();
  const names = ['read_repository_file', 'inspect_repository_file', 'inspect_release', 'inspect_release_asset'];
  assert.deepEqual(Object.keys(f.tools).sort(), names.sort());
  for (const name of names) {
    const { schema, execute } = f.tools[name];
    assert.equal(schema.type, 'function');
    assert.equal(schema.name, name);
    assert.equal(schema.strict, true);
    assert.equal(typeof schema.description, 'string');
    assert.equal(schema.parameters.type, 'object');
    assert.equal(schema.parameters.additionalProperties, false);
    assert.deepEqual([...schema.parameters.required].sort(), Object.keys(schema.parameters.properties).sort());
    assert.equal(typeof execute, 'function');
  }
  assert.equal(f.calls.length, 0);
});

for (const lane of ['sdk', 'mcp']) {
  test(`${lane} selects only its actual reader and preserves the file bytes`, async () => {
    const f = fixture({ task: task({ lane }) });
    const result = await read(f);
    assert.equal(result.status, 'ok');
    assert.deepEqual({ repository: result.repository, path: result.path, ref: result.ref, text: result.text,
      sha256: result.sha256, bytes: result.bytes, source_url: result.source_url },
    { repository: BENCH, path: PATH, ref: REF, text: TEXT, sha256: sha(Buffer.from(TEXT)),
      bytes: Buffer.byteLength(TEXT), source_url: fileUrl() });
    assert.deepEqual(f.calls, [{ lane, method: 'readFile', arguments: { owner: 'OndCo', repo: 'Action-Effect-Bench', path: PATH, ref: REF } }]);
    const event = f.events.find(row => row.type === 'read_tool_result');
    assert.equal(event.source_url, fileUrl());
    assert.deepEqual(Buffer.from(event.content_base64, 'base64'), Buffer.from(TEXT));
    assert.equal(event.result.sha256, result.sha256);
    assert.equal(event.result.bytes, result.bytes);
    assert.equal(event.native_calls, 1);
    assert.deepEqual(event.call_counts, { readFile: 1, readRelease: 0, readAsset: 0 });
    assert.ok(event.duration_ms >= 0 && Number.isFinite(event.duration_ms));
    const start = f.events.find(row => row.type === 'read_call_start');
    assert.equal(start.lane, lane);
    assert.equal(start.method, 'readFile');
    assert.deepEqual(start.arguments, f.calls[0].arguments);
    assert.equal(f.events.find(row => row.type === 'read_call_result').status, 'ok');
  });

  test(`${lane} unavailable reader is recorded once without retry or lane fallback`, async () => {
    const secret = 'private-path-and-token-must-not-escape';
    const f = fixture({ task: task({ lane }), readFile: () => { throw new Error(secret); } });
    const result = await read(f);
    unavailable(result, 'reader_unavailable');
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].lane, lane);
    assert.equal(f.events.at(-1).status, 'unavailable');
    assert.equal(f.events.at(-1).native_calls, 1);
    assert.equal(JSON.stringify({ result, events: f.events }).includes(secret), false);
  });
}

for (const native_reason of ['provider_read_failure', ...[401, 403, 404, 429, 500, 502, 503, 504].map(status => `provider_read_failure_${status}`),
  'mcp_tool_error', 'mcp_timeout', 'mcp_transport_error', 'mcp_invalid_file_result', 'release_binding']) {
  test(`preserves only the curated native failure code ${native_reason} in journal results`, async () => {
    const f = fixture({ readFile: () => { throw new Error(native_reason); } });
    const result = await read(f);
    unavailable(result, 'reader_unavailable');
    assert.equal(Object.hasOwn(result, 'native_reason'), false);
    assert.equal(f.events.find(row => row.type === 'read_call_result').native_reason, native_reason);
    assert.equal(f.events.at(-1).native_reason, native_reason);
    assert.equal(f.calls.length, 1);
    f.events.forEach(event => assertPublicValue(event));
  });
}

for (const message of ['private-transport-secret', 'provider_read_failure_418', 'provider_read_failure_401 private-secret',
  'mcp_timeout\nprivate-secret', `ghp_${'S'.repeat(32)}`]) {
  test(`does not publish an uncurated native error: ${JSON.stringify(message)}`, async () => {
    const f = fixture({ readFile: () => { throw new Error(message); } });
    unavailable(await read(f), 'reader_unavailable');
    assert.equal(f.events.find(row => row.type === 'read_call_result').native_reason, null);
    assert.equal(f.events.at(-1).native_reason, null);
    assert.equal(JSON.stringify(f.events).includes(message), false);
    assert.equal(f.calls.length, 1);
  });
}

for (const args of [
  { repository: BENCH, path: 'field-study/private/scoring-canary.json' },
  { repository: 'Other/Action-Effect-Bench', path: PATH },
  { repository: BENCH, path: 'profiles/github-issue-comment/README.md' },
  { repository: SPEC, path: PATH },
  { repository: BENCH, path: 'README.md/' },
  { repository: BENCH, path: '.' },
  { repository: BENCH, path: '' },
  { repository: BENCH, path: '../README.md' },
  { repository: BENCH, path: '/Users/private/scoring.json' },
  { repository: BENCH, path: 'https://example.invalid/scoring.json' },
  { repository: BENCH, path: '%52EADME.md' },
  { repository: BENCH, path: 'README.md?ref=main' },
]) {
  for (const name of ['read_repository_file', 'inspect_repository_file']) {
    test(`${name} rejects out-of-allowlist ${JSON.stringify(args)} before any reader`, async () => {
      const f = fixture();
      unavailable(await execute(f, name, args), 'source_not_allowed');
      assert.equal(f.calls.length, 0);
      assert.equal(f.events.at(-1).native_calls, 0);
    });
  }
}

for (const args of [null, [], {}, { repository: BENCH }, { repository: BENCH, path: PATH, ref: 'main' },
  { repository: BENCH, path: PATH, ref: REF }, { repository: BENCH, path: PATH, lane: 'mcp' },
  { repository: BENCH, path: PATH, url: 'https://example.invalid' }, { repository: BENCH, path: 1 },
  { repository: BENCH, path: PATH, search: 'scoring canary' }]) {
  test(`unknown fields or invalid file arguments are unavailable: ${JSON.stringify(args)}`, async () => {
    const f = fixture();
    unavailable(await read(f, args), 'invalid_arguments');
    assert.equal(f.calls.length, 0);
  });
}

test('accepts null-prototype JSON arguments without accepting inherited or accessor fields', async () => {
  const f = fixture();
  assert.equal((await read(f, Object.assign(Object.create(null), { repository: BENCH, path: PATH }))).status, 'ok');
  let getterCalls = 0;
  const args = { repository: BENCH, get path() { getterCalls += 1; return PATH; } };
  unavailable(await read(f, args), 'invalid_arguments');
  unavailable(await read(f, Object.create({ repository: BENCH, path: PATH })), 'invalid_arguments');
  assert.equal(getterCalls, 0);
  assert.equal(f.calls.length, 1);
});

test('snapshots task sources, asset permission, lane and selected reader methods', async () => {
  const f = fixture({ task: task({ allow_release_assets: false }) });
  f.task.lane = 'mcp';
  f.task.allow_release_assets = true;
  f.task.sources[0].ref = 'b'.repeat(40);
  f.task.sources.push({ repository: BENCH, path: 'scoring.json', ref: REF });
  f.sdk.readFile = () => { throw new Error('replacement reader'); };
  assert.equal((await read(f)).ref, REF);
  unavailable(await read(f, { repository: BENCH, path: 'scoring.json' }), 'source_not_allowed');
  unavailable(await inspectAsset(f), 'asset_not_allowed');
  assert.deepEqual(f.calls.map(row => row.lane), ['sdk']);
});

for (const [label, text] of [
  ['empty', ''], ['CRLF', 'one\r\ntwo\r\n'], ['BOM', '\ufeffsource'], ['Unicode', 'e\u0301\u{1f3ab}'],
  ['literal replacement character', '\ufffd'], ['UTF-8 buffer BOM', Buffer.from('\ufeffsource')],
  ['maximum ASCII text', 'x'.repeat(MAX_TEXT)], ['maximum multibyte text', '\u20ac'.repeat(MAX_TEXT / 3)],
]) {
  test(`preserves ${label} without Unicode normalization or trimming`, async () => {
    const f = fixture({ readFile: () => ({ text }) });
    const result = await read(f);
    const bytes = Buffer.isBuffer(text) ? text : Buffer.from(text);
    assert.equal(result.status, 'ok');
    assert.deepEqual(Buffer.from(result.text), bytes);
    assert.equal(result.sha256, sha(bytes));
    assert.equal(result.bytes, bytes.length);
  });
}

for (const text of ['\ud800', 'x\udc00', Buffer.from([0xc3, 0x28]), Buffer.from([0xed, 0xa0, 0x80])]) {
  test(`rejects invalid UTF-8/scalars ${JSON.stringify(text)}`, async () => {
    const f = fixture({ readFile: () => ({ text }) });
    unavailable(await read(f), 'invalid_file_utf8');
    unavailable(await inspect(f), 'invalid_file_utf8');
    assert.equal(f.calls.length, 2);
    assert.equal(f.events.some(row => Object.hasOwn(row, 'content_base64')), false);
  });
}

for (const text of ['x'.repeat(MAX_TEXT + 1), '\u20ac'.repeat(MAX_TEXT / 3 + 1)]) {
  test(`text return is capped by UTF-8 bytes (${Buffer.byteLength(text)})`, async () => {
    const f = fixture({ readFile: () => ({ text }) });
    unavailable(await read(f), 'file_too_large');
    assert.ok(JSON.stringify(f.events).length < 10000);
  });
}

for (const size of [900348, MAX_INSPECT]) {
  test(`metadata-only inspection hashes all ${size} bytes without sending or journaling text`, async () => {
    const text = 'x'.repeat(size);
    const f = fixture({ readFile: () => ({ text }) });
    const result = await inspect(f);
    assert.equal(result.status, 'ok');
    assert.equal(result.bytes, size);
    assert.equal(result.sha256, sha(Buffer.from(text)));
    assert.equal(result.source_url, fileUrl());
    assert.equal(Object.hasOwn(result, 'text'), false);
    assert.equal(f.events.at(-1).source_url, fileUrl());
    assert.equal(f.events.at(-1).result.bytes, size);
    assert.equal(f.events.at(-1).result.sha256, result.sha256);
    assert.equal(f.events.some(row => Object.hasOwn(row, 'content_base64')), false);
    assert.ok(JSON.stringify({ result, events: f.events }).length < 10000);
  });
}

test('metadata-only inspection refuses more than 2 MiB', async () => {
  const f = fixture({ readFile: () => ({ text: 'x'.repeat(MAX_INSPECT + 1) }) });
  unavailable(await inspect(f), 'file_too_large');
  assert.ok(JSON.stringify(f.events).length < 10000);
});

for (const response of [null, [], {}, { text: 12 }, { text: { content: 'not a string' } }]) {
  test(`rejects malformed file response ${JSON.stringify(response)}`, async () => {
    const f = fixture({ readFile: () => response });
    unavailable(await read(f), 'invalid_file_result');
  });
}

test('rejects private facade metadata while continuing to omit unselected release fields', async () => {
  const secret = 'facade-private-token-path';
  const f = fixture({ readFile: () => ({ text: TEXT, metadata: { authorization: secret, debug: secret, headers: { cookie: secret } } }),
    readRelease: () => release({ authorization: secret, body: secret, uploader: { token: secret } }) });
  const results = [await read(f), await inspectRelease(f)];
  unavailable(results[0], 'reader_metadata_not_public');
  assert.equal(results[1].status, 'ok');
  assert.equal(JSON.stringify({ results, events: f.events }).includes(secret), false);
});

for (const lane of ['sdk', 'mcp']) {
  for (const name of ['read_repository_file', 'inspect_repository_file']) {
    test(`${lane} ${name} retains exact native metadata only in journal results`, async () => {
      const metadata = readerMetadata(lane);
      const f = fixture({ task: task({ lane }), readFile: () => ({ text: TEXT, metadata }) });
      const result = await execute(f, name, { repository: BENCH, path: PATH });
      assert.equal(result.status, 'ok');
      assert.equal(Object.hasOwn(result, 'metadata'), false);
      assert.equal(Object.hasOwn(result, 'reader_metadata'), false);
      assert.equal(JSON.stringify(result).includes('native_response'), false);
      assert.equal(Object.hasOwn(result, 'text'), name === 'read_repository_file');
      const call = f.events.find(row => row.type === 'read_call_result');
      assert.deepEqual(call.reader_metadata, metadata);
      const completed = f.events.find(row => row.type === 'read_tool_result');
      assert.deepEqual(completed.reader_metadata, [{ native_call_index: call.native_call_index, method: 'readFile', metadata }]);
      assert.equal(Object.hasOwn(completed.result, 'reader_metadata'), false);
      assert.equal(f.events.find(row => row.type === 'read_call_start').reader_metadata, undefined);
      f.events.forEach(event => assertPublicValue(event));
    });
  }
}

test('reader metadata is snapshotted before an asynchronous journal can change the facade response', async () => {
  const metadata = readerMetadata('mcp'), original = structuredClone(metadata), events = [];
  const f = fixture({ readFile: () => ({ text: TEXT, metadata }), journal: { async append(event) {
    events.push(structuredClone(event));
    if (event.type === 'read_call_result') {
      metadata.native_response.content[0].resource.text = 'changed after return';
      metadata.native_request.arguments.path = 'changed-after-return.md';
    }
  } } });
  assert.equal((await read(f)).status, 'ok');
  assert.deepEqual(events.find(row => row.type === 'read_call_result').reader_metadata, original);
  assert.deepEqual(events.at(-1).reader_metadata[0].metadata, original);
});

for (const size of [900348, MAX_INSPECT]) {
  test(`inspection retains the ${size}-byte source native envelope in the journal, not the model result`, async () => {
    const text = 'x'.repeat(size), metadata = readerMetadata('sdk', text);
    const f = fixture({ readFile: () => ({ text, metadata }) });
    const result = await inspect(f);
    assert.equal(result.status, 'ok');
    assert.equal(result.bytes, size);
    assert.equal(result.sha256, sha(Buffer.from(text)));
    assert.ok(JSON.stringify(result).length < 2000);
    assert.equal(Object.hasOwn(result, 'text'), false);
    const call = f.events.find(row => row.type === 'read_call_result');
    assert.deepEqual(call.reader_metadata, metadata);
    assert.deepEqual(Buffer.from(call.reader_metadata.native_response.content, 'base64'), Buffer.from(text));
    assert.deepEqual(f.events.at(-1).reader_metadata[0].metadata, metadata);
    assert.ok(JSON.stringify(f.events).length < 8 * 1024 * 1024);
    assert.equal(f.events.at(-1).content_base64, undefined);
  });
}

test('safe native metadata survives an unavailable normalized file result', async () => {
  const metadata = readerMetadata('sdk');
  const f = fixture({ readFile: () => ({ text: 42, metadata }) });
  unavailable(await read(f), 'invalid_file_result');
  assert.deepEqual(f.events.find(row => row.type === 'read_call_result').reader_metadata, metadata);
  assert.deepEqual(f.events.at(-1).reader_metadata[0].metadata, metadata);
  assert.equal(f.events.at(-1).native_calls, 1);
});

test('optional public metadata on a release read is also journal-only', async () => {
  const metadata = { transport: 'official-github-mcp-stdio',
    native_request: { name: 'get_release_by_tag', arguments: { owner: 'OndCo', repo: 'Action-Effect-Bench', tag: TAG } },
    native_response: { content: [{ type: 'text', text: JSON.stringify(release()) }] } };
  const f = fixture({ readRelease: () => release({ metadata }) });
  const result = await inspectRelease(f);
  assert.equal(result.status, 'ok');
  assert.equal(Object.hasOwn(result, 'metadata'), false);
  assert.deepEqual(f.events.find(row => row.type === 'read_call_result').reader_metadata, metadata);
  assert.deepEqual(f.events.at(-1).reader_metadata[0].metadata, metadata);
});

for (const [label, extra] of [
  ['authorization field', { authorization: 'never-publish-this-field' }],
  ['nested header', { native_response: { headers: { authorization: 'never-publish-this-header' } } }],
  ['credential text', { native_response: { content: [{ type: 'text', text: `ghp_${'S'.repeat(32)}` }] } }],
  ['encrypted reasoning field', { native_response: { encrypted_content: 'never-publish-this-reasoning' } }],
]) {
  test(`${label} is rejected before even an unguarded journal receives reader metadata`, async () => {
    const f = fixture({ readFile: () => ({ text: TEXT, metadata: { ...readerMetadata('sdk'), ...extra } }) });
    unavailable(await read(f), 'reader_metadata_not_public');
    assert.equal(f.calls.length, 1);
    const call = f.events.find(row => row.type === 'read_call_result');
    assert.equal(call.status, 'unavailable');
    assert.equal(call.reason, 'reader_metadata_not_public');
    assert.equal(Object.hasOwn(call, 'reader_metadata'), false);
    assert.equal(Object.hasOwn(f.events.at(-1), 'reader_metadata'), false);
    assert.equal(JSON.stringify(f.events).includes('never-publish'), false);
    assert.equal(JSON.stringify(f.events).includes('ghp_'), false);
    f.events.forEach(event => assertPublicValue(event));
  });
}

test('a journal using the parent public-value gate receives only a sanitized metadata failure', async () => {
  const events = [];
  const f = fixture({ readFile: () => ({ text: TEXT, metadata: { api_key: 'private' } }), journal: { append(event) {
    assertPublicValue(event);
    events.push(structuredClone(event));
  } } });
  unavailable(await read(f), 'reader_metadata_not_public');
  assert.equal(events.at(-1).reason, 'reader_metadata_not_public');
  assert.equal(events.at(-1).native_calls, 1);
});

test('oversized encoded reader metadata is unavailable rather than silently truncated or published', async () => {
  const f = fixture({ readFile: () => ({ text: TEXT, metadata: { native_response: 'x'.repeat(4 * 1024 * 1024) } }) });
  unavailable(await read(f), 'reader_metadata_too_large');
  assert.equal(f.calls.length, 1);
  assert.ok(JSON.stringify(f.events).length < 10000);
  assert.equal(f.events.at(-1).reader_metadata, undefined);
});

for (const metadata of [null, [], 'not an object']) {
  test(`non-object reader metadata is unavailable: ${JSON.stringify(metadata)}`, async () => {
    const f = fixture({ readFile: () => ({ text: TEXT, metadata }) });
    unavailable(await read(f), 'invalid_reader_metadata');
    assert.equal(f.events.at(-1).reader_metadata, undefined);
  });
}

test('rejected source and asset arguments are not copied into the public journal', async () => {
  const secret = 'private-scoring-canary-never-publish';
  const f = fixture();
  const results = [await read(f, { repository: BENCH, path: `/Users/${secret}/answers.json` }),
    await inspect(f, { repository: `${secret}/repo`, path: PATH }),
    await inspectAsset(f, { repository: BENCH, asset_name: `${secret}.json` })];
  assert.ok(results.every(row => row.status === 'unavailable'));
  assert.equal(f.calls.length, 0);
  assert.equal(JSON.stringify({ results, events: f.events }).includes(secret), false);
  assert.ok(f.events.every(row => row.native_calls === 0 && row.status === 'unavailable'));
});

for (const metadata of [{ repository: SPEC }, { path: 'scoring.json' }, { ref: 'b'.repeat(40) }]) {
  test(`rejects mismatched file metadata ${JSON.stringify(metadata)}`, async () => {
    const f = fixture({ readFile: () => ({ text: TEXT, metadata }) });
    unavailable(await read(f), 'file_binding_mismatch');
  });
}

test('inspects only the fixed public release and permits its prerelease flag', async () => {
  const f = fixture();
  const result = await inspectRelease(f);
  assert.equal(result.status, 'ok');
  assert.equal(result.id, 42);
  assert.equal(result.tag, TAG);
  assert.equal(result.html_url, releaseUrl());
  assert.equal(result.source_url, releaseUrl());
  assert.equal(result.prerelease, true);
  assert.deepEqual(result.assets, [{ name: 'manuscript.pdf', size: PDF.length, url: assetUrl(), digest: `sha256:${sha(PDF)}` }]);
  assert.deepEqual(f.calls, [{ lane: 'sdk', method: 'readRelease', arguments: { owner: 'OndCo', repo: 'Action-Effect-Bench', tag: TAG } }]);
});

for (const args of [{ repository: BENCH, tag: 'other' }, { repository: BENCH, url: 'https://example.invalid' }, {}]) {
  test(`release input cannot choose a tag or URL: ${JSON.stringify(args)}`, async () => {
    const f = fixture();
    unavailable(await inspectRelease(f, args), 'invalid_arguments');
    assert.equal(f.calls.length, 0);
  });
}

test('release reads cannot select a repository absent from this task sources', async () => {
  const f = fixture({ task: task({ sources: [{ repository: BENCH, path: PATH, ref: REF }] }) });
  unavailable(await inspectRelease(f, { repository: SPEC }), 'repository_not_allowed');
  unavailable(await inspectAsset(f, { repository: SPEC, asset_name: 'manuscript.pdf' }), 'repository_not_allowed');
  assert.equal(f.calls.length, 0);
});

for (const change of [{ draft: true }, { draft: undefined }, { tag_name: 'v9' }, { id: 0 }, { id: Number.MAX_SAFE_INTEGER + 1 },
  { html_url: releaseUrl(SPEC) }, { html_url: `${releaseUrl()}?redirect=elsewhere` }, { prerelease: 'true' }, { assets: {} }]) {
  test(`rejects invalid release binding ${JSON.stringify(change)}`, async () => {
    const f = fixture({ readRelease: () => release(change) });
    unavailable(await inspectRelease(f), 'invalid_release');
    assert.equal(f.calls.length, 1);
  });
}

test('asset access requires the explicit parent-controlled T1 capability', async () => {
  for (const allow_release_assets of [false, undefined]) {
    const f = fixture({ task: task({ allow_release_assets }) });
    unavailable(await inspectAsset(f), 'asset_not_allowed');
    assert.equal(f.calls.length, 0);
  }
});

for (const args of [{ repository: BENCH, asset_name: 'answers.json' }, { repository: BENCH, asset_name: '../manuscript.pdf' },
  { repository: BENCH, asset_name: 'manuscript.pdf', url: assetUrl() }, { repository: BENCH, asset_name: 'manuscript.pdf', tag: TAG }]) {
  test(`asset arguments cannot select other files or URLs: ${JSON.stringify(args)}`, async () => {
    const f = fixture();
    const result = await inspectAsset(f, args);
    assert.equal(result.status, 'unavailable');
    assert.equal(f.calls.length, 0);
  });
}

test('hashes an existing allowed release asset through the selected facade without publishing binary data', async () => {
  const f = fixture({ task: task({ lane: 'mcp' }) });
  const result = await inspectAsset(f);
  assert.equal(result.status, 'ok');
  assert.equal(result.asset_name, 'manuscript.pdf');
  assert.equal(result.bytes, PDF.length);
  assert.equal(result.sha256, sha(PDF));
  assert.equal(result.source_url, assetUrl());
  assert.deepEqual(f.calls.map(row => [row.lane, row.method]), [['mcp', 'readRelease'], ['mcp', 'readAsset']]);
  assert.deepEqual(f.calls[1].arguments, { url: assetUrl() });
  const event = f.events.at(-1);
  assert.deepEqual(event.call_counts, { readFile: 0, readRelease: 1, readAsset: 1 });
  assert.equal(event.native_calls, 2);
  assert.equal(event.result.bytes, PDF.length);
  assert.equal(event.source_url, assetUrl());
  assert.equal(Object.hasOwn(event, 'content_base64'), false);
  assert.ok(JSON.stringify({ result, events: f.events }).length < 10000);
});

test('missing and duplicate allowed assets fail before any download', async () => {
  for (const assets of [[], [release().assets[0], release().assets[0]]]) {
    const f = fixture({ readRelease: () => release({ assets }) });
    assert.equal((await inspectAsset(f)).status, 'unavailable');
    assert.deepEqual(f.calls.map(row => row.method), ['readRelease']);
  }
});

for (const url of ['https://example.invalid/manuscript.pdf', `${assetUrl()}?token=secret`, `${assetUrl()}#hash`,
  assetUrl(SPEC), assetUrl().replace('https:', 'http:'), assetUrl().replace('github.com/', 'user:pass@github.com/'),
  assetUrl().replace('github.com/', 'github.com:444/'), assetUrl().replace('/manuscript.pdf', '/%6danuscript.pdf'),
  `${assetUrl()}\n`]) {
  test(`refuses unbound asset URL ${JSON.stringify(url)} before download`, async () => {
    const f = fixture({ readRelease: () => release({ assets: [{ ...release().assets[0], browser_download_url: url }] }) });
    assert.equal((await inspectAsset(f)).status, 'unavailable');
    assert.deepEqual(f.calls.map(row => row.method), ['readRelease']);
    assert.equal(JSON.stringify(f.events).includes(url), url === assetUrl());
  });
}

test('asset metadata inspection omits all other release assets', async () => {
  const other = { name: 'scoring-canary.json', size: 12, browser_download_url: 'https://example.invalid/secret', digest: null };
  const f = fixture({ readRelease: () => release({ assets: [...release().assets, other] }) });
  assert.deepEqual((await inspectRelease(f)).assets.map(row => row.name), ['manuscript.pdf']);
  assert.equal(JSON.stringify(f.events).includes('scoring-canary'), false);
});

test('missing advertised digest does not fabricate a release checksum match', async () => {
  const f = fixture({ readRelease: () => release({ assets: [{ ...release().assets[0], digest: null }] }) });
  const result = await inspectAsset(f);
  assert.equal(result.status, 'ok');
  assert.equal(result.sha256, sha(PDF));
  assert.equal(result.advertised_digest, null);
  assert.equal(result.digest_matches_release, null);
});

for (const [label, asset, bytes, reason] of [
  ['advertised oversized', { size: MAX_INSPECT + 1 }, PDF, 'asset_too_large'],
  ['actual oversized', {}, Buffer.alloc(MAX_INSPECT + 1), 'asset_too_large'],
  ['size mismatch', { size: PDF.length + 1 }, PDF, 'asset_size_mismatch'],
  ['digest mismatch', { digest: `sha256:${'0'.repeat(64)}` }, PDF, 'asset_digest_mismatch'],
  ['non-Buffer', {}, '%PDF-text', 'invalid_asset_result'],
]) {
  test(`rejects ${label} asset`, async () => {
    const f = fixture({ readRelease: () => release({ assets: [{ ...release().assets[0], ...asset }] }), readAsset: () => bytes });
    unavailable(await inspectAsset(f), reason);
    assert.equal(f.calls.filter(row => row.method === 'readAsset').length, label === 'advertised oversized' ? 0 : 1);
    assert.ok(JSON.stringify(f.events).length < 10000);
  });
}

test('allowed asset at exactly 2 MiB is hashed but never returned to the model as bytes', async () => {
  const bytes = Buffer.alloc(MAX_INSPECT, 65);
  const f = fixture({ readAsset: () => bytes,
    readRelease: () => release({ assets: [{ ...release().assets[0], size: bytes.length, digest: `sha256:${sha(bytes)}` }] }) });
  const result = await inspectAsset(f);
  assert.equal(result.status, 'ok');
  assert.equal(result.bytes, MAX_INSPECT);
  assert.equal(result.sha256, sha(bytes));
  assert.ok(JSON.stringify({ result, events: f.events }).length < 10000);
});

test('asset facade errors are unavailable and are not automatically retried', async () => {
  const f = fixture({ readAsset: () => { throw new Error('secret transport failure'); } });
  unavailable(await inspectAsset(f), 'reader_unavailable');
  assert.deepEqual(f.calls.map(row => row.method), ['readRelease', 'readAsset']);
  assert.equal(JSON.stringify(f.events).includes('secret transport'), false);
});

for (const [label, fetchImpl, expectedFetches] of [
  ['external redirect', async () => new Response(null, { status: 302, headers: { location: 'https://example.invalid/private' } }), 1],
  ['redirect cycle', async () => new Response(null, { status: 302, headers: { location: assetUrl() } }), 4],
]) {
  test(`actual public-asset facade bounds ${label} without any network`, async () => {
    let fetches = 0;
    const f = fixture({ readAsset: ({ url }) => readPublicAsset({ url, fetchImpl: async (...args) => { fetches += 1; return fetchImpl(...args); } }) });
    unavailable(await inspectAsset(f), 'reader_unavailable');
    assert.equal(fetches, expectedFetches);
    assert.equal(f.calls.filter(row => row.method === 'readAsset').length, 1);
  });
}

test('actual public-asset facade follows a bounded official CDN redirect without sending credentials', async () => {
  const requests = [];
  const f = fixture({ readAsset: ({ url }) => readPublicAsset({ url, fetchImpl: async (current, options) => {
    requests.push({ current, options });
    return requests.length === 1 ? new Response(null, { status: 302,
      headers: { location: 'https://release-assets.githubusercontent.com/public-fixture' } }) : new Response(PDF);
  } }) });
  assert.equal((await inspectAsset(f)).sha256, sha(PDF));
  assert.equal(requests.length, 2);
  assert.ok(requests.every(row => row.options.redirect === 'manual' && !Object.hasOwn(row.options.headers, 'Authorization')));
});

const JOURNAL_SECRET = 'private-journal-path-and-credential';

function isJournalError(error) {
  assert.equal(error?.code, 'FIELD_STUDY_JOURNAL_ERROR');
  assert.equal(error.message, 'journal_error');
  assert.equal(error.name, 'FieldStudyJournalError');
  assert.ok(error instanceof FieldStudyJournalError);
  assert.equal(Object.hasOwn(error, 'cause'), false);
  assert.equal(JSON.stringify(error).includes(JOURNAL_SECRET), false);
  assert.equal(String(error.stack).includes(JOURNAL_SECRET), false);
  return true;
}

test('exports a sanitized journal error with the agent-loop failure code', () => {
  assert.equal(typeof FieldStudyJournalError, 'function');
  isJournalError(new FieldStudyJournalError(JOURNAL_SECRET, { cause: new Error(JOURNAL_SECRET) }));
});

for (const cut of [
  { label: 'pre-call', type: 'read_call_start', status: 'started', appends: 1, calls: 0 },
  { label: 'post-native-result', type: 'read_call_result', status: 'ok', appends: 2, calls: 1 },
  { label: 'success-result', type: 'read_tool_result', status: 'ok', appends: 3, calls: 1 },
  { label: 'native-failure-result', type: 'read_tool_result', status: 'unavailable', appends: 3, calls: 1, nativeFails: true },
  { label: 'argument-failure-result', type: 'read_tool_result', status: 'unavailable', appends: 1, calls: 0, invalid: true },
]) {
  for (const asynchronous of [false, true]) {
    for (const persistedBeforeThrow of [false, true]) {
      test(`${cut.label} intermittent ${asynchronous ? 'async' : 'sync'} journal failure stops all tools (${persistedBeforeThrow ? 'possibly persisted' : 'not persisted'})`, async () => {
        const attempts = [], persisted = [];
        let failed = false;
        const f = fixture({ readFile: () => {
          if (cut.nativeFails) throw new Error('provider_read_failure_503');
          return { text: TEXT };
        }, journal: { append(event) {
          attempts.push(structuredClone(event));
          if (!failed && event.type === cut.type && event.status === cut.status) {
            failed = true;
            if (persistedBeforeThrow) persisted.push(structuredClone(event));
            const error = new Error(JOURNAL_SECRET, { cause: new Error(JOURNAL_SECRET) });
            error.code = 'EIO';
            if (asynchronous) return Promise.reject(error);
            throw error;
          }
          persisted.push(structuredClone(event));
          if (asynchronous) return Promise.resolve();
        } } });
        const args = cut.invalid ? { repository: BENCH, path: 'not-allowed.md' } : undefined;
        await assert.rejects(read(f, args), isJournalError);
        assert.equal(failed, true);
        assert.equal(attempts.length, cut.appends, 'must not try to journal another outcome after a failed append');
        assert.equal(persisted.length, cut.appends - (persistedBeforeThrow ? 0 : 1));
        assert.equal(f.calls.length, cut.calls);
        for (const next of [read, inspect, inspectRelease, inspectAsset]) await assert.rejects(next(f), isJournalError);
        assert.equal(attempts.length, cut.appends, 'intermittent recovery must not reopen this journal session');
        assert.equal(f.calls.length, cut.calls, 'all native methods must stop after the first journal failure');
        assert.equal(JSON.stringify({ attempts, persisted }).includes(JOURNAL_SECRET), false);
      });
    }
  }
}

test('journal failure after release lookup prevents the next native asset call', async () => {
  const attempts = [];
  let failed = false;
  const f = fixture({ journal: { append(event) {
    attempts.push(event);
    if (!failed && event.type === 'read_call_result') {
      failed = true;
      throw new Error(JOURNAL_SECRET);
    }
  } } });
  await assert.rejects(inspectAsset(f), isJournalError);
  assert.deepEqual(f.calls.map(call => call.method), ['readRelease']);
  assert.equal(attempts.length, 2);
});

test('a pending pre-call append cannot dispatch after another tool poisons the journal', async () => {
  const attempts = [];
  let resume;
  const f = fixture({ journal: { append(event) {
    attempts.push(event);
    if (attempts.length === 1) return new Promise(resolve => { resume = resolve; });
    if (attempts.length === 2) throw new Error(JOURNAL_SECRET);
  } } });
  const settled = promise => promise.then(value => ({ value }), error => ({ error }));
  const pending = settled(read(f));
  const other = await settled(inspectRelease(f));
  resume();
  const first = await pending;
  isJournalError(other.error);
  isJournalError(first.error);
  assert.equal(f.calls.length, 0);
  assert.equal(attempts.length, 2);
});

test('an intermittent native network failure stays unavailable without poisoning a healthy journal', async () => {
  let nativeCalls = 0;
  const f = fixture({ readFile: () => {
    if (++nativeCalls === 1) throw new Error('provider_read_failure_503');
    return { text: TEXT };
  } });
  unavailable(await read(f), 'reader_unavailable');
  assert.equal(f.events.at(-1).native_reason, 'provider_read_failure_503');
  assert.equal((await read(f)).status, 'ok');
  assert.equal(f.calls.length, 2);
  assert.equal(f.events.length, 6);
});

for (const invalid of [undefined, null, task({ lane: 'native-or-shell' }), task({ lane: undefined }),
  task({ sources: [] }), task({ allow_release_assets: 'true' }),
  task({ sources: [{ repository: 'Other/Action-Effect-Bench', path: PATH, ref: REF }] }),
  task({ sources: [{ repository: BENCH, path: PATH, ref: 'main' }] }),
  task({ sources: [{ repository: BENCH, path: PATH, ref: `${REF}\n` }] }),
  task({ sources: [{ repository: BENCH, path: '/Users/private/answers', ref: REF }] }),
  task({ sources: [{ repository: BENCH, path: 'docs/', ref: REF }] }),
  task({ sources: [{ repository: BENCH, path: '../answers', ref: REF }] }),
  task({ sources: [{ repository: BENCH, path: PATH, ref: REF }, { repository: BENCH, path: PATH, ref: 'b'.repeat(40) }] }),
]) {
  test(`invalid task configuration is rejected before transport: ${JSON.stringify(invalid)}`, () => {
    assert.throws(() => factory({ task: invalid, sdk: {}, mcp: {}, journal: { append() {} } }), { message: 'invalid_task' });
  });
}

test('requires the selected reader and append-only journal rather than silently degrading', () => {
  assert.throws(() => factory({ task: task(), sdk: null, mcp: {}, journal: { append() {} } }), { message: 'invalid_reader' });
  assert.throws(() => factory({ task: task(), sdk: { readFile() {}, readRelease() {}, readAsset() {} } }), { message: 'invalid_journal' });
});

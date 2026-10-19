import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeReader } from '../native-reader.mjs';

const params = { owner: 'OndCo', repo: 'Action-Effect-Bench', path: 'README.md', ref: 'a'.repeat(40) };
const uri = `repo://OndCo/Action-Effect-Bench/sha/${params.ref}/contents/README.md`;
const file = { content: [{ type: 'resource', resource: { uri, text: 'exact\n', mimeType: 'text/plain; charset=utf-8' } }] };

test('native reader sends pinned native SHA and verifies the actual resource identity', async () => {
  const calls = [];
  const reader = createNativeReader({ session: { call: async (name, args) => { calls.push({ name, args }); return file; } } });
  const result = await reader.readFile(params);
  assert.equal(result.text, 'exact\n');
  assert.equal(calls[0].name, 'get_file_contents');
  assert.equal(calls[0].args.sha, params.ref);
  assert.equal(result.metadata.resource_uri, uri);
});

test('wrong native URI and provider errors cannot become a successful SDK fallback', async () => {
  const reader = createNativeReader({ session: { call: async () => ({ content: [{ type: 'resource', resource: { uri: uri.replace('README', 'OTHER'), text: 'wrong' } }] }) } });
  await assert.rejects(reader.readFile(params), /mcp_invalid_file_result/);
});

test('release result requires the selected public tag and correct repository URL', async () => {
  const release = { tag_name: 'v0.2.0-draft.1', draft: false, html_url: 'https://github.com/OndCo/Action-Effect-Bench/releases/tag/v0.2.0-draft.1' };
  const reader = createNativeReader({ session: { call: async () => ({ content: [{ type: 'text', text: JSON.stringify(release) }] }) } });
  assert.equal((await reader.readRelease({ owner: 'OndCo', repo: 'Action-Effect-Bench', tag: release.tag_name })).tag_name, release.tag_name);
  release.draft = true;
  await assert.rejects(reader.readRelease({ owner: 'OndCo', repo: 'Action-Effect-Bench', tag: release.tag_name }), /release_binding/);
});

test('unconfigured provider targets and assets do not issue native calls', async () => {
  let calls = 0;
  const reader = createNativeReader({ session: { call: async () => { calls++; } } });
  await assert.rejects(reader.readFile({ ...params, owner: 'other' }), /reader_scope/);
  await assert.rejects(reader.readAsset({ url: 'https://example.invalid' }), /native_asset_unsupported/);
  assert.equal(calls, 0);
});

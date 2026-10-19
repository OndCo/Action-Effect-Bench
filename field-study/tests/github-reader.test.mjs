import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubReader, readPublicAsset } from '../github-reader.mjs';

const params = { owner: 'OndCo', repo: 'Action-Effect-Bench', path: 'README.md', ref: 'a'.repeat(40) };
const payload = { type: 'file', path: params.path, encoding: 'base64', content: Buffer.from('actual\n').toString('base64'), sha: 'b'.repeat(40), html_url: 'https://github.com/OndCo/Action-Effect-Bench' };

test('SDK file reader decodes exact bytes and records the native request', async () => {
  const calls = [];
  const reader = createGithubReader({ request: async (route, args) => { calls.push({ route, args }); return { data: payload }; } });
  const result = await reader.readFile(params);
  assert.equal(result.text, 'actual\n');
  assert.equal(result.metadata.git_blob_sha, payload.sha);
  assert.equal(calls[0].args.ref, params.ref);
});

for (const data of [[], { ...payload, path: 'other' }, { ...payload, content: '***' }, { ...payload, content: '/w==' }]) {
  test('rejects non-file, rewritten, invalid-base64 or non-UTF8 provider output', async () => {
    const reader = createGithubReader({ request: async () => ({ data }) });
    await assert.rejects(reader.readFile(params), /invalid_file/);
  });
}

test('reader rejects unowned repository and mutable source before request', async () => {
  let calls = 0;
  const reader = createGithubReader({ request: async () => { calls++; } });
  await assert.rejects(reader.readFile({ ...params, owner: 'other' }), /scope/);
  await assert.rejects(reader.readFile({ ...params, ref: 'main' }), /scope/);
  assert.equal(calls, 0);
});

test('provider failure makes exactly one SDK request', async () => {
  let calls = 0;
  const reader = createGithubReader({ request: async () => { calls++; throw new Error('provider'); } });
  await assert.rejects(reader.readFile(params), /provider_read_failure/);
  assert.equal(calls, 1);
});

test('release lookup is pinned and rejects drafts and tag rewrites', async () => {
  const reader = createGithubReader({ request: async () => ({ data: { tag_name: 'other', draft: false } }) });
  await assert.rejects(reader.readRelease({ owner: 'OndCo', repo: 'Action-Effect-Bench', tag: 'v0.2.0-draft.1' }), /release_binding/);
});

test('public asset does not send credentials and checks each redirect target', async () => {
  const calls = [];
  const bytes = await readPublicAsset({ url: 'https://github.com/OndCo/Action-Effect-Bench/releases/download/v0.2.0-draft.1/manuscript.pdf', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response('pdf', { status: 200 });
  } });
  assert.equal(bytes.toString(), 'pdf');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  await assert.rejects(readPublicAsset({ url: 'https://github.com/OndCo/Action-Effect-Bench/releases/download/v0.2.0-draft.1/manuscript.pdf', fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://attacker.example/secret' } }) }), /asset_redirect/);
});

test('asset size cap applies even when Content-Length is absent', async () => {
  await assert.rejects(readPublicAsset({ url: 'https://github.com/OndCo/Action-Effect-Bench/releases/download/v0.2.0-draft.1/manuscript.pdf', maxBytes: 2, fetchImpl: async () => new Response('large') }), /asset_size/);
});

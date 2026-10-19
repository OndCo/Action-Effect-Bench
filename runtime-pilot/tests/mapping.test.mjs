import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mapNative, makeDescription, profile } from '../mapping.mjs';

const context = { principal: 'fixture-user', data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' };
const params = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 1, body: 'test' };
const sdk = call => ({ lane: 'sdk', call });
const mcp = call => ({ lane: 'mcp', call: { name: 'add_issue_comment', arguments: call } });

test('native lanes share semantic projection, but concrete invocation digests differ', () => {
  const a = mapNative(sdk(params), context), b = mapNative(mcp(params), context);
  assert.equal(a.status, 'accepted_partial');
  assert.deepEqual(a.projection, b.projection);
  assert.equal(a.authority, 'not_evaluated');
  assert.notEqual(a.description.invocation.digest.value, b.description.invocation.digest.value);
});

test('body byte length and digest preserve Unicode without normalization', () => {
  const body = 'tap \u{1F3AB} e\u0301';
  const { projection } = mapNative(sdk({ ...params, body }), context);
  assert.equal(projection.body_bytes, Buffer.byteLength(body));
  assert.equal(projection.body_sha256, createHash('sha256').update(body).digest('hex'));
});

test('malformed or executable extra parameters never disappear during mapping', () => {
  for (const call of [{ ...params, url: 'https://example.org' }, { ...params, issue_number: true },
    { ...params, owner: '../target' }, { ...params, repo: '..' }, { ...params, body: '' },
    { ...params, body: '\ud800' }, { ...params, body: 'x'.repeat(8193) }]) {
    assert.equal(mapNative(sdk(call), context).status, 'invalid_input');
  }
});

test('unknown operation and missing/changed implementation stay distinct', () => {
  assert.equal(mapNative({ lane: 'mcp', call: { name: 'delete_issue', arguments: params } }, context).reason, 'operation');
  assert.equal(mapNative(sdk(params), {}).reason, 'missing_context');
  assert.equal(mapNative(sdk(params), { ...context, implementation: 'other/2' }).reason, 'implementation_binding');
});

test('terminal newlines cannot pass ASCII owner and repository patterns', () => {
  for (const lane of [sdk, mcp]) for (const field of ['owner', 'repo']) {
    assert.equal(mapNative(lane({ ...params, [field]: `${params[field]}\n` }), context).status, 'invalid_input');
  }
});

test('partial declaration cannot omit unknown provider descendants', () => {
  const d = makeDescription(sdk(params), context);
  assert.equal(d.coverage.completeness, 'partial');
  assert.equal(d.effects[0].modality, 'may');
  assert.deepEqual(d.critical_extensions, [profile.body_digest_extension]);
  assert.deepEqual(d.unknowns, [{ code: 'unobserved_descendants', scope: profile.unknown_scope }]);
});

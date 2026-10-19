import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digestBytes, assertPublicValue, createJournal, saveArtifact, verifyJournal } from '../artifacts.mjs';

function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'ae-field-artifact-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('hashes exact bytes, not parsed JSON values', () => {
  assert.notEqual(digestBytes('{}'), digestBytes('{}\n'));
  assert.equal(digestBytes('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

for (const key of ['api_key', 'access_token', 'authorization', 'encrypted_content', 'refresh_token']) {
  test(`does not persist secret-bearing key ${key}`, () => {
    assert.throws(() => assertPublicValue({ nested: [{ [key]: 'sensitive' }] }), /private_field/);
  });
}

test('rejects credential-shaped values without blocking token usage counters', () => {
  assert.throws(() => assertPublicValue({ text: `gho_${'a'.repeat(36)}` }), /credential_value/);
  assert.doesNotThrow(() => assertPublicValue({ usage: { input_tokens: 20, output_tokens: 3 } }));
});

test('journal is append-only and seals an ordered hash chain', t => {
  const root = temporary(t), journal = createJournal(root, 'test-run', { source: 'fixture' });
  journal.append({ type: 'tool_result', tool: 'read_release', status: 'observed' });
  const sealed = journal.seal({ status: 'completed' });
  const verified = verifyJournal(readFileSync(sealed.path));
  assert.equal(verified.valid, true);
  assert.equal(verified.complete, true);
  assert.equal(verified.records, 3);
  assert.equal(sealed.sha256, digestBytes(readFileSync(sealed.path)));
  assert.throws(() => journal.append({ type: 'late' }), /journal_sealed/);
  assert.throws(() => createJournal(root, 'test-run', {}), /EEXIST/);
});

test('incomplete journal remains incomplete rather than acquiring a success result', t => {
  const root = temporary(t), journal = createJournal(root, 'interrupted', {});
  journal.append({ type: 'model_started' });
  const result = verifyJournal(readFileSync(journal.path));
  assert.equal(result.valid, true);
  assert.equal(result.complete, false);
  assert.equal(result.records, 2);
});

test('journal detects changed content, missing middle record and reordered records', t => {
  const root = temporary(t), journal = createJournal(root, 'tamper', {});
  journal.append({ type: 'tool', status: 'failed' });
  const final = journal.seal({ status: 'failed' });
  const original = readFileSync(final.path, 'utf8'), lines = original.trimEnd().split('\n');
  assert.equal(verifyJournal(Buffer.from(original.replace('failed', 'passed'))).valid, false);
  assert.equal(verifyJournal(Buffer.from(`${lines[0]}\n${lines[2]}\n`)).valid, false);
  assert.equal(verifyJournal(Buffer.from(`${lines[1]}\n${lines[0]}\n${lines[2]}\n`)).valid, false);
});

test('journal rejects unjournalable values before writing a partial event', t => {
  const root = temporary(t), journal = createJournal(root, 'sensitive', {});
  const before = readFileSync(journal.path);
  assert.throws(() => journal.append({ type: 'model', raw: { encrypted_content: 'hidden' } }), /private_field/);
  assert.deepEqual(readFileSync(journal.path), before);
});

test('journal rejects non-finite values and unsafe run names', t => {
  const root = temporary(t);
  assert.throws(() => createJournal(root, '../escape', {}), /invalid_run_id/);
  assert.throws(() => assertPublicValue({ time: NaN }), /non_finite/);
  assert.throws(() => assertPublicValue({ time: Infinity }), /non_finite/);
});

test('writes immutable report bytes and matching sidecar without touching other files', t => {
  const root = temporary(t);
  const artifact = saveArtifact(root, 'field-use', { kind: 'fixture', elapsed_ms: 1.5 });
  assert.equal(JSON.parse(readFileSync(artifact.path)).elapsed_ms, 1.5);
  assert.equal(artifact.sha256, digestBytes(readFileSync(artifact.path)));
  assert.equal(readdirSync(root).length, 2);
  assert.match(readFileSync(`${artifact.path}.sha256`, 'utf8'), new RegExp(`^${artifact.sha256}  `));
});

test('invalid artifact content creates no public evidence file', t => {
  const root = temporary(t);
  assert.throws(() => saveArtifact(root, 'field-use', { access_token: 'no' }), /private_field/);
  assert.equal(readdirSync(root).length, 0);
});

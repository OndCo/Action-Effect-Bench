import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { digestBytes } from '../artifacts.mjs';
import * as state from '../write-artifacts.mjs';

const root = () => mkdtempSync(join(tmpdir(), 'action-effect-owned-state-'));
const scenario = { context: { principal: 'maintainer', data_class: 'synthetic-public' },
  native: { lane: 'sdk', call: { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2, body: 'example' } } };

test('owned state is exclusive and checked by exact bytes', () => {
  const dir = root(), path = state.writeState(dir, 'manifest.json', { value: 1 });
  const bytes = readFileSync(path);
  assert.deepEqual(state.readState(path, digestBytes(bytes)).value, { value: 1 });
  assert.throws(() => state.writeState(dir, 'manifest.json', { value: 2 }), /state_exists/);
  assert.throws(() => state.readState(path, '0'.repeat(64)), /state_hash/);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { value: 1 });
});

for (const name of ['../outside.json', '/tmp/outside.json', '.hidden', 'a/b.json', 'x\n.json', 'x.json\n']) {
  test(`owned state rejects unsafe file name ${JSON.stringify(name)}`, () => {
    assert.throws(() => state.writeState(root(), name, {}), /state_name/);
  });
}

test('state does not persist credentials or unsupported values', () => {
  const dir = root();
  assert.throws(() => state.writeState(dir, 'key.json', { api_key: 'secret' }), /private_field/);
  assert.throws(() => state.writeState(dir, 'value.json', { value: Infinity }), /non_finite/);
  assert.equal(readdirSync(dir).length, 0);
});

test('state reads reject symbolic links and oversized or malformed input', () => {
  const dir = root(), path = join(dir, 'data.json');
  writeFileSync(path, '{}');
  symlinkSync(path, join(dir, 'link.json'));
  assert.throws(() => state.readState(join(dir, 'link.json')), /state_file/);
  assert.throws(() => state.readState(path, undefined, 1), /state_size/);
  writeFileSync(path, '{broken');
  assert.throws(() => state.readState(path), /state_json/);
});

test('atomic policy replacement preserves a readable whole document', () => {
  const dir = root();
  state.writeState(dir, 'policy.json', { revision: 1 });
  const path = state.replaceState(dir, 'policy.json', { revision: 2 });
  assert.deepEqual(state.readState(path).value, { revision: 2 });
  assert.deepEqual(readdirSync(dir), ['policy.json']);
});

test('a mutation permit is durable and cannot be granted twice for one occurrence', () => {
  const dir = root();
  const first = state.claimWritePermit(dir, 'run-a', 'occurrence-a');
  assert.equal(first.slot, 0);
  assert.equal(first.maximum, 12);
  assert.throws(() => state.claimWritePermit(dir, 'run-a', 'occurrence-a'), /occurrence_permit_exists/);
  assert.equal(state.readWritePermits(dir).length, 1);
});

test('the thirteenth application mutation permit is refused without refunding slots', () => {
  const dir = root();
  for (let i = 0; i < 12; i++) assert.equal(state.claimWritePermit(dir, 'run-a', `case-${i}`).slot, i);
  assert.throws(() => state.claimWritePermit(dir, 'run-a', 'case-12'), /write_ceiling/);
  assert.equal(state.readWritePermits(dir).length, 12);
  assert.throws(() => state.claimWritePermit(dir, 'run-a', 'case-12'), /occurrence_permit_exists/);
});

test('a partial slot remains occupied rather than authorizing another attempt', () => {
  const dir = root();
  writeFileSync(join(dir, 'slot-00.json'), '{');
  assert.equal(state.claimWritePermit(dir, 'run-a', 'next').slot, 1);
  assert.throws(() => state.readWritePermits(dir), /state_json/);
});

for (const id of ['', '../outside', 'line\nfeed', 'trailing\n', 'x'.repeat(121)]) {
  test(`permit refuses unsafe occurrence ${JSON.stringify(id)}`, () => {
    assert.throws(() => state.claimWritePermit(root(), 'run-a', id), /state_identifier/);
  });
}

test('current policies retain one coupled target and distinguish revoke/narrow', () => {
  const initial = state.scenarioPolicy(scenario, 'initial');
  assert.equal(initial.max_body_bytes, 8192);
  assert.equal(initial.revoked, false);
  assert.deepEqual(initial.grants, [{ repository: 'OndCo/Action-Effect-Bench', issue_number: 2, data_class: 'synthetic-public' }]);
  assert.equal(state.scenarioPolicy(scenario, 'revoked').revoked, true);
  assert.equal(state.scenarioPolicy(scenario, 'narrowed').max_body_bytes, 1);
  assert.throws(() => state.scenarioPolicy(scenario, 'relaxed'), /policy_variant/);
});

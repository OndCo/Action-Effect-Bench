import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { digestBytes } from '../artifacts.mjs';
import * as provenance from '../provenance.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const evidenceCommit = 'eff7bf6bee237162a7f321bbb131008f880346fb';
const sourceCommit = 'bc1d389a474c37a9c38b2b5acedbd7bb65650225';
const reportName = 'reports/field-study-use-2026-10-19T06-33-57.736Z-0e238334.json';
const git = object => execFileSync('git', ['cat-file', 'blob', object], {
  cwd: root, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1' },
});
const original = JSON.parse(git(`${evidenceCommit}:${reportName}`)).provenance;

function load(value = original) {
  assert.equal(typeof provenance.loadRecordedSources, 'function', 'recorded source loader must be exported');
  return provenance.loadRecordedSources(value);
}

test('loads historical inputs from recorded commits, not the changing checkout', () => {
  const source = load();
  assert.equal(source.mode, 'recorded-git');
  assert.equal(source.revisions.bench, sourceCommit);
  const bytes = source.read('bench/field-study/tasks.json');
  assert.deepEqual(bytes, git(`${sourceCommit}:field-study/tasks.json`));
  assert.equal(JSON.parse(bytes).version, 1);
  assert.equal(digestBytes(bytes), original.field_sources.find(row => row.path.endsWith('/tasks.json')).sha256);
});

test('dirty documentation metadata does not invalidate matching committed experiment bytes', () => {
  const value = structuredClone(original);
  value.environment.repositories.bench.dirty = true;
  assert.equal(load(value).mode, 'recorded-git');
});

for (const [label, change] of [
  ['mutable revision', p => { p.environment.repositories.bench.head = 'HEAD'; }],
  ['revision syntax', p => { p.environment.repositories.bench.head = `${sourceCommit}:field-study/tasks.json`; }],
  ['unavailable revision', p => { p.environment.repositories.bench.head = '0'.repeat(40); }],
  ['wrong repository revision', p => { p.environment.repositories.spec.head = sourceCommit; }],
  ['changed digest', p => { p.field_sources[0].sha256 = '0'.repeat(64); }],
  ['omitted field source', p => { p.field_sources.shift(); }],
  ['omitted preserved source', p => { p.preserved_runtime_sources.pop(); }],
  ['duplicate source', p => { p.field_sources.push(p.field_sources[0]); }],
  ['reordered source inventory', p => { p.field_sources.reverse(); }],
  ['source traversal', p => { p.field_sources[0].path = 'bench/../outside.mjs'; }],
  ['uncommitted extra source', p => { p.field_sources.push({ path: 'bench/field-study/unrecorded.mjs', sha256: 'a'.repeat(64) }); }],
]) {
  test(`historical provenance rejects ${label} without consulting another revision`, () => {
    const value = structuredClone(original);
    change(value);
    assert.throws(() => load(value), /^Error: source_(?:revision|inventory|provenance)/);
  });
}

test('recorded source reads cannot escape the verified inventory', () => {
  const source = load();
  for (const path of ['../outside', 'bench/.git/config', 'spec/../../outside', 'bench/field-study/.tools/github-mcp-server']) {
    assert.throws(() => source.read(path), /^Error: source_path/);
  }
});

test('mutating a returned blob cannot corrupt later historical verification', () => {
  const source = load(), path = 'bench/field-study/tools.json';
  const bytes = source.read(path), before = digestBytes(bytes);
  bytes.fill(0);
  assert.equal(digestBytes(source.read(path)), before);
  assert.equal(digestBytes(load().read(path)), before);
});

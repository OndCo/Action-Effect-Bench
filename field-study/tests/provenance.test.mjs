import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fieldInventory, sameInventory } from '../provenance.mjs';

function temp(t) {
  const root = mkdtempSync(join(tmpdir(), 'ae-field-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('source inventory binds code, task goals, criteria and tool configuration', t => {
  const root = temp(t);
  for (const name of ['run.mjs', 'tasks.json', 'criteria.json', 'tools.json']) writeFileSync(join(root, name), '{}');
  const snapshot = fieldInventory(root);
  assert.equal(snapshot.length, 4);
  assert.equal(sameInventory(snapshot, fieldInventory(root)), true);
  writeFileSync(join(root, 'tasks.json'), '{"changed":true}');
  assert.equal(sameInventory(snapshot, fieldInventory(root)), false);
});

test('addition, omission and reordering cannot satisfy source inventory equality', t => {
  const root = temp(t);
  writeFileSync(join(root, 'a.mjs'), 'a');
  writeFileSync(join(root, 'b.mjs'), 'b');
  const snapshot = fieldInventory(root);
  assert.equal(sameInventory(snapshot, [...snapshot].reverse()), false);
  assert.equal(sameInventory(snapshot, snapshot.slice(1)), false);
  writeFileSync(join(root, 'c.mjs'), 'c');
  assert.equal(sameInventory(snapshot, fieldInventory(root)), false);
});

test('temporary runtime data and tests do not rewrite the measured source identity', t => {
  const root = temp(t);
  writeFileSync(join(root, 'run.mjs'), 'run');
  const before = fieldInventory(root);
  for (const dir of ['.tools', '.runtime-private', 'tests', 'node_modules']) {
    mkdirSync(join(root, dir));
    writeFileSync(join(root, dir, 'x.json'), '{}');
  }
  writeFileSync(join(root, 'source-lock.json'), '{}');
  assert.deepEqual(fieldInventory(root), before);
});

test('measured source refuses symlinks instead of inventorying outside files', t => {
  const root = temp(t);
  symlinkSync('/etc/hosts', join(root, 'outside.mjs'));
  assert.throws(() => fieldInventory(root), /source_symlink/);
});

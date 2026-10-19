import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digestBytes, environment, saveReport, sourcesMatch, sourceSnapshot, sourceInventoryUnchanged } from '../artifacts.mjs';

test('environment records installed package and pinned executable bytes, not only intended versions', () => {
  const result = environment();
  assert.equal(result.dependencies['@octokit/rest'], '22.0.1');
  assert.equal(result.dependencies['@modelcontextprotocol/sdk'], '1.32.1');
  assert.equal(result.opa_binary.matches_release_pin, true);
  assert.match(result.opa_binary.sha256, /^[a-f0-9]{64}$/);
  assert.ok(result.hardware.logical_cpus > 0);
  assert.ok(result.hardware.memory_bytes > 0);
  assert.equal(result.timezone, 'America/Toronto');
});

test('reports retain failed attempts with detached raw-byte checksum and unique path', () => {
  const root = mkdtempSync(join(tmpdir(), 'effect-report-'));
  try {
    const a = saveReport('failure', { passed: false }, root), b = saveReport('failure', { passed: false }, root);
    assert.notEqual(a, b);
    assert.equal(readFileSync(`${a}.sha256`, 'utf8').split(' ')[0], digestBytes(readFileSync(a)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('replay does not resolve arbitrary paths from a supplied report', () => {
  assert.equal(sourcesMatch([{ path: 'bench/../../outside', sha256: 'a'.repeat(64) }]), false);
});

test('a source-stability claim requires the complete inventory, not just unchanged listed files', () => {
  const snapshot = sourceSnapshot();
  assert.equal(sourceInventoryUnchanged(snapshot), true);
  assert.equal(sourceInventoryUnchanged(snapshot.slice(1)), false);
});

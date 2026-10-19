import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { saveArtifact, digestBytes } from '../artifacts.mjs';
import { readCheckedArtifact, safeChild, auditReadEvidence } from '../replay.mjs';

function temp(t) { const root = mkdtempSync(join(tmpdir(), 'field-replay-')); t.after(() => rmSync(root, { force: true, recursive: true })); return root; }

test('artifact replay checks exact bytes and the detached filename', t => {
  const root = temp(t), artifact = saveArtifact(root, 'fixture', { okay: true });
  assert.equal(readCheckedArtifact(root, basename(artifact.path)).value.okay, true);
  writeFileSync(artifact.path, '{"okay":false}\n');
  assert.throws(() => readCheckedArtifact(root, basename(artifact.path)), /artifact_checksum/);
});

test('artifact references cannot traverse directories or follow symlinks', t => {
  const root = temp(t);
  assert.throws(() => safeChild(root, '../outside.json'), /artifact_path/);
  assert.throws(() => safeChild(root, '/etc/hosts'), /artifact_path/);
  symlinkSync('/etc/hosts', join(root, 'outside.json'));
  assert.throws(() => safeChild(root, 'outside.json'), /artifact_path/);
});

test('reported file digests and retained text must agree with the pre-run reference', () => {
  const text = 'exact\n', sha = digestBytes(text), uri = `https://github.com/OndCo/Action-Effect-Bench/blob/${'a'.repeat(40)}/README.md`;
  const criteria = { sources: [{ repository: 'OndCo/Action-Effect-Bench', path: 'README.md', ref: 'a'.repeat(40), raw_sha256: sha }] };
  const events = [{ type: 'read_tool_result', status: 'ok', tool: 'read_repository_file', source_url: uri, content_base64: Buffer.from(text).toString('base64'), result: { sha256: sha, bytes: 6 } }];
  assert.equal(auditReadEvidence(events, criteria).file_observations, 1);
  events[0].content_base64 = Buffer.from('changed').toString('base64');
  assert.throws(() => auditReadEvidence(events, criteria), /read_evidence/);
});

test('a metadata-only file observation is not claimed as a retained body', () => {
  const ref = 'a'.repeat(40), sha = digestBytes('body');
  const criteria = { sources: [{ repository: 'OndCo/Action-Effect-Bench', path: 'README.md', ref, raw_sha256: sha }] };
  const events = [{ type: 'read_tool_result', status: 'ok', tool: 'inspect_repository_file', source_url: `https://github.com/OndCo/Action-Effect-Bench/blob/${ref}/README.md`, result: { sha256: sha, bytes: 4 } }];
  const result = auditReadEvidence(events, criteria);
  assert.equal(result.file_observations, 1);
  assert.equal(result.retained_text_observations, 0);
});

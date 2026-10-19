import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createJournal, digestBytes } from '../artifacts.mjs';
import * as replay from '../write-replay.mjs';

function journal() {
  const dir = mkdtempSync(join(tmpdir(), 'owned-replay-'));
  const j = createJournal(dir, 'case.execute', { run_id: 'run-a', manifest_sha256: 'a'.repeat(64),
    scenario_id: 'case', mode: 'execute', pid: 200 });
  j.append({ type: 'native_read_response', response: [], response_sha256: digestBytes('[]') });
  j.seal('confirmed');
  const bytes = readFileSync(j.path);
  return { bytes, expected: { file: 'run-a.case.execute.jsonl', sha256: digestBytes(bytes), records: 3, complete: true, valid: true } };
}

test('journal replay verifies raw bytes and the complete event hash chain', () => {
  const f = journal();
  assert.equal(replay.readEvidenceJournal(f.bytes, f.expected).length, 3);
});
for (const mutation of ['byte', 'checksum', 'count', 'completion']) {
  test(`journal replay refuses mismatched ${mutation}`, () => {
    const f = journal();
    if (mutation === 'byte') f.bytes[10] ^= 1;
    if (mutation === 'checksum') f.expected.sha256 = '0'.repeat(64);
    if (mutation === 'count') f.expected.records++;
    if (mutation === 'completion') f.expected.complete = false;
    assert.throws(() => replay.readEvidenceJournal(f.bytes, f.expected), /replay_journal/);
  });
}

test('missing or stopped whole-study evidence is not a successful replay', () => {
  assert.throws(() => replay.replayOwnedStudy({}), /replay_study/);
  assert.throws(() => replay.replayOwnedStudy({ format: 'action-effect-owned-write-study/1', status: 'stopped' }), /replay_study/);
});

test('response commitments are recomputed rather than trusted', () => {
  assert.equal(replay.checkResponseHashes([{ event: { response: { id: 2 }, response_sha256: digestBytes('{"id":2}') } }]), true);
  assert.throws(() => replay.checkResponseHashes([{ event: { response: { id: 2 }, response_sha256: '0'.repeat(64) } }]), /replay_response_hash/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, truncateSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { replayReport } from '../replay.mjs';
import * as replay from '../replay.mjs';
import { digestBytes, sourceSnapshot, saveReport } from '../artifacts.mjs';
import { frozenCases } from '../offline-run.mjs';

function fixture(change = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'effect-replay-'));
  const report = { kind: 'runtime-pilot-offline', version: 1, passed: true,
    provenance: { sources: sourceSnapshot(), case_manifest_sha256: frozenCases().manifest_sha256 }, rows: [], ...change };
  return { directory, path: saveReport('test', report, directory), close() { rmSync(directory, { recursive: true, force: true }); } };
}

test('replay refuses modified report bytes even if JSON is still parseable', async () => {
  const f = fixture();
  try {
    writeFileSync(f.path, `${readFileSync(f.path, 'utf8')} `);
    await assert.rejects(replayReport(f.path), /checksum/);
  } finally { f.close(); }
});

test('a self-declared passing report cannot omit required cases', async () => {
  const f = fixture();
  try { await assert.rejects(replayReport(f.path), /missing_or_extra_rows/); }
  finally { f.close(); }
});

test('an empty source inventory is not a valid source match', async () => {
  const f = fixture({ provenance: { sources: [] } });
  try { await assert.rejects(replayReport(f.path), /source_snapshot_mismatch/); }
  finally { f.close(); }
});

function journalFixture() {
  const f = fixture();
  const runId = '12345678-1234-4123-8123-123456789abc';
  const name = `runtime-pilot-live-attempt-${runId}.jsonl`;
  const journalPath = join(f.directory, name);
  const raw = '{"event":"begin"}\n{"event":"end"}\n';
  const report = { run_id: runId, attempt_journal: { file: name, sha256: digestBytes(raw) } };
  const write = bytes => {
    writeFileSync(journalPath, bytes);
    report.attempt_journal.sha256 = digestBytes(bytes);
    writeFileSync(`${journalPath}.sha256`, `${digestBytes(bytes)}  ${name}\n`);
  };
  write(raw);
  return { ...f, report, journalPath, write };
}

test('journal loading verifies both raw-byte checksums and parses only the exact sibling filename', () => {
  const f = journalFixture();
  try { assert.deepEqual(replay.loadAttemptJournal(f.path, f.report), [{ event: 'begin' }, { event: 'end' }]); }
  finally { f.close(); }
});

for (const [name, mutate, reason] of [
  ['traversal', f => { f.report.attempt_journal.file = `../${f.report.attempt_journal.file}`; }, /attempt_journal_path/],
  ['absolute path', f => { f.report.attempt_journal.file = f.journalPath; }, /attempt_journal_path/],
  ['dot path', f => { f.report.attempt_journal.file = `./${f.report.attempt_journal.file}`; }, /attempt_journal_path/],
  ['other run', f => { f.report.run_id = '22345678-1234-4123-8123-123456789abc'; }, /attempt_journal_path/],
  ['unsafe run ID', f => { f.report.run_id = '../outside'; }, /attempt_journal_path/],
  ['newline run ID', f => { f.report.run_id += '\n'; f.report.attempt_journal.file = `runtime-pilot-live-attempt-${f.report.run_id}.jsonl`; }, /attempt_journal_path/],
  ['missing journal', f => { rmSync(f.journalPath); }, /attempt_journal/],
  ['missing checksum', f => { rmSync(`${f.journalPath}.sha256`); }, /attempt_journal/],
  ['changed bytes', f => { writeFileSync(f.journalPath, '{"event":"forged"}\n'); }, /attempt_journal_checksum/],
  ['changed recorded hash', f => { f.report.attempt_journal.sha256 = '0'.repeat(64); }, /attempt_journal_checksum/],
  ['changed checksum filename', f => { writeFileSync(`${f.journalPath}.sha256`, `${f.report.attempt_journal.sha256}  other.jsonl\n`); }, /attempt_journal_checksum/],
  ['truncated JSONL', f => { f.write('{"event":"begin"}'); }, /attempt_journal_jsonl/],
  ['invalid JSON', f => { f.write('{\n'); }, /attempt_journal_jsonl/],
  ['empty line', f => { f.write('{"event":"begin"}\n\n'); }, /attempt_journal_jsonl/],
  ['invalid UTF-8', f => { f.write(Buffer.from([0xff, 10])); }, /attempt_journal_jsonl/],
  ['too many entries', f => { f.write('{}\n'.repeat(10000)); }, /attempt_journal_jsonl/],
  ['oversized journal', f => { truncateSync(f.journalPath, 32 * 1024 * 1024 + 1); }, /attempt_journal_too_large/],
  ['symlink journal', f => { const target = join(f.directory, 'other.jsonl'); writeFileSync(target, readFileSync(f.journalPath));
    rmSync(f.journalPath); symlinkSync(target, f.journalPath); }, /attempt_journal_path/],
  ['symlink checksum', f => { const path = `${f.journalPath}.sha256`, target = join(f.directory, 'other.sha256');
    writeFileSync(target, readFileSync(path)); rmSync(path); symlinkSync(target, path); }, /attempt_journal_path/],
]) test(`journal loading rejects ${name} before trusting or following report paths`, () => {
  const f = journalFixture();
  try { mutate(f); assert.throws(() => replay.loadAttemptJournal(f.path, f.report), reason); }
  finally { f.close(); }
});

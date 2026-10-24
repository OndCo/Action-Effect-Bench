import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestBytes } from '../artifacts.mjs';
import { replayStudy } from '../replay.mjs';

const directory = fileURLToPath(new URL('../../reports/', import.meta.url));
const reportName = 'field-study-use-2026-10-24T14-59-47.404Z-d49779b4.json';
const raw = readFileSync(join(directory, reportName));
assert.equal(digestBytes(raw), '21077fac84582bbb12dc3a78c58422a9a4eebf775e5e313b417abf8a6e20667d');
const report = JSON.parse(raw);
const original = { report, frozen: JSON.parse(readFileSync(join(directory, report.freeze.file))),
  records: readFileSync(join(directory, report.journal.file), 'utf8').trimEnd().split('\n').map(JSON.parse) };

function syncTraces(bundle) {
  for (const row of bundle.report.tasks) {
    row.result.trace = bundle.records.filter(r => r.event.type === 'agent_event' && r.event.task_id === row.id)
      .map(r => r.event.event);
    const end = bundle.records.find(r => r.event.type === 'scheduled_task_end' && r.event.task_id === row.id);
    end.event.result_sha256 = digestBytes(JSON.stringify(row.result));
  }
}

// Rehash every framing layer: tests must catch inconsistent evidence, not just
// a stale outer checksum. This does not establish an independent witness.
function fixture(t, change) {
  const target = mkdtempSync(join(tmpdir(), 'third-edition-evidence-'));
  t.after(() => rmSync(target, { recursive: true, force: true }));
  const bundle = structuredClone(original);
  change(bundle);
  syncTraces(bundle);
  const freezeRaw = `${JSON.stringify(bundle.frozen, null, 2)}\n`;
  bundle.report.freeze.sha256 = digestBytes(freezeRaw);
  bundle.records[0].event.metadata.freeze = structuredClone(bundle.report.freeze);
  let previous = null;
  const journalRaw = bundle.records.map((old, sequence) => {
    const record = { sequence, previous_sha256: previous, recorded_at: old.recorded_at, event: old.event };
    const line = `${JSON.stringify({ ...record, sha256: digestBytes(JSON.stringify(record)) })}\n`;
    previous = digestBytes(line);
    return line;
  }).join('');
  bundle.report.journal.sha256 = digestBytes(journalRaw);
  const reportRaw = `${JSON.stringify(bundle.report, null, 2)}\n`;
  for (const [name, bytes] of [[reportName, reportRaw], [bundle.report.freeze.file, freezeRaw]]) {
    writeFileSync(join(target, name), bytes);
    writeFileSync(join(target, `${name}.sha256`), `${digestBytes(bytes)}  ${name}\n`);
  }
  writeFileSync(join(target, bundle.report.journal.file), journalRaw);
  return join(target, reportName);
}

test('third real run replays five ready reports and the retained transport failure without network', t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Offline replay must not request a model or provider'));
  const result = replayStudy(join(directory, reportName));
  assert.equal(result.valid, true);
  assert.equal(result.study_version, 3);
  assert.equal(result.summary.scheduled_tasks, 6);
  assert.equal(result.summary.failed_or_blocked_tasks, 1);
  assert.equal(result.summary.model_requests, 47);
  assert.equal(result.summary.read_tool_calls, 29);
  assert.equal(result.summary.model_tool_calls, 41);
  assert.equal(result.summary.usage.total_tokens, null);
  assert.equal(result.contract_summary.tasks_ready_for_maintainer_review, 5);
  assert.equal(result.contract_summary.first_draft_ready_tasks, 2);
  assert.equal(result.contract_summary.local_preflight_calls, 12);
  assert.equal(result.contract_summary.failed_drafts, 7);
  assert.equal(report.tasks[1].result.reason, 'model_transport_error');
  assert.equal(report.tasks[1].result.finalOutput, null);
  assert.equal(result.unavailable_read_tool_results, 1);
  assert.ok(result.coverage_gaps.includes('release_native_envelope_not_retained'));
  assert.equal(result.model_requests_replayed, 0);
  assert.equal(result.provider_requests_replayed, 0);
});

for (const [name, change, reason] of [
  ['invent a sixth ready report', b => { b.report.contract_summary.tasks_ready_for_maintainer_review = 6; }, /contract_summary_mismatch/],
  ['promote an unfinished draft to a ready report', b => { b.report.tasks[1].contract_checks.ready = true; }, /contract_check_mismatch/],
  ['hide a failed draft', b => { b.report.contract_summary.failed_drafts--; }, /contract_summary_mismatch/],
  ['count local checks as native reads', b => {
    b.report.summary.read_tool_calls = 41;
    b.records.at(-1).event.outcome.summary = structuredClone(b.report.summary);
  }, /summary_mismatch/],
  ['impute unreported token usage as a known total', b => {
    b.report.summary.usage.total_tokens = 339214;
    b.records.at(-1).event.outcome.summary = structuredClone(b.report.summary);
  }, /summary_mismatch/],
  ['alter measured draft feedback', b => {
    const event = b.records.find(r => r.event.type === 'agent_event' && r.event.event.type === 'tool_result'
      && r.event.event.name === 'check_report_contract').event.event;
    event.output.data.body_bytes--;
  }, /preflight_feedback_mismatch/],
  ['change the final report after an accepted check', b => {
    const row = b.report.tasks[0];
    const value = JSON.parse(row.result.finalOutput);
    value.conclusion += ' Changed after preflight.';
    const text = JSON.stringify(value);
    row.result.finalOutput = text;
    const final = b.records.filter(r => r.event.type === 'agent_event' && r.event.task_id === row.id
      && r.event.event.type === 'model_result').at(-1).event.event;
    final.output.find(item => item.type === 'message').content[0].text = text;
  }, /contract_check_mismatch/],
]) {
  test(`rehashing the third-edition artifact cannot ${name}`, t => {
    assert.throws(() => replayStudy(fixture(t, change)), reason);
  });
}

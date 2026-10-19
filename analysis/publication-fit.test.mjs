import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeReport, compactReport, assertCommittedReport } from './publication-fit.mjs';

test('standalone publication contains the actual report, conclusion and every source URL', () => {
  const report = { task_id: 'one', report_markdown: 'Original text.', conclusion: 'Needs review.', citations: ['https://github.com/OndCo/Action-Effect-Bench'] };
  const body = materializeReport(report);
  assert.ok(body.includes(report.report_markdown));
  assert.ok(body.includes(report.conclusion));
  assert.ok(body.includes(report.citations[0]));
  assert.ok(body.includes('Not published'));
});

test('compact handoff preserves exact report digest without truncating or rewriting the original', () => {
  const report = { task_id: 'one', report_markdown: 'Full text.', conclusion: 'Needs review.', citations: [] };
  const compact = compactReport(report, 'https://github.com/OndCo/Action-Effect-Bench/blob/' + 'a'.repeat(40) + '/reports/fixture.json');
  assert.match(compact, /Report JSON SHA-256: `[a-f0-9]{64}`/);
  assert.ok(compact.includes(report.conclusion));
  assert.equal(report.report_markdown, 'Full text.');
});

test('immutable handoff URL requires the exact report bytes at the selected commit', () => {
  const raw = Buffer.from('{"report":true}\n');
  const options = { revision: 'a'.repeat(40), file: 'field-study-use-fixture.json', raw };
  let lookup;
  assertCommittedReport({ ...options, readBlob: (ref, path) => { lookup = [ref, path]; return raw; } });
  assert.deepEqual(lookup, [options.revision, 'reports/field-study-use-fixture.json']);
  assert.throws(() => assertCommittedReport({ ...options, readBlob: () => Buffer.from('{}') }), /committed_report_mismatch/);
  assert.throws(() => assertCommittedReport({ ...options, revision: 'main', readBlob: () => raw }), /evidence_identity/);
  assert.throws(() => assertCommittedReport({ ...options, file: '../private.json', readBlob: () => raw }), /evidence_identity/);
});

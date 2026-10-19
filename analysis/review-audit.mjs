import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestBytes, saveArtifact } from '../field-study/artifacts.mjs';
import { parseJSON } from '../field-study/model-client.mjs';
import { readCheckedArtifact, replayStudy } from '../field-study/replay.mjs';
import { loadRecordedSources } from '../field-study/provenance.mjs';

const check = (value, reason) => { if (!value) throw new Error(reason); };

export function auditReview({ raw, review, criteria }) {
  check(review.provenance.original_report.raw_sha256 === digestBytes(raw), 'review_report_binding');
  const report = parseJSON(raw.toString('utf8'), 'review_report_json');
  check(report.tasks.length === review.tasks.length && report.tasks.length === criteria.tasks.length, 'review_task_inventory');
  const fact_counts = { met: 0, partial: 0, incorrect: 0, unknown: 0 };
  const grades = { complete: 0, partial: 0, incorrect: 0 };
  let verified_report_quotes = 0;
  const rows = [];
  for (const [i, task] of report.tasks.entries()) {
    const assessed = review.tasks[i], expected = criteria.tasks[i];
    check(task.id === assessed.id && task.id === expected.id && task.lane === assessed.lane, 'review_task_inventory');
    check(assessed.facts.length === expected.required_facts.length
      && new Set(assessed.facts.map(f => f.id)).size === assessed.facts.length, 'review_fact_inventory');
    const output = parseJSON(task.result.finalOutput, 'review_final_output');
    const bodyBytes = Buffer.byteLength(output.report_markdown), finalBytes = Buffer.byteLength(task.result.finalOutput);
    check(assessed.lengths.report_markdown_bytes === bodyBytes
      && assessed.lengths.final_output_text_bytes === finalBytes, 'review_bytes');
    assert.deepEqual(assessed.citations.urls, output.citations, 'review_citations');
    check(assessed.citations.count === output.citations.length, 'review_citations');
    for (const [j, fact] of assessed.facts.entries()) {
      const required = expected.required_facts[j];
      check(fact.id === required.id && fact.frozen_criterion === required.statement, 'review_criterion');
      assert.deepEqual(fact.frozen_references, required.citations, 'review_criterion_references');
      check(Object.hasOwn(fact_counts, fact.status), 'review_fact_status');
      fact_counts[fact.status]++;
      check(Array.isArray(fact.evidence_quotes), 'review_quotes');
      for (const quote of fact.evidence_quotes) {
        check(typeof quote === 'string' && quote.length > 0
          && `${output.report_markdown}\n${output.conclusion}`.includes(quote), `review_quote:${task.id}/${fact.id}`);
        verified_report_quotes++;
      }
    }
    const grade = assessed.facts.some(f => f.status === 'incorrect') ? 'incorrect'
      : assessed.facts.some(f => f.status !== 'met') || bodyBytes > 6000 ? 'partial' : 'complete';
    check(assessed.overall_report_grade === grade, `review_grade:${task.id}`);
    grades[grade]++;
    rows.push({ id: task.id, lane: task.lane, report_bytes: bodyBytes, final_output_bytes: finalBytes,
      within_report_budget: bodyBytes <= 6000, grade });
  }
  return { task_count: rows.length, fact_counts, grades, verified_report_quotes, rows,
    semantic_labels_independently_validated: false,
    scope: 'Checks exact cited report quotations, frozen fact references, byte counts and grade arithmetic. It does not independently decide whether the internal reviewer interpreted those passages correctly or whether a human used the reports.' };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Expected a retained field-study report and its internal review JSON.');
  const reportPath = resolve(process.argv[2]), reviewPath = resolve(process.argv[3]);
  const checked = readCheckedArtifact(dirname(reportPath), basename(reportPath));
  const replay = replayStudy(reportPath);
  const sources = loadRecordedSources(checked.value.provenance);
  const criteria = parseJSON(sources.read('bench/field-study/criteria.json').toString('utf8'), 'criteria_json');
  const reviewRaw = readFileSync(reviewPath), review = parseJSON(reviewRaw.toString('utf8'), 'review_json');
  const result = auditReview({ raw: checked.raw, review, criteria });
  const artifact = saveArtifact(dirname(reportPath), 'field-study-review-audit', {
    format: 'field-study-review-audit/1', input_report: { file: basename(reportPath), sha256: checked.sha256 },
    review: { file: basename(reviewPath), sha256: digestBytes(reviewRaw) }, replay_valid: replay.valid, ...result,
    source: { file: 'analysis/review-audit.mjs', sha256: digestBytes(readFileSync(fileURLToPath(import.meta.url))) },
    provider_requests: 0, model_requests: 0,
  });
  console.log(JSON.stringify({ ...result, artifact: artifact.path, sha256: artifact.sha256 }, null, 2));
}

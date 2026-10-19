import test from 'node:test';
import assert from 'node:assert/strict';
import { digestBytes } from '../field-study/artifacts.mjs';
import { auditReview } from './review-audit.mjs';

function fixture() {
  const output = { task_id: 'one', report_markdown: 'One observed fact.', conclusion: 'Keep the boundary.', citations: ['https://github.com/OndCo/Action-Effect-Bench'] };
  const report = { tasks: [{ id: 'one', lane: 'sdk', result: { finalOutput: JSON.stringify(output), status: 'completed' } }] };
  const raw = Buffer.from(JSON.stringify(report));
  const fact = { id: 'fact', statement: 'A fact.', citations: [{ source_id: 'one', quote: 'fixed source' }] };
  const criteria = { tasks: [{ id: 'one', required_facts: [fact] }] };
  const review = { provenance: { original_report: { raw_sha256: digestBytes(raw) } }, tasks: [{
    id: 'one', lane: 'sdk', overall_report_grade: 'complete',
    lengths: { report_markdown_bytes: Buffer.byteLength(output.report_markdown), final_output_text_bytes: Buffer.byteLength(JSON.stringify(output)) },
    citations: { urls: output.citations, count: 1 },
    facts: [{ id: 'fact', status: 'met', frozen_criterion: fact.statement, frozen_references: fact.citations, evidence_quotes: ['observed fact'] }],
  }] };
  return { raw, review, criteria };
}

test('recomputes fact counts and quote/byte references without claiming semantic label truth', () => {
  const result = auditReview(fixture());
  assert.deepEqual(result.fact_counts, { met: 1, partial: 0, incorrect: 0, unknown: 0 });
  assert.equal(result.semantic_labels_independently_validated, false);
  assert.equal(result.verified_report_quotes, 1);
});

test('rejects a review attached to a different real report', () => {
  const input = fixture(); input.raw = Buffer.from('{}');
  assert.throws(() => auditReview(input), /review_report_binding/);
});

test('rejects changed criterion or invented report quotation', () => {
  let input = fixture(); input.review.tasks[0].facts[0].frozen_criterion = 'Changed requirement';
  assert.throws(() => auditReview(input), /review_criterion/);
  input = fixture(); input.review.tasks[0].facts[0].evidence_quotes = ['not in report'];
  assert.throws(() => auditReview(input), /review_quote/);
});

test('rejects omitted or duplicated facts and incorrect derived grades', () => {
  let input = fixture(); input.review.tasks[0].facts = [];
  assert.throws(() => auditReview(input), /review_fact_inventory/);
  input = fixture(); input.review.tasks[0].facts.push(input.review.tasks[0].facts[0]);
  assert.throws(() => auditReview(input), /review_fact_inventory/);
  input = fixture(); input.review.tasks[0].overall_report_grade = 'partial';
  assert.throws(() => auditReview(input), /review_grade/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTask, summarizeStudy } from '../scoring.mjs';

const task = { id: 'task-one', lane: 'sdk', sources: [{ repository: 'OndCo/Action-Effect-Bench', path: 'README.md', ref: 'a'.repeat(40) }] };
const url = `https://github.com/OndCo/Action-Effect-Bench/blob/${'a'.repeat(40)}/README.md`;
const result = { status: 'completed', reason: 'final_output', duration_ms: 20, rounds: 2, tool_calls: 1,
  finalOutput: JSON.stringify({ task_id: task.id, report_markdown: 'A useful report.', conclusion: 'Inspect before publishing.', citations: [url] }),
  usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30, reported_requests: 2, missing_requests: 0 },
  trace: [{ type: 'model_result', duration_ms: 10 }, { type: 'tool_result', status: 'completed', duration_ms: 5, output: { untrusted: true, data: { status: 'ok', source_url: url, sha256: 'b'.repeat(64), bytes: 10 } } }] };

test('mechanical evidence readiness is not a semantic task-utility verdict', () => {
  const checked = inspectTask(task, result);
  assert.equal(checked.report_schema_valid, true);
  assert.equal(checked.citations_observed, true);
  assert.equal(checked.quality, 'not_reviewed');
  assert.equal(checked.body_bytes, Buffer.byteLength('A useful report.'));
  assert.equal(checked.timing.other_task_ms, 5);
});

test('wrong task identity, uncited evidence and fabricated sources cannot pass mechanical readiness', () => {
  const changed = structuredClone(result);
  changed.finalOutput = JSON.stringify({ task_id: 'other', report_markdown: 'x', conclusion: 'x', citations: ['https://attacker.example'] });
  assert.equal(inspectTask(task, changed).report_schema_valid, false);
  changed.finalOutput = JSON.stringify({ task_id: task.id, report_markdown: 'x', conclusion: 'x', citations: ['https://attacker.example'] });
  assert.equal(inspectTask(task, changed).citations_observed, false);
});

test('line anchors on actually observed pinned files are allowed, but queries are not', () => {
  const changed = structuredClone(result), report = JSON.parse(changed.finalOutput);
  report.citations = [`${url}#L1-L8`];
  changed.finalOutput = JSON.stringify(report);
  assert.equal(inspectTask(task, changed).citations_observed, true);
  report.citations = [`${url}?ref=main`];
  changed.finalOutput = JSON.stringify(report);
  assert.equal(inspectTask(task, changed).citations_observed, false);
});

test('failed tasks are retained, not scored as safe denials or useful maintenance', () => {
  const failed = { ...result, status: 'failed', reason: 'model_timeout', finalOutput: null };
  const checked = inspectTask(task, failed);
  assert.equal(checked.report_schema_valid, false);
  assert.equal(checked.quality, 'no_result');
  const summary = summarizeStudy([task], [{ id: task.id, lane: 'sdk', result: failed }]);
  assert.equal(summary.scheduled_tasks, 1);
  assert.equal(summary.completed_task_loops, 0);
  assert.equal(summary.failed_or_blocked_tasks, 1);
  assert.equal(summary.semantic_quality_assessed, false);
});

test('summary rejects missing, duplicated or unexpected scheduled tasks', () => {
  assert.throws(() => summarizeStudy([task], []), /task_inventory/);
  assert.throws(() => summarizeStudy([task], [{ id: task.id, result }, { id: task.id, result }]), /task_inventory/);
  assert.throws(() => summarizeStudy([task], [{ id: 'other', result }]), /task_inventory/);
});

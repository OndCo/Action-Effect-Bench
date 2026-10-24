// Synthetic contract/orchestration regressions, not real model outcomes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../agent-loop.mjs';

const module = await import('../report-contract.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const { assessReport, createReportPreflight, auditReportContract, summarizeReportContracts } = module;
const task = { id: 'report-fixture', prompt: 'Inspect the fixture, check the report, then return it.' };
const source = 'https://github.com/OndCo/Action-Effect-Spec/blob/' + 'a'.repeat(40) + '/README.md';
const report = extra => ({ task_id: task.id, report_markdown: 'Fixture only.', conclusion: 'Not a live experiment.', citations: [source], ...extra });
const response = output => ({ response_id: 'fixture-response', model: 'fixture', status: 'completed', duration_ms: 1,
  usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, output });
const call = (id, name, args) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args), status: 'completed' });
const final = value => response([{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value) }] }]);
const readCall = () => response([call('read-1', 'read_repository_file', { path: 'README.md' })]);
const checkCall = (value, id = 'check-1') => response([call(id, 'check_report_contract', value)]);

function setup(answers, { journalFail, readStatus = 'ok', rounds = 12, toolCalls = 18 } = {}) {
  const trace = [], requests = [];
  const preflight = createReportPreflight({ taskId: task.id, trace });
  const options = { task, limits: { rounds, toolCalls, reportBytes: 6000 },
    journal: event => {
      if (journalFail?.(event)) throw new Error('fixture journal unavailable');
      trace.push(structuredClone(event));
    },
    tools: { read_repository_file: {
      schema: { type: 'function', name: 'read_repository_file', parameters: { type: 'object',
        properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false }, strict: true },
      execute: async () => ({ status: readStatus, source_url: source }),
    }, check_report_contract: preflight },
    model: { respond: async (input, tools) => { requests.push({ input, tools }); return answers[requests.length - 1]; } },
  };
  return { options, requests, trace };
}

test('edition three exposes a bounded preflight and independent final audit', () => {
  for (const name of ['assessReport', 'createReportPreflight', 'auditReportContract', 'summarizeReportContracts']) {
    assert.equal(typeof module[name], 'function', `${name} must be implemented`);
  }
});

test('contract checks exact decoded UTF-8 bytes without changing the report', () => {
  const value = report({ report_markdown: '\u00e9'.repeat(3000) });
  const before = JSON.stringify(value);
  const accepted = assessReport(task.id, value, [source]);
  assert.equal(accepted.status, 'ready');
  assert.equal(accepted.body_bytes, 6000);
  assert.equal(accepted.authority, 'not_evaluated');
  assert.equal(accepted.semantic_quality, 'not_reviewed');
  assert.equal(JSON.stringify(value), before);
  const rejected = assessReport(task.id, report({ report_markdown: value.report_markdown + 'x' }), [source]);
  assert.equal(rejected.status, 'not_ready');
  assert.deepEqual(rejected.errors, ['report_bytes_exceeded']);
  assert.equal(rejected.over_budget_bytes, 1);
});

test('unknown citations, empty lists, malformed scalars and injected fields never pass', () => {
  for (const value of [report({ citations: [] }), report({ citations: [source + '?redirect=x'] }),
    report({ citations: ['https://evil.invalid/'] }), report({ citations: [source.replace('github.com', 'github.com.evil.invalid')] }),
    report({ citations: [source + '#L1-L0'] }), report({ citations: [source + '#L9-L2'] }),
    report({ report_markdown: '\ud800' }), report({ conclusion: '\udfff' }), report({ conclusion: '' }),
    report({ task_id: 'another-task' }), report({ granted: true }), null, [],
  ]) assert.equal(assessReport(task.id, value, [source]).status, 'not_ready');
  assert.equal(assessReport(task.id, report({ citations: [source + '#L2-L3'] }), [source]).status, 'ready');
  assert.equal(assessReport(task.id, report(), []).status, 'not_ready');
});

test('descriptor-backed inputs are not executed, and oversized fields are bounded', () => {
  let accesses = 0;
  const value = report();
  Object.defineProperty(value, 'report_markdown', { enumerable: true, get() { accesses++; return 'not allowed'; } });
  assert.equal(assessReport(task.id, value, [source]).status, 'not_ready');
  assert.equal(accesses, 0);
  assert.equal(assessReport(task.id, report({ conclusion: 'x'.repeat(100001) }), [source]).status, 'not_ready');
  assert.equal(assessReport(task.id, report({ citations: Array(129).fill(source) }), [source]).status, 'not_ready');
});

test('a valid checked final has separate local-call and provider-read accounting', async () => {
  const w = setup([readCall(), checkCall(report()), final(report())]);
  const result = await runAgent(w.options);
  const checked = auditReportContract(task.id, result);
  assert.equal(result.status, 'completed');
  assert.equal(checked.ready, true);
  assert.equal(checked.first_draft_ready, true);
  assert.equal(checked.preflight_calls, 1);
  assert.equal(checked.read_tool_calls, 1);
  assert.equal(checked.final_matches_accepted_preflight, true);
  assert.equal(checked.automatic_provider_writes, 0);
  const summary = summarizeReportContracts([{ id: task.id, result }]);
  assert.equal(summary.tasks_ready_for_maintainer_review, 1);
  assert.equal(summary.local_preflight_calls, 1);
  assert.equal(summary.read_tool_calls, 1);
  assert.equal(summary.independent_external_evaluations, 0);
});

test('explicit revision retains the failed draft and charges the same task budget', async () => {
  const oversized = report({ report_markdown: 'x'.repeat(6001) });
  const w = setup([readCall(), checkCall(oversized), checkCall(report(), 'check-2'), final(report())]);
  const result = await runAgent(w.options);
  const checked = auditReportContract(task.id, result);
  assert.equal(checked.ready, true);
  assert.equal(checked.first_draft_ready, false);
  assert.equal(checked.preflight_calls, 2);
  assert.equal(checked.failed_drafts, 1);
  assert.equal(result.rounds, 4);
  assert.equal(result.tool_calls, 3);
  assert.equal(result.trace.find(e => e.name === 'check_report_contract' && e.type === 'tool_attempt').arguments.report_markdown.length, 6001);
  assert.equal(checked.drafts[0].assessment.body_bytes, 6001);
});

test('final content is checked again and is not approved by a different earlier draft', async () => {
  for (const changed of [report({ report_markdown: 'changed after checking' }), report({ conclusion: 'changed' }),
    report({ citations: [source + '#L1'] }), report({ report_markdown: 'x'.repeat(6001) })]) {
    const w = setup([readCall(), checkCall(report()), final(changed)]);
    const result = await runAgent(w.options);
    assert.equal(auditReportContract(task.id, result).ready, false);
    assert.equal(w.requests.length, 3);
  }
  const unchecked = setup([readCall(), final(report())]);
  assert.equal(auditReportContract(task.id, await runAgent(unchecked.options)).ready, false);
});

test('observations and accepted drafts do not leak between tasks or backward in time', async () => {
  const first = setup([readCall(), checkCall(report()), final(report())]);
  assert.equal(auditReportContract(task.id, await runAgent(first.options)).ready, true);
  const next = setup([checkCall(report()), readCall(), final(report())]);
  const result = await runAgent(next.options);
  const checked = auditReportContract(task.id, result);
  assert.equal(checked.first_draft_ready, false);
  assert.equal(checked.ready, false);
  const unavailable = setup([readCall(), checkCall(report()), final(report())], { readStatus: 'unavailable' });
  assert.equal(auditReportContract(task.id, await runAgent(unavailable.options)).ready, false);
});

test('journal failure after checking never becomes a completed or reusable result', async () => {
  const w = setup([readCall(), checkCall(report()), final(report())], {
    journalFail: e => e.type === 'tool_result' && e.name === 'check_report_contract',
  });
  const result = await runAgent(w.options);
  assert.equal(result.reason, 'journal_error');
  assert.equal(auditReportContract(task.id, result).ready, false);
  assert.equal(w.requests.length, 2);
});

test('draft checks cannot exceed round/tool budgets or hide extra attempts', async () => {
  const w = setup([readCall(), checkCall(report()), final(report())], { toolCalls: 1 });
  const result = await runAgent(w.options);
  assert.equal(result.reason, 'tool_budget_exhausted');
  assert.equal(auditReportContract(task.id, result).ready, false);
  assert.equal(w.requests.length, 2);
});

test('offline contract audit rejects tampered feedback, trace order and duplicate task scores', async () => {
  const w = setup([readCall(), checkCall(report()), final(report())]);
  const result = await runAgent(w.options);
  const changed = structuredClone(result);
  changed.trace.find(e => e.type === 'tool_result' && e.name === 'check_report_contract').output.data.body_bytes++;
  assert.throws(() => auditReportContract(task.id, changed), /preflight_feedback_mismatch/);
  const reordered = structuredClone(result);
  reordered.trace[1].sequence = 99;
  assert.throws(() => auditReportContract(task.id, reordered), /contract_trace_order/);
  const duplicated = structuredClone(result);
  const duplicateIndex = duplicated.trace.findIndex(e => e.type === 'tool_result' && e.name === 'check_report_contract');
  duplicated.trace.splice(duplicateIndex + 1, 0, structuredClone(duplicated.trace[duplicateIndex]));
  duplicated.trace.forEach((event, index) => { event.sequence = index; });
  assert.throws(() => auditReportContract(task.id, duplicated), /contract_trace_order/);
  const falseCompletion = structuredClone(result);
  falseCompletion.trace.at(-1).status = 'failed';
  assert.throws(() => auditReportContract(task.id, falseCompletion), /contract_terminal/);
  assert.throws(() => summarizeReportContracts([{ id: task.id, result }, { id: task.id, result }]), /contract_task_inventory/);
});

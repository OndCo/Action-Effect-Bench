// Synthetic scheduling fixtures only; no model or provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../agent-loop.mjs';
import { runScheduledTasks, taskPrompt } from '../study.mjs';

const tasks = [{ id: 'one', lane: 'sdk' }, { id: 'two', lane: 'mcp' }, { id: 'three', lane: 'sdk' }];
const success = () => ({ status: 'completed', reason: 'final_output', rounds: 1, tool_calls: 0, duration_ms: 1,
  usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2, reported_requests: 1, missing_requests: 0 }, trace: [], finalOutput: '{}' });

test('retains every scheduled task and never silently substitutes the other lane', async () => {
  const calls = [];
  const rows = await runScheduledTasks({ tasks, blockedLanes: ['mcp'], runOne: async task => { calls.push(task.id); return success(); } });
  assert.deepEqual(rows.map(r => r.id), ['one', 'two', 'three']);
  assert.deepEqual(calls, ['one', 'three']);
  assert.equal(rows[1].result.reason, 'lane_setup_blocked');
});

test('safety stop halts the run rather than trying another conversation to evade it', async () => {
  let calls = 0;
  const rows = await runScheduledTasks({ tasks, runOne: async () => { calls++; return { ...success(), status: 'failed', reason: 'safety_stop' }; } });
  assert.equal(calls, 1);
  assert.equal(rows[2].result.reason, 'study_stopped_after_safety_signal');
});

test('a journal fault inside a tool stops every remaining scheduled task', async () => {
  const started = [];
  let modelCalls = 0, toolCalls = 0;
  const rows = await runScheduledTasks({ tasks, runOne: async task => {
    started.push(task.id);
    return runAgent({ task: { id: task.id, prompt: 'Read the synthetic public fixture.' }, limits: { rounds: 12, toolCalls: 18 }, journal: async () => {},
      model: { respond: async () => { modelCalls++; return { response_id: 'resp_fixture', model: 'fixture-model', status: 'completed', duration_ms: 1,
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, output: [{ type: 'function_call', name: 'read_fixture', call_id: 'call_one', arguments: '{}' }] }; } },
      tools: { read_fixture: { schema: { type: 'function', name: 'read_fixture', strict: true, parameters: { type: 'object', properties: {}, additionalProperties: false } },
        execute: async () => { toolCalls++; throw Object.assign(new Error('fixture-private-journal-detail'), { code: 'FIELD_STUDY_JOURNAL_ERROR' }); } } } });
  } });
  assert.deepEqual(started, ['one']);
  assert.equal(modelCalls, 1);
  assert.equal(toolCalls, 1);
  assert.equal(rows[0].result.status, 'failed');
  assert.equal(rows[0].result.reason, 'journal_error');
  assert.equal(rows[0].result.trace.at(-1).type, 'task_end');
  assert(rows.slice(1).every(row => row.result.status === 'blocked' && row.result.reason === 'study_stopped_after_journal_error'));
  assert(!JSON.stringify(rows).includes('fixture-private-journal-detail'));
});

test('source drift blocks unstarted tasks rather than blending code versions', async () => {
  let checks = 0, calls = 0;
  const rows = await runScheduledTasks({ tasks, sourceCheck: () => ++checks === 1, runOne: async () => { calls++; return success(); } });
  assert.equal(calls, 1);
  assert.equal(rows[1].result.reason, 'source_drift');
  assert.equal(rows[2].result.reason, 'source_drift');
});

test('prompt includes only public task inputs, not arbitrary rubric fields', () => {
  const prompt = taskPrompt({ id: 'one', title: 'Check docs', prompt: 'Inspect actual docs.', sources: [{ repository: 'OndCo/Action-Effect-Bench', path: 'README.md', ref: 'a'.repeat(40) }], mandatory_deliverables: ['Summarize observed limitations.'], expected_answer: 'do not disclose' });
  assert.ok(prompt.includes('Inspect actual docs.'));
  assert.ok(prompt.includes('README.md'));
  assert.ok(!prompt.includes('do not disclose'));
});

test('round-two prompt explicitly wraps the bounded Markdown report in exact JSON', () => {
  const original = 'Return the final Markdown report.';
  const prompt = taskPrompt({ id: 'round-two-fixture', title: 'Check public docs', prompt: original, sources: [], mandatory_deliverables: ['Describe unavailable evidence.'] });
  assert(prompt.includes(original));
  assert.match(prompt, /exactly one JSON object/);
  assert.match(prompt, /not raw Markdown/);
  assert.match(prompt, /task_id must equal "round-two-fixture"/);
  assert.match(prompt, /exactly the fields task_id, report_markdown, conclusion and citations/);
  assert.match(prompt, /report_markdown[^]*at most 6000 UTF-8 bytes/);
  assert.match(prompt, /4500-5000/);
  assert.match(prompt, /protocol authorization/);
  assert(!prompt.includes('7000'));
});

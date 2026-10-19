import test from 'node:test';
import assert from 'node:assert/strict';
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

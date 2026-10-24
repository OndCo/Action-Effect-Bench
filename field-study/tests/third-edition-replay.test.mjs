import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { digestBytes } from '../artifacts.mjs';
import { runAgent } from '../agent-loop.mjs';
import { createReportPreflight, READ_TOOLS, auditReportContract } from '../report-contract.mjs';
import { auditFrozenInputs, reconstructTask, expectedPrompt } from '../replay-checks.mjs';

const amendment = JSON.parse(readFileSync(new URL('../amendment-3.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('../tasks.json', import.meta.url)));
const task = manifest.tasks[0];

test('third edition freezes the previous task bytes and thirty facts, not new hidden cases', () => {
  const tasks = readFileSync(new URL('../tasks.json', import.meta.url));
  const criteria = readFileSync(new URL('../criteria.json', import.meta.url));
  assert.equal(amendment.tasks_sha256, digestBytes(tasks));
  assert.equal(amendment.criteria_sha256, digestBytes(criteria));
  assert.equal(amendment.frozen_fact_records_sha256, digestBytes(JSON.stringify(JSON.parse(criteria).tasks)));
  assert.equal(amendment.response_contract.report_max_utf8_bytes, 6000);
  assert.equal(amendment.holdout, false);
  assert.equal(amendment.automatic_model_retries, false);
});

test('new-format freeze is checked against the unchanged previous inputs and configuration', () => {
  const read = path => readFileSync(new URL('../' + path.replace('bench/field-study/', ''), import.meta.url));
  const config = JSON.parse(read('bench/field-study/tools.json'));
  const report = { format: 'field-study-use/2', configuration: config };
  const frozen = { tasks_sha256: amendment.tasks_sha256, criteria_sha256: amendment.criteria_sha256,
    task_inputs: manifest, model_configuration: config.azure_model,
    amendment: { file: 'field-study/amendment-3.json', sha256: digestBytes(read('bench/field-study/amendment-3.json')), value: amendment } };
  assert.equal(auditFrozenInputs(report, frozen, read).version, 3);
  assert.throws(() => auditFrozenInputs(report, frozen, path => path.endsWith('report-contract.mjs')
    ? Buffer.from('changed checker semantics') : read(path)), /unsupported_report_contract/);
  for (const change of [value => { value.response_contract.report_max_utf8_bytes = 8192; },
    value => { value.tasks_sha256 = '0'.repeat(64); }, value => { value.holdout = true; },
    value => { value.automatic_model_retries = true; }, value => { value.prior_report.sha256 = '0'.repeat(64); }]) {
    const altered = structuredClone(amendment);
    change(altered);
    const bytes = Buffer.from(JSON.stringify(altered));
    const changed = { ...frozen, amendment: { ...frozen.amendment, value: altered, sha256: digestBytes(bytes) } };
    assert.throws(() => auditFrozenInputs(report, changed, path => path.endsWith('amendment-3.json') ? bytes : read(path)), /amendment_binding/);
  }
});

test('edition-three prompt appends the frozen preflight instruction only to that edition', () => {
  const old = expectedPrompt(task, { version: 2 }, {});
  assert.equal(expectedPrompt(task, { version: 3, amendment }, {}), `${old}\n\n${amendment.prompt_addition}`);
});

test('control-flow replay accepts charged local preflight only in the new edition', async () => {
  const prompt = 'Synthetic replay fixture; not live data.', trace = [];
  const draft = { task_id: task.id, report_markdown: 'Unavailable fixture.', conclusion: 'No sources.', citations: [] };
  const tools = Object.fromEntries(READ_TOOLS.map(name => [name, { schema: { type: 'function', name,
    parameters: { type: 'object', properties: {}, additionalProperties: false, required: [] } },
    execute: () => assert.fail('No provider read in this fixture'),
  }]));
  tools.check_report_contract = createReportPreflight({ taskId: task.id, trace });
  let requests = 0;
  const limits = { rounds: 12, toolCalls: 18, reportBytes: 6000 };
  const result = await runAgent({ task: { id: task.id, prompt }, tools, limits, journal: event => trace.push(event),
    model: { respond: async () => ({ response_id: `fixture-${++requests}`, model: 'fixture', status: 'completed', duration_ms: 0,
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, output: requests === 1
        ? [{ type: 'function_call', call_id: 'check-1', name: 'check_report_contract', arguments: JSON.stringify(draft) }]
        : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(draft) }] }],
    }) } });
  const checked = reconstructTask(task, trace, { version: 3, limits }, prompt);
  assert.equal(checked.tool_calls, 1);
  assert.equal(checked.status, 'completed');
  assert.equal(checked.pairs.length, 1);
  assert.equal(auditReportContract(task.id, result).ready, false);
  assert.throws(() => reconstructTask(task, trace, { version: 2, limits }, prompt), /model_event/);
});

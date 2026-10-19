import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));

test('follow-up fixes only the response contract, not the thirty frozen facts', () => {
  const tasks = read('tasks.json'), criteria = read('criteria.json'), amendment = read('amendment-2.json');
  assert.equal(tasks.version, 2);
  assert.equal(criteria.version, 2);
  assert.equal(createHash('sha256').update(JSON.stringify(criteria.tasks)).digest('hex'),
    'bbf1996cc43ff3d9429326623dac61f4399a77d6bcb34372f6abee4d420b5872');
  assert.equal(amendment.prior_report.sha256, 'cdc07b7a10000a4fe96152a6a460f5633c3403bcc7c0cd8f3f68f8e1a5cbe9fc');
  assert.equal(amendment.holdout, false);
  assert.equal(amendment.response_contract.report_max_utf8_bytes, 6000);
  assert.equal(amendment.automatic_model_retries, false);
  for (const task of tasks.tasks) {
    assert.ok(task.prompt.includes('report_markdown'));
    assert.ok(!task.prompt.includes('Markdown report as final text'));
  }
  assert.match(criteria.evaluation_policy.response_contract, /JSON/);
  assert.match(criteria.evaluation_policy.review_scope, /AI-assisted/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWritePlan } from '../write-plan.mjs';
import * as config from '../write-config.mjs';

test('owned write inputs load exact already committed report and review bytes', () => {
  const inputs = config.frozenWriteInputs();
  assert.equal(inputs.references.report.sha256, 'e6d9fe0e27ca93932fb9102cc5d5b7f16e4c7c138cd72c79eeeaaf1cb2961999');
  assert.equal(inputs.references.review.sha256, '0f5b7954f549c1e184f5ece621126234f2c1c8034175391b1f1354ef2eca2682');
  assert.equal(inputs.report.tasks.length, 6);
});

function manifest() {
  const inputs = config.frozenWriteInputs();
  const target = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2 };
  return { format: 'action-effect-owned-write-manifest/1', run_id: 'unit-owned', principal: 'fixture-user',
    target, inputs: inputs.references, plan: buildWritePlan({ report: inputs.report, review: inputs.review,
      target, principal: 'fixture-user', runId: 'unit-owned' }),
    tools: JSON.parse(readFileSync(new URL('../tools.json', import.meta.url))),
    provenance: { environment: { opa_binary: { matches_release_pin: true } } } };
}

test('manifest validates against a fresh reconstruction of the fixed six candidates', () => {
  const value = manifest();
  assert.equal(config.validateWriteManifest(value), true);
});

for (const mutation of [
  value => { value.target.issue_number = 1; },
  value => { value.plan.max_comment_calls = 13; },
  value => { value.plan.scenarios[0].native.call.body = 'changed after approval'; },
  value => { value.inputs.report.sha256 = '0'.repeat(64); },
  value => { value.tools.github_mcp.executable_sha256 = '0'.repeat(64); },
  value => { value.provenance.environment.opa_binary.matches_release_pin = false; },
  value => { value.principal = 'another-user'; },
  value => { value.run_id = '../outside'; },
]) {
  test(`manifest rejects drift ${String(mutation)}`, () => {
    const value = manifest(); mutation(value);
    assert.throws(() => config.validateWriteManifest(value));
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mappingMatches, scoreRows } from '../scoring.mjs';

test('JSON projection equality is independent of parser object prototypes and key order', () => {
  const expected = { status: 'accepted_partial', reason: 'declared_partial', projection: { body_bytes: 1, data_class: 'test' } };
  const actual = { ...expected, projection: Object.assign(Object.create(null), { data_class: 'test', body_bytes: 1 }) };
  assert.equal(mappingMatches(actual, expected), true);
  assert.equal(mappingMatches({ ...actual, projection: { ...actual.projection, extra: true } }, expected), false);
  assert.equal(mappingMatches({ ...actual, projection: { ...actual.projection, body_bytes: '1' } }, expected), false);
});

test('a correct denial cannot conceal a mismapped action', () => {
  const result = scoreRows([{ base_intent: 'a', expected: { mapping: { status: 'accepted_partial', reason: 'declared_partial', projection: { resource: 'A' } }, decision: 'deny' },
    mapping: { status: 'accepted_partial', reason: 'declared_partial', projection: { resource: 'B' } }, authorization: { decision: 'deny' } }]);
  assert.equal(result.mapping_exact, 0);
  assert.equal(result.decision_exact, 1);
  assert.equal(result.masked_mapping_errors, 1);
});

test('an engine crash does not receive correct denial credit or useful completion', () => {
  const result = scoreRows([{ base_intent: 'a', expected: { mapping: { status: 'accepted_partial', reason: 'declared_partial', projection: {} }, decision: 'allow' },
    mapping: { status: 'evaluation_failure', reason: 'consumer_process' }, authorization: { decision: 'not_evaluated' } }]);
  assert.equal(result.decision_exact, 0);
  assert.equal(result.operational_failures, 1);
  assert.equal(result.expected_allow, 1);
  assert.equal(result.false_blocks, 0);
  assert.equal(result.expected_allow_not_allowed, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { upstreamContractCheck } from '../upstream/check.mjs';

test('pinned GitHub-authored request and response examples remain interface-valid', () => {
  const result = upstreamContractCheck();
  assert.equal(result.operation, 'issues/create-comment');
  assert.equal(result.request_example_valid, true);
  assert.equal(result.response_example_valid, true);
  assert.equal(result.missing_body_rejected, true);
  assert.equal(result.notifications_declared, true);
  assert.equal(result.independent_governance_labels, false);
});

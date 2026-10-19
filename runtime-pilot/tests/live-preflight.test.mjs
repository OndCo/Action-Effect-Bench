import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLivePreflight, matchesPlannedOutcome, recoverAfterUnknown } from '../live-run.mjs';

const issue = { title: 'Action-Effect controlled runtime pilot', state: 'open' };
test('live writes require a fresh dedicated owned issue; reruns cannot silently mint new occurrences', () => {
  assert.doesNotThrow(() => validateLivePreflight(issue, []));
  assert.throws(() => validateLivePreflight({ ...issue, pull_request: {} }, []), /dedicated_issue/);
  assert.throws(() => validateLivePreflight({ ...issue, state: 'closed' }, []), /dedicated_issue/);
  assert.throws(() => validateLivePreflight(issue, [{ body: 'Synthetic action-effect-run:earlier/protocol-sdk/ascii' }]), /already_used/);
});

test('the intended policy failure cannot receive credit from an unrelated identity outage', () => {
  const expected = { expected_outcome: 'withheld', expected_decision: 'evaluation_failure', expected_authorization_reason: 'invalid_policy' };
  assert.equal(matchesPlannedOutcome({ outcome: 'withheld', reason: 'provider_identity_unavailable', authorization: { decision: 'evaluation_failure' } }, expected), false);
  assert.equal(matchesPlannedOutcome({ outcome: 'withheld', reason: 'invalid_policy', authorization: { decision: 'evaluation_failure', reason: 'invalid_policy' } }, expected), true);
});

test('the lost-ack case requires evidence the trusted injector actually discarded a successful acknowledgment', () => {
  const expected = { expected_outcome: 'unknown', expected_decision: 'allow', expected_authorization_reason: 'authorized', expected_fault: 'successful_post_ack_discarded', expected_reconciled_outcome: 'confirmed' };
  const actual = { outcome: 'unknown', authorization: { decision: 'allow', reason: 'authorized' } };
  assert.equal(matchesPlannedOutcome(actual, expected, { outcome: 'confirmed' }), false);
  assert.equal(matchesPlannedOutcome({ ...actual, fault: { successful_post_ack_discarded: true } }, expected, { outcome: 'confirmed' }), true);
});

test('a recovery exception does not overwrite the already observed dispatch result', async () => {
  const actual = { outcome: 'unknown', authorization: { decision: 'allow', reason: 'authorized' }, mapping: { status: 'accepted_partial' } };
  const before = structuredClone(actual);
  const recovery = await recoverAfterUnknown(actual, {}, async () => { throw new Error('storage failure'); });
  assert.deepEqual(actual, before);
  assert.equal(recovery.outcome, 'unknown');
  assert.equal(recovery.reason, 'reconciliation_failure');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { assertPublicValue } from '../artifacts.mjs';
import { replaceState, scenarioPolicy, writeState } from '../write-artifacts.mjs';
import { load } from '../../runtime-pilot/ledger.mjs';
import * as worker from '../write-worker.mjs';

function fixture(fault = 'none') {
  const root = mkdtempSync(join(tmpdir(), 'owned-worker-'));
  const scenario = { id: 'unit-case', occurrence: 'unit-occurrence', lane: 'sdk', strategy: 'protocol', fault,
    context: { principal: 'fixture-user', data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' },
    native: { lane: 'sdk', call: { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2, body: 'Unit fixture, not live evidence.' } } };
  const comments = [], events = [];
  const provider = {
    async principal() { return 'fixture-user'; },
    async listComments() { return structuredClone(comments); },
    async createComment(params) {
      const id = 100 + comments.length;
      const row = { id, body: params.body, user: { login: 'fixture-user' },
        url: `https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/comments/${id}`,
        issue_url: 'https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/2',
        html_url: `https://github.com/OndCo/Action-Effect-Bench/issues/2#issuecomment-${id}` };
      comments.push(row); return structuredClone(row);
    },
    async readComment(params, id) { return structuredClone(comments.find(row => row.id === id)); },
  };
  const policyFile = writeState(root, 'policy.json', scenarioPolicy(scenario, 'initial'));
  const options = { scenario, mode: 'execute', policyFile, ledgerDir: join(root, 'ledger'), provider,
    record: event => events.push(event), checkpoint: async () => {}, deadlineMs: 20 };
  return { root, scenario, comments, events, options };
}

test('gate result changes only the sensitive-key spelling, retaining actual decision', () => {
  const input = { outcome: 'unknown', authorization: { decision: 'allow' }, timings: { total_ms: 1.25 } };
  const result = worker.publicGateResult(input);
  assert.deepEqual(result, { outcome: 'unknown', authority: { decision: 'allow' }, timings: { total_ms: 1.25 } });
  assertPublicValue(result);
  assert.equal(input.authorization.decision, 'allow');
});

test('ordinary worker executes and then a fresh invocation suppresses its occurrence', async () => {
  const f = fixture();
  assert.equal((await worker.runScenario(f.options)).outcome, 'confirmed');
  assert.equal((await worker.runScenario({ ...f.options, mode: 'probe' })).outcome, 'duplicate_suppressed');
  assert.equal(f.comments.length, 1);
});

for (const [fault, variant, reason] of [['revoke-after-preflight', 'revoked', 'revoked'], ['narrow-after-preflight', 'narrowed', 'body_too_large']]) {
  test(`${fault} changes current policy after a real preflight in the gate`, async () => {
    const f = fixture(fault), checkpoints = [];
    const result = await worker.runScenario({ ...f.options, checkpoint: async stage => {
      checkpoints.push(stage);
      assert.equal(load(f.options.ledgerDir, f.scenario.occurrence).state, 'reserved');
      replaceState(f.root, 'policy.json', scenarioPolicy(f.scenario, variant));
    } });
    assert.deepEqual(checkpoints, ['after-preflight']);
    assert.equal(result.outcome, 'withheld');
    assert.equal(result.reason, reason);
    assert.equal(result.authority.decision, 'deny');
    assert.equal(f.comments.length, 0);
  });
}

test('pre-send cut is reached only after inflight persistence and before the provider', async () => {
  const f = fixture('crash-before-send');
  let observed;
  await worker.runScenario({ ...f.options, checkpoint: async stage => {
    observed = { stage, state: load(f.options.ledgerDir, f.scenario.occurrence).state, comments: f.comments.length };
    throw new Error('unit_checkpoint_cut_not_a_real_process_crash');
  } });
  assert.deepEqual(observed, { stage: 'before-native-send', state: 'inflight', comments: 0 });
  assert.equal(f.comments.length, 0);
});

test('post-reply cut occurs after actual provider response before ledger confirmation', async () => {
  const f = fixture('crash-after-reply');
  let observed;
  await worker.runScenario({ ...f.options, checkpoint: async stage => {
    observed = { stage, state: load(f.options.ledgerDir, f.scenario.occurrence).state, comments: f.comments.length };
    throw new Error('unit_checkpoint_cut_not_a_real_process_crash');
  } });
  assert.deepEqual(observed, { stage: 'after-native-reply', state: 'inflight', comments: 1 });
  assert.equal(f.comments.length, 1);
});

test('acknowledgment deadline really elapses and recovery never calls create', async () => {
  const f = fixture('timeout-after-reply'), started = performance.now();
  const result = await worker.runScenario(f.options);
  assert.equal(result.outcome, 'unknown');
  assert.ok(performance.now() - started >= 20);
  assert.equal(f.comments.length, 1);
  assert.equal(f.events.filter(event => event.type === 'fault_ack_deadline').length, 1);
  f.options.provider.createComment = () => { throw new Error('recovery_attempted_create'); };
  const recovered = await worker.runScenario({ ...f.options, mode: 'reconcile' });
  assert.equal(recovered.outcome, 'confirmed');
  assert.equal(recovered.automatic_resend, false);
  assert.equal(recovered.recovery_evidence, 'new-current-content-since-preflight-not-execution-attribution');
});

test('ambiguous recovery remains unknown and suppresses an execution retry', async () => {
  const f = fixture('timeout-after-reply');
  assert.equal((await worker.runScenario(f.options)).outcome, 'unknown');
  f.options.provider.listComments = async () => [];
  assert.equal((await worker.runScenario({ ...f.options, mode: 'reconcile' })).outcome, 'unknown');
  assert.equal((await worker.runScenario({ ...f.options, mode: 'probe' })).outcome, 'duplicate_suppressed');
  assert.equal(f.comments.length, 1);
});

for (const patch of [{ mode: 'resend' }, { deadlineMs: 0 }, { deadlineMs: 60001 }]) {
  test(`worker rejects invalid run configuration ${JSON.stringify(patch)}`, async () => {
    const f = fixture();
    await assert.rejects(() => worker.runScenario({ ...f.options, ...patch }), /worker_configuration/);
    assert.equal(f.comments.length, 0);
  });
}

test('unknown fault names fail before reserving or sending', async () => {
  const f = fixture('retry-on-timeout');
  await assert.rejects(() => worker.runScenario(f.options), /worker_configuration/);
  assert.equal(f.comments.length, 0);
});

test('journal failure at the checkpoint never reaches a provider mutation', async () => {
  const f = fixture('revoke-after-preflight');
  await assert.rejects(() => worker.runScenario({ ...f.options,
    record: () => { throw new Error('disk_failed'); } }), /disk_failed/);
  assert.equal(f.comments.length, 0);
});

test('live worker refuses an incomplete CLI configuration before any authentication', async () => {
  await assert.rejects(() => worker.runOwnedWorker([]), /worker_arguments/);
  await assert.rejects(() => worker.runOwnedWorker(['/tmp/missing', 'not-a-hash', 'case', 'execute']), /worker_arguments/);
});

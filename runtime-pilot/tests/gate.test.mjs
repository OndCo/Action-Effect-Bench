import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeAction, reconcileAction } from '../gate.mjs';
import { makeDescription, profile } from '../mapping.mjs';

const context = { principal: 'fixture-user', data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' };
const params = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 1, body: 'Synthetic action-effect-gate test' };
const native = { lane: 'sdk', call: params };
const policy = { revision: 'p1', principal: 'fixture-user', revoked: false, allow_partial_direct: true,
  max_body_bytes: 8192, grants: [{ repository: 'OndCo/Action-Effect-Bench', issue_number: 1, data_class: 'synthetic-public' }] };
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'effect-gate-')), policyFile = join(root, 'policy.json');
  writeFileSync(policyFile, JSON.stringify(policy));
  const comments = [];
  const provider = {
    async principal() { return context.principal; },
    async createComment(p) {
      const id = comments.length + 1;
      const c = { id, body: p.body, user: { login: context.principal },
        url: `https://api.github.com/repos/${p.owner}/${p.repo}/issues/comments/${id}`,
        issue_url: `https://api.github.com/repos/${p.owner}/${p.repo}/issues/${p.issue_number}`,
        html_url: `https://github.com/${p.owner}/${p.repo}/issues/${p.issue_number}#issuecomment-${id}` };
      comments.push(c); return c;
    },
    async readComment(p, id) { return comments.find(c => c.id === id); },
    async listComments() { return comments; }
  };
  const options = { native: structuredClone(native), context: structuredClone(context), policyFile,
    ledgerDir: join(root, 'ledger'), occurrence: 'test-1', strategy: 'protocol', provider };
  return { root, policyFile, comments, provider, options, close: () => rmSync(root, { recursive: true, force: true }) };
}

// Compound fault regressions use the real mapper, Python consumer, OPA and
// filesystem ledger, but a synthetic provider. They are not new SaaS trials.
for (const strategy of ['protocol', 'structured']) for (const lane of ['sdk', 'mcp']) {
  const input = body => lane === 'sdk'
    ? { lane, call: { ...params, body } }
    : { lane, call: { name: 'add_issue_comment', arguments: { ...params, body } } };
  const title = name => `compound ${strategy}/${lane}: ${name}`;

  test(title('revocation during preparation stays withheld after authority restoration'), async () => {
    const f = fixture();
    try {
      Object.assign(f.options, { strategy, native: input(params.body) });
      if (strategy === 'protocol') f.options.preparedDescription = makeDescription(f.options.native, context);
      const list = f.provider.listComments;
      f.provider.listComments = async (...args) => {
        writeFileSync(f.policyFile, JSON.stringify({ ...policy, revision: 'p2', revoked: true }));
        return list(...args);
      };
      const denied = await executeAction(f.options);
      assert.equal(denied.outcome, 'withheld');
      assert.equal(denied.authorization.decision, 'deny');
      assert.equal(f.comments.length, 0);
      writeFileSync(f.policyFile, JSON.stringify({ ...policy, revision: 'p3' }));
      f.provider.listComments = list;
      assert.equal((await executeAction(f.options)).outcome, 'duplicate_suppressed');
      assert.equal((await executeAction({ ...f.options, occurrence: 'new-after-restore' })).outcome, 'confirmed');
      assert.equal(f.comments.length, 1);
    } finally { f.close(); }
  });

  test(title('lost acknowledgement then revocation separates past completion from new authority'), async () => {
    const f = fixture();
    try {
      Object.assign(f.options, { strategy, native: input(params.body) });
      const post = f.provider.createComment;
      let sends = 0;
      f.provider.createComment = async value => { sends++; await post(value); throw new Error('fixture lost acknowledgement'); };
      assert.equal((await executeAction(f.options)).outcome, 'unknown');
      writeFileSync(f.policyFile, JSON.stringify({ ...policy, revision: 'revoked', revoked: true }));
      assert.equal((await executeAction(f.options)).outcome, 'duplicate_suppressed');
      const recovered = await reconcileAction(f.options);
      assert.equal(recovered.outcome, 'confirmed');
      assert.equal(recovered.automatic_resend, false);
      const next = await executeAction({ ...f.options, occurrence: 'new-denied', native: input('different proposed report') });
      assert.equal(next.outcome, 'withheld');
      assert.equal(next.authorization.decision, 'deny');
      assert.equal(sends, 1);
      assert.equal(f.comments.length, 1);
    } finally { f.close(); }
  });

  test(title('uncertainty plus ambiguous readback never retries when grants return'), async () => {
    const f = fixture();
    try {
      Object.assign(f.options, { strategy, native: input(params.body) });
      const otherWriter = f.provider.createComment;
      let sends = 0;
      f.provider.createComment = async () => { sends++; throw new Error('fixture unknown delivery'); };
      assert.equal((await executeAction(f.options)).outcome, 'unknown');
      await otherWriter(params);
      await otherWriter(params);
      writeFileSync(f.policyFile, JSON.stringify({ ...policy, revision: 'narrowed', grants: [] }));
      assert.equal((await reconcileAction(f.options)).outcome, 'unknown');
      writeFileSync(f.policyFile, JSON.stringify({ ...policy, revision: 'restored' }));
      assert.equal((await reconcileAction(f.options)).outcome, 'unknown');
      assert.equal((await executeAction(f.options)).outcome, 'duplicate_suppressed');
      assert.equal(sends, 1);
    } finally { f.close(); }
  });

  test(title('policy parse failure cannot be reused as approval on a later request'), async () => {
    const f = fixture();
    try {
      Object.assign(f.options, { strategy, native: input(params.body) });
      writeFileSync(f.policyFile, '{broken');
      const failed = await executeAction(f.options);
      assert.equal(failed.authorization.decision, 'evaluation_failure');
      assert.equal(failed.outcome, 'withheld');
      writeFileSync(f.policyFile, JSON.stringify(policy));
      assert.equal((await executeAction(f.options)).outcome, 'duplicate_suppressed');
      assert.equal((await executeAction({ ...f.options, occurrence: 'fresh-request' })).outcome, 'confirmed');
      f.provider.principal = async () => 'another-principal';
      const wrongActor = await executeAction({ ...f.options, occurrence: 'different-principal', native: input('another report') });
      assert.equal(wrongActor.reason, 'provider_principal_mismatch');
      assert.equal(wrongActor.outcome, 'withheld');
      assert.equal(f.comments.length, 1);
    } finally { f.close(); }
  });
}

test('allowed action is read back; the same occurrence is never posted twice', async () => {
  const f = fixture();
  try {
    const a = await executeAction(f.options);
    assert.equal(a.outcome, 'confirmed');
    assert.equal(a.receipt.content_matches, true);
    const b = await executeAction(f.options);
    assert.equal(b.outcome, 'duplicate_suppressed');
    assert.equal(f.comments.length, 1);
  } finally { f.close(); }
});

test('revocation and narrow current grant withhold posting without using stale approval', async () => {
  const f = fixture();
  try {
    writeFileSync(f.policyFile, JSON.stringify({ ...policy, revision: 'p2', revoked: true }));
    const result = await executeAction(f.options);
    assert.equal(result.authorization.decision, 'deny');
    assert.equal(result.outcome, 'withheld');
    assert.equal(f.comments.length, 0);
  } finally { f.close(); }
});

test('lost acknowledgment remains unknown; reconciliation never sends a second POST', async () => {
  const f = fixture();
  try {
    const actual = f.provider.createComment;
    f.provider.createComment = async p => { await actual(p); throw new Error('simulated transport acknowledgment loss'); };
    const result = await executeAction(f.options);
    assert.equal(result.outcome, 'unknown');
    assert.equal((await executeAction(f.options)).outcome, 'duplicate_suppressed');
    const reconciled = await reconcileAction(f.options);
    assert.equal(reconciled.outcome, 'confirmed');
    assert.equal(f.comments.length, 1);
  } finally { f.close(); }
});

test('malformed policy is not semantic allow/block credit', async () => {
  const f = fixture();
  try {
    writeFileSync(f.policyFile, '{}');
    const result = await executeAction(f.options);
    assert.equal(result.authorization.decision, 'evaluation_failure');
    assert.equal(f.comments.length, 0);
  } finally { f.close(); }
});

test('a different authenticated provider actor cannot use the configured principal grant', async () => {
  const f = fixture();
  try {
    f.provider.principal = async () => 'different-user';
    const result = await executeAction(f.options);
    assert.equal(result.reason, 'provider_principal_mismatch');
    assert.equal(result.authorization.decision, 'evaluation_failure');
    assert.equal(f.comments.length, 0);
  } finally { f.close(); }
});

test('current-content mismatch remains unknown rather than claiming confirmed completion', async () => {
  const f = fixture();
  try {
    const read = f.provider.readComment;
    f.provider.readComment = async (...args) => ({ ...await read(...args), body: 'different content' });
    const result = await executeAction(f.options);
    assert.equal(result.outcome, 'unknown');
    assert.equal(result.reason, 'readback_mismatch');
    assert.equal(result.receipt.content_matches, false);
    assert.equal(f.comments.length, 1);
  } finally { f.close(); }
});

test('changing the body cannot reuse an already reserved occurrence', async () => {
  const f = fixture();
  try {
    assert.equal((await executeAction(f.options)).outcome, 'confirmed');
    const result = await executeAction({ ...f.options, native: { lane: 'sdk', call: { ...params, body: 'changed' } } });
    assert.equal(result.outcome, 'duplicate_suppressed');
    assert.equal(result.reason, 'binding_mismatch');
    assert.equal(f.comments.length, 1);
  } finally { f.close(); }
});

test('concurrent local requests for one occurrence produce at most one POST', async () => {
  const f = fixture();
  try {
    const results = await Promise.all([executeAction(f.options), executeAction(f.options)]);
    assert.deepEqual(results.map(row => row.outcome).sort(), ['confirmed', 'duplicate_suppressed']);
    assert.equal(f.comments.length, 1);
  } finally { f.close(); }
});

test('missing readback retains unknown and consumed occurrence without a retry', async () => {
  const f = fixture();
  try {
    const post = f.provider.createComment;
    f.provider.createComment = async p => { await post(p); throw new Error('lost acknowledgment'); };
    assert.equal((await executeAction(f.options)).outcome, 'unknown');
    f.provider.listComments = async () => [];
    assert.equal((await reconcileAction(f.options)).outcome, 'unknown');
    assert.equal((await executeAction(f.options)).outcome, 'duplicate_suppressed');
    assert.equal(f.comments.length, 1);
  } finally { f.close(); }
});

test('tampered body commitments are withheld before provider dispatch or policy credit', async () => {
  const f = fixture();
  try {
    const description = makeDescription(native, context);
    description.extensions[profile.body_digest_extension] = '0'.repeat(64);
    const result = await executeAction({ ...f.options, preparedDescription: description });
    assert.equal(result.outcome, 'withheld');
    assert.equal(result.mapping.status, 'untrusted_evidence');
    assert.equal(result.authorization.decision, 'not_evaluated');
    assert.equal(f.comments.length, 0);
  } finally { f.close(); }
});

test('a valid description for a different body cannot be applied to this invocation', async () => {
  const f = fixture();
  try {
    const other = { lane: 'sdk', call: { ...params, body: 'another intended action' } };
    const result = await executeAction({ ...f.options, preparedDescription: makeDescription(other, context) });
    assert.equal(result.outcome, 'withheld');
    assert.equal(result.mapping.reason, 'description_binding');
    assert.equal(f.comments.length, 0);
  } finally { f.close(); }
});

test('an old identical comment is never evidence that a failed new occurrence executed', async () => {
  const f = fixture();
  try {
    await f.provider.createComment(params);
    f.provider.createComment = async () => { throw new Error('failed before POST'); };
    await executeAction(f.options);
    assert.notEqual((await reconcileAction(f.options)).outcome, 'confirmed');
    assert.equal(f.comments.length, 1);
  } finally { f.close(); }
});

test('editing a preexisting comment after preflight cannot reconcile a lost acknowledgment', async () => {
  const f = fixture();
  try {
    await f.provider.createComment({ ...params, body: 'preexisting unrelated comment' });
    f.provider.createComment = async () => { f.comments[0].body = params.body; throw new Error('failed before POST'); };
    assert.equal((await executeAction(f.options)).outcome, 'unknown');
    assert.equal((await reconcileAction(f.options)).outcome, 'unknown');
  } finally { f.close(); }
});

test('fresh GET ID must equal the ID returned by POST', async () => {
  const f = fixture();
  try {
    const post = f.provider.createComment;
    f.provider.createComment = async p => ({ ...await post(p), id: 88 });
    f.provider.readComment = async () => f.comments[0];
    const result = await executeAction(f.options);
    assert.equal(result.outcome, 'unknown');
    assert.equal(result.reason, 'readback_mismatch');
    assert.equal(result.receipt.content_matches, false);
  } finally { f.close(); }
});

test('known-ID reconciliation cannot accept a different matching comment', async () => {
  const f = fixture();
  try {
    f.provider.readComment = async () => { throw new Error('readback temporarily unavailable'); };
    assert.equal((await executeAction(f.options)).outcome, 'unknown');
    const other = await f.provider.createComment(params);
    f.provider.readComment = async () => other;
    assert.equal((await reconcileAction(f.options)).outcome, 'unknown');
  } finally { f.close(); }
});

test('identity lookup cannot replace the provider methods or configured ledger and policy paths', async () => {
  const f = fixture();
  try {
    const alternatePolicy = join(f.root, 'revoked.json');
    writeFileSync(alternatePolicy, JSON.stringify({ ...policy, revoked: true }));
    const unexpected = async () => { throw new Error('replacement provider must not execute'); };
    f.provider.principal = async () => {
      f.options.provider = { createComment: unexpected, readComment: unexpected, listComments: unexpected };
      f.provider.createComment = unexpected;
      f.provider.readComment = unexpected;
      f.options.policyFile = alternatePolicy;
      f.options.ledgerDir = join(f.root, 'wrong-ledger');
      f.options.occurrence = 'wrong-occurrence';
      f.options.native.call.body = 'mutated during await';
      return context.principal;
    };
    const result = await executeAction(f.options);
    assert.equal(result.outcome, 'confirmed');
    assert.equal(f.comments.length, 1);
    assert.equal(f.comments[0].body, params.body);
  } finally { f.close(); }
});

test('current policy file contents are still reread after asynchronous preflight', async () => {
  const f = fixture();
  try {
    f.provider.listComments = async () => {
      writeFileSync(f.policyFile, JSON.stringify({ ...policy, revoked: true }));
      return [];
    };
    const result = await executeAction(f.options);
    assert.equal(result.authorization.reason, 'revoked');
    assert.equal(result.outcome, 'withheld');
    assert.equal(f.comments.length, 0);
  } finally { f.close(); }
});

test('reconciliation snapshots expected content and principal before awaiting the provider', async () => {
  const f = fixture();
  try {
    const post = f.provider.createComment;
    f.provider.createComment = async p => { await post(p); throw new Error('lost acknowledgment'); };
    assert.equal((await executeAction(f.options)).outcome, 'unknown');
    f.provider.listComments = async () => {
      f.options.native.call.body = 'changed while reading';
      f.options.context.principal = 'other-user';
      return [{ ...f.comments[0], body: 'changed while reading', user: { login: 'other-user' } }];
    };
    assert.equal((await reconcileAction(f.options)).outcome, 'unknown');
  } finally { f.close(); }
});

test('reconciliation retains its original ledger configuration across readback await', async () => {
  const f = fixture();
  try {
    const post = f.provider.createComment;
    f.provider.createComment = async p => { await post(p); throw new Error('lost acknowledgment'); };
    assert.equal((await executeAction(f.options)).outcome, 'unknown');
    f.provider.listComments = async () => {
      f.options.ledgerDir = join(f.root, 'wrong-ledger');
      f.options.occurrence = 'wrong-occurrence';
      return f.comments;
    };
    assert.equal((await reconcileAction(f.options)).outcome, 'confirmed');
  } finally { f.close(); }
});

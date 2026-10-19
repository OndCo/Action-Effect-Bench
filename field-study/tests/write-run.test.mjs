import test from 'node:test';
import assert from 'node:assert/strict';
import * as run from '../write-run.mjs';

const scenario = { expected: { initial_outcome: 'confirmed', reason: null, decision: 'allow', recovery_outcome: null, new_comments: 1 } };
const phase = { mode: 'execute', process: { pid: 222, exit_code: 0, signal: null, planned_kill: false },
  result: { outcome: 'confirmed', authority: { decision: 'allow' }, receipt: { content_matches: true } },
  ledger_after: { state: 'confirmed' }, journal: { valid: true, complete: true } };

test('delivery qualifies only with result, confirmation and complete journal', () => {
  assert.equal(run.assessPhase(phase, scenario, 'execute'), true);
});

for (const mutate of [
  p => { p.result.outcome = 'unknown'; },
  p => { p.result.authority.decision = 'deny'; },
  p => { p.result.receipt.content_matches = false; },
  p => { p.journal.complete = false; },
  p => { p.process.exit_code = 1; },
  p => { p.ledger_after.state = 'inflight'; },
]) {
  test(`incomplete delivery fails qualification ${String(mutate)}`, () => {
    const p = structuredClone(phase); mutate(p);
    assert.equal(run.assessPhase(p, scenario, 'execute'), false);
  });
}

test('expected crash requires actual SIGKILL, an unsealed valid journal and inflight ledger', () => {
  const s = { expected: { initial_outcome: 'process-killed' } };
  const p = { ...phase, process: { ...phase.process, exit_code: null, signal: 'SIGKILL', planned_kill: true },
    result: null, ledger_after: { state: 'inflight' }, journal: { valid: true, complete: false } };
  assert.equal(run.assessPhase(p, s, 'execute'), true);
  p.process.signal = 'SIGTERM';
  assert.equal(run.assessPhase(p, s, 'execute'), false);
});

test('no-evidence recovery is valid unknown, not an allowed or completed action', () => {
  const s = { expected: { recovery_outcome: 'unknown' } };
  const p = { ...phase, result: { outcome: 'unknown', automatic_resend: false }, ledger_after: { state: 'inflight' } };
  assert.equal(run.assessPhase(p, s, 'reconcile'), true);
  p.result.automatic_resend = true;
  assert.equal(run.assessPhase(p, s, 'reconcile'), false);
});

test('retry probe must return duplicate suppression rather than another successful send', () => {
  const p = { ...phase, result: { outcome: 'duplicate_suppressed', authority: { decision: 'not_evaluated' } } };
  assert.equal(run.assessPhase(p, scenario, 'probe'), true);
  p.result = phase.result;
  assert.equal(run.assessPhase(p, scenario, 'probe'), false);
});

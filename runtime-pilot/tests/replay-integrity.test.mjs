import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as replay from '../replay.mjs';
import { digestBytes, sourceSnapshot, saveReport } from '../artifacts.mjs';
import { frozenCases } from '../offline-run.mjs';
import { durationSummary, scoreRows } from '../scoring.mjs';
import { upstreamContractCheck } from '../upstream/check.mjs';
import { matchesPlannedOutcome } from '../live-run.mjs';

const frozen = frozenCases();
const upstream = upstreamContractCheck();
const planBytes = readFileSync(new URL('../live-plan.json', import.meta.url));
const plan = JSON.parse(planBytes);
const planHash = digestBytes(planBytes);
const opaPin = JSON.parse(readFileSync(new URL('../tools.json', import.meta.url))).opa;
const dependencyPins = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).dependencies;
const runId = '12345678-1234-4123-8123-123456789abc';
const at = '2026-10-19T12:00:00.000Z';

function authorization(decision, policy) {
  if (decision === 'not_evaluated') return { decision };
  return { decision, reason: { allow: 'authorized', deny: 'no_matching_grant', review: 'partial_scope',
    evaluation_failure: 'invalid_policy' }[decision],
  ...(policy.revision ? { policy_revision: policy.revision } : {}), duration_ms: 1 };
}

function metadata(kind) {
  return { kind, version: 1, passed: true, sources_stable: true, started_at: at,
    finished_at: '2026-10-19T12:01:00.000Z', duration_ms: 10000,
    environment: { platform: 'linux', architecture: 'x64', dependencies: dependencyPins,
      opa_binary: { pinned_version: opaPin.version, sha256: opaPin.assets['linux-x64'].sha256, matches_release_pin: true } },
    provenance: { sources: [], case_authorship: 'same-project-ai-assisted', external_validation: false } };
}

function offlineSummary(rows) {
  return Object.fromEntries(['protocol', 'structured'].map(strategy => {
    const selected = rows.filter(row => row.strategy === strategy);
    return [strategy, { ...scoreRows(selected), cold_total_cost: durationSummary(selected.map(row => row.total_ms)),
      accepted_cold_total_cost: durationSummary(selected.filter(row => row.mapping.status === 'accepted_partial').map(row => row.total_ms)) }];
  }));
}

function offlineFixture() {
  const rows = frozen.corpus.cases.flatMap(item => Object.entries(item.native).flatMap(([lane, native]) =>
    ['protocol', 'structured'].map(strategy => ({ id: item.id, base_intent: item.base_intent, scenario: item.scenario,
      lane, strategy, native, context: item.context, policy: item.policy, expected: item.expected,
      mapping: { ...item.expected.mapping, authority: 'not_evaluated', mapping_ms: 2 },
      authorization: authorization(item.expected.decision, item.policy), total_ms: 10 }))));
  const accepted = frozen.corpus.cases.filter(item => item.expected.mapping.status === 'accepted_partial');
  const diagnostics = accepted.map(item => ({ id: item.id, base_intent: item.base_intent, expected: item.expected,
    mapping: { status: 'accepted_partial', reason: 'declared_partial', authority: 'not_evaluated',
      projection: { ...item.expected.mapping.projection, body_sha256: '0'.repeat(64) } },
    authorization: authorization(item.expected.decision, item.policy) }));
  const report = metadata('runtime-pilot-offline');
  Object.assign(report.provenance, { case_manifest_sha256: frozen.manifest_sha256,
    counts: frozen.manifest.counts, freeze_ordering: frozen.manifest.ordering });
  return structuredClone({ ...report, rows, summary: offlineSummary(rows), upstream_interface_check: upstream,
    pure_authorization: accepted.map(item => ({ id: item.id, base_intent: item.base_intent,
      expected: item.expected.decision, actual: authorization(item.expected.decision, item.policy), matches: true })),
    diagnostic_lossy_projection: { rows: diagnostics, score: scoreRows(diagnostics) } });
}

function liveSummary(rows) {
  return Object.fromEntries(plan.strategies.map(strategy => {
    const selected = rows.filter(row => row.strategy === strategy);
    return [strategy, { scheduled_rows: selected.length, rows_passed: selected.filter(row => row.passed).length,
      immediate_confirmed: selected.filter(row => row.actual.outcome === 'confirmed').length,
      unknown_before_reconciliation: selected.filter(row => row.actual.outcome === 'unknown').length,
      reconciled_confirmed: selected.filter(row => row.recovery?.outcome === 'confirmed').length,
      duplicate_suppressed: selected.filter(row => row.actual.outcome === 'duplicate_suppressed').length,
      withheld: selected.filter(row => row.actual.outcome === 'withheld').length,
      normal_completion_cost: durationSummary(selected.filter(row => ['ascii', 'unicode'].includes(row.scenario)).map(row => row.total_ms)) }];
  }));
}

function liveFixture() {
  const report = { ...metadata('runtime-pilot-live'), run_id: runId,
    target: { repository: plan.repository, issue_number: 7, issue_url: `https://github.com/${plan.repository}/issues/7` },
    final_read_error: false, observations: { before_comment_count: 0, run_scoped_comment_count: 12, expected_new_comments: 12 } };
  report.provenance.plan_sha256 = planHash;
  const [owner, repo] = plan.repository.split('/');
  const context = { principal: 'fixture-user', data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' };
  const baseline = { revision: 'live-v1', principal: context.principal, revoked: false, allow_partial_direct: true,
    max_body_bytes: 8192, grants: [{ repository: plan.repository, issue_number: 7, data_class: 'synthetic-public' }] };
  const receipts = new Map();
  report.rows = plan.scenarios.flatMap((scenario, index) => (index % 2 ? [...plan.strategies].reverse() : plan.strategies)
    .flatMap(strategy => plan.lanes.map(lane => {
      const selected = scenario.reuses ?? scenario.id, key = `${strategy}-${lane}`;
      const occurrence = `${runId}-${key}-${selected}`;
      const body = `Synthetic interoperability test. action-effect-run:${runId}/${key}/${selected}${selected === 'unicode' ? '\nUnicode: \u{1F3AB} e\u0301.' : ''}`;
      const params = { owner, repo, issue_number: 7, body };
      const native = lane === 'sdk' ? { lane, call: params } : { lane, call: { name: 'add_issue_comment', arguments: params } };
      let policy = structuredClone(baseline);
      if (scenario.id === 'revoked') policy = { ...policy, revision: 'live-v2-revoked', revoked: true };
      if (scenario.id === 'narrowed') policy = { ...policy, revision: 'live-v2-narrowed', max_body_bytes: 1 };
      if (scenario.id === 'partial-review') policy = { ...policy, revision: 'live-v2-unknown', allow_partial_direct: false };
      if (scenario.id === 'invalid-policy') policy = {};
      const projection = { operation: 'create_issue_comment', repository: plan.repository, issue_number: 7,
        endpoint: `https://api.github.com/repos/${plan.repository}/issues/7/comments`,
        body_sha256: digestBytes(Buffer.from(body)), body_bytes: Buffer.byteLength(body), data_class: 'synthetic-public' };
      const actual = { outcome: scenario.expected_outcome,
        mapping: { status: 'accepted_partial', reason: 'declared_partial', authority: 'not_evaluated', projection, mapping_ms: 2 },
        authorization: authorization(scenario.expected_decision, policy), timings: { total_ms: 8, mapping_ms: 2 } };
      if (scenario.expected_authorization_reason) actual.authorization.reason = scenario.expected_authorization_reason;
      if (scenario.expected_reason) actual.reason = scenario.expected_reason;
      if (scenario.expected_fault) actual.fault = { [scenario.expected_fault]: true };
      let receipt;
      if (['ascii', 'unicode', 'lost-ack', 'duplicate'].includes(scenario.id)) {
        if (!receipts.has(occurrence)) {
          const id = 1001 + receipts.size;
          receipts.set(occurrence, { comment_id: id, url: `${report.target.issue_url}#issuecomment-${id}`,
            api_url: `https://api.github.com/repos/${plan.repository}/issues/comments/${id}`,
            issue_url: `https://api.github.com/repos/${plan.repository}/issues/7`, actor: context.principal,
            body_sha256: projection.body_sha256, body_bytes: projection.body_bytes, created_at: at, updated_at: at,
            content_matches: true, observation: 'fresh-current-content-not-complete-provider-provenance' });
        }
        receipt = receipts.get(occurrence);
      }
      if (scenario.expected_outcome === 'confirmed') actual.receipt = receipt;
      return { scenario: scenario.id, strategy, lane, occurrence, native, context, policy, expected: scenario, actual,
        ...(scenario.id === 'lost-ack' ? { recovery: { outcome: 'confirmed', automatic_resend: false, receipt, duration_ms: 1 } } : {}),
        observed_receipts: receipt ? [receipt] : [], total_ms: 10, passed: true };
    })));
  report.summary = liveSummary(report.rows);
  report.attempt_journal = { file: `runtime-pilot-live-attempt-${runId}.jsonl`, sha256: 'a'.repeat(64) };
  return structuredClone(report);
}

function journalFor(report) {
  const [owner, repo] = report.target.repository.split('/');
  return [
    { at, event: 'begin', run_id: report.run_id, target: { owner, repo, issue_number: report.target.issue_number },
      plan_sha256: report.provenance.plan_sha256, sources: report.provenance.sources },
    ...report.rows.flatMap(row => {
      const { observed_receipts, passed, ...beforeReadback } = row;
      return [{ at, event: 'scheduled', scenario: row.scenario, strategy: row.strategy, lane: row.lane,
        occurrence: row.occurrence, native: row.native, context: row.context, policy: row.policy },
      { at, event: 'result', ...beforeReadback }];
    }),
    { at, event: 'end', passed: report.passed, final_read_error: report.final_read_error,
      run_scoped_comment_count: report.observations.run_scoped_comment_count },
  ];
}

test('offline integrity derives 216 rows, both timing summaries, 26 references and 26 lossy diagnostics', () => {
  const report = offlineFixture();
  assert.equal(report.rows.length, 216);
  assert.equal(report.pure_authorization.length, 26);
  assert.doesNotThrow(() => replay.validateOfflineReport(report, frozen, upstream));
});

for (const [name, mutate, reason] of [
  ['summary score', r => { r.summary.protocol.mapping_exact--; }, /summary_mismatch/],
  ['timing aggregate', r => { r.summary.structured.cold_total_cost.mean_ms++; }, /summary_mismatch/],
  ['accepted timing aggregate', r => { r.summary.protocol.accepted_cold_total_cost.n--; }, /summary_mismatch/],
  ['negative row time', r => { r.rows[0].total_ms = -1; }, /invalid_timing/],
  ['missing row time', r => { delete r.rows[0].total_ms; }, /invalid_timing/],
  ['nonfinite nested time', r => { r.rows[0].authorization.duration_ms = Infinity; }, /invalid_timing/],
  ['impossible total time', r => { r.duration_ms = 1; }, /invalid_timing/],
  ['reference time exceeds run', r => { r.pure_authorization[0].actual.duration_ms = r.duration_ms + 1; }, /invalid_timing/],
  ['diagnostic time exceeds run', r => { r.diagnostic_lossy_projection.rows[0].authorization.duration_ms = r.duration_ms + 1; }, /invalid_timing/],
  ['combined reference times exceed run', r => { r.pure_authorization[0].actual.duration_ms = 5000;
    r.diagnostic_lossy_projection.rows[0].authorization.duration_ms = 5000; }, /invalid_timing/],
  ['missing references', r => { r.pure_authorization.pop(); }, /authorization_reference/],
  ['duplicate reference', r => { r.pure_authorization[1] = r.pure_authorization[0]; }, /authorization_reference/],
  ['reference label', r => { r.pure_authorization[0].expected = 'deny'; }, /authorization_reference/],
  ['reference match flag', r => { r.pure_authorization[0].matches = false; }, /authorization_reference/],
  ['reference base intent', r => { r.pure_authorization[0].base_intent = 'invented'; }, /authorization_reference/],
  ['missing diagnostic', r => { r.diagnostic_lossy_projection.rows.pop(); }, /diagnostic/],
  ['duplicate diagnostic', r => { r.diagnostic_lossy_projection.rows[1] = r.diagnostic_lossy_projection.rows[0]; }, /diagnostic/],
  ['uncorrupted diagnostic', r => { r.diagnostic_lossy_projection.rows[0].mapping.projection.body_sha256 = r.rows[0].mapping.projection.body_sha256; }, /diagnostic/],
  ['another lossy field', r => { r.diagnostic_lossy_projection.rows[0].mapping.projection.body_bytes++; }, /diagnostic/],
  ['diagnostic score', r => { r.diagnostic_lossy_projection.score.masked_mapping_errors = 0; }, /diagnostic/],
  ['upstream notification flag', r => { r.upstream_interface_check.notifications_declared = false; }, /upstream/],
  ['upstream provenance', r => { r.upstream_interface_check.source_commit = 'forged'; }, /upstream/],
  ['invented base intent', r => { r.rows[0].base_intent = 'invented'; }, /row_input_mismatch/],
  ['invented scenario', r => { r.rows[0].scenario = 'invented'; }, /row_input_mismatch/],
  ['manifest counts', r => { r.provenance.counts.cases++; }, /case_manifest/],
  ['freeze ordering', r => { r.provenance.freeze_ordering = 'external'; }, /case_manifest/],
  ['report version', r => { r.version = 2; }, /report_version/],
  ['OPA version', r => { r.environment.opa_binary.pinned_version = '0.0.0'; }, /environment/],
  ['OPA pin flag', r => { r.environment.opa_binary.matches_release_pin = false; }, /environment/],
  ['OPA binary checksum', r => { r.environment.opa_binary.sha256 = '0'.repeat(64); }, /environment/],
  ['dependency version', r => { r.environment.dependencies.ajv = '0.0.0'; }, /environment/],
  ['source flag', r => { r.sources_stable = false; }, /source_stability/],
  ['external validation flag', r => { r.provenance.external_validation = true; }, /provenance/],
  ['false pass flag', r => { r.passed = false; }, /passed_mismatch/],
]) test(`offline integrity rejects rehashed tampering: ${name}`, () => {
  const report = offlineFixture();
  mutate(report);
  assert.throws(() => replay.validateOfflineReport(report, frozen, upstream), reason);
});

test('authorization replay compares reasons and revisions, not just the decision; elapsed time is not reproduced', () => {
  const fresh = { decision: 'deny', reason: 'revoked', policy_revision: 'p1', duration_ms: 9 };
  assert.equal(replay.authorizationMatches({ ...fresh, duration_ms: 1 }, fresh), true);
  assert.equal(replay.authorizationMatches({ ...fresh, reason: 'body_too_large' }, fresh), false);
  assert.equal(replay.authorizationMatches({ ...fresh, policy_revision: 'p2' }, fresh), false);
  assert.equal(replay.authorizationMatches({ ...fresh, decision: 'evaluation_failure' }, fresh), false);
  assert.equal(replay.authorizationMatches({ ...fresh, duration_ms: -1 }, fresh), false);
});

test('a faithfully recorded failed offline benchmark is intact, not a forged passing result', () => {
  const report = offlineFixture();
  report.rows[0].mapping = { status: 'evaluation_failure', reason: 'adapter_failure', authority: 'not_evaluated' };
  report.rows[0].authorization = { decision: 'not_evaluated' };
  report.pure_authorization[0].actual = { decision: 'evaluation_failure', reason: 'opa_unavailable', policy_revision: 'p1', duration_ms: 1 };
  report.pure_authorization[0].matches = false;
  report.summary = offlineSummary(report.rows);
  report.passed = false;
  assert.equal(replay.validateOfflineReport(report, frozen, upstream).benchmark_passed, false);
});

test('a truthful source-instability failure is retained without source-stable or passing credit', () => {
  const report = offlineFixture();
  report.sources_stable = false;
  report.passed = false;
  assert.equal(replay.validateOfflineReport(report, frozen, upstream).benchmark_passed, false);
});

test('a truthful unavailable-OPA failure is not a forged release-pin claim', () => {
  const report = offlineFixture();
  report.environment.opa_binary.sha256 = null;
  report.environment.opa_binary.matches_release_pin = false;
  for (const row of report.rows) if (row.mapping.status === 'accepted_partial') {
    row.authorization = { decision: 'evaluation_failure', reason: 'opa_unavailable', policy_revision: row.policy.revision, duration_ms: 1 };
  }
  for (const row of report.pure_authorization) {
    row.actual = { decision: 'evaluation_failure', reason: 'opa_unavailable', policy_revision: 'p1', duration_ms: 1 };
    row.matches = false;
  }
  for (const row of report.diagnostic_lossy_projection.rows) {
    row.authorization = { decision: 'evaluation_failure', reason: 'opa_unavailable', policy_revision: 'p1', duration_ms: 1 };
  }
  report.diagnostic_lossy_projection.score = scoreRows(report.diagnostic_lossy_projection.rows);
  report.summary = offlineSummary(report.rows);
  report.passed = false;
  assert.equal(replay.validateOfflineReport(report, frozen, upstream).benchmark_passed, false);
});

test('reference replay independently evaluates all 26 original and 26 deliberately corrupted projections', () => {
  const report = offlineFixture(), accepted = frozen.corpus.cases.filter(item => item.expected.mapping.status === 'accepted_partial');
  let calls = 0;
  const evaluate = (projection, context, policy) => {
    const item = accepted[calls % accepted.length];
    assert.deepEqual(projection, calls < accepted.length ? item.expected.mapping.projection
      : { ...item.expected.mapping.projection, body_sha256: '0'.repeat(64) });
    assert.deepEqual(context, item.context);
    assert.deepEqual(policy, item.policy);
    calls++;
    return authorization(item.expected.decision, item.policy);
  };
  let checks = replay.reproduceOfflineReferences(report, frozen.corpus, evaluate);
  assert.equal(calls, 52);
  assert.equal(checks.length, 52);
  assert.equal(checks.every(row => row.reproduced), true);
  report.pure_authorization[0].actual.reason = 'forged_reason';
  report.diagnostic_lossy_projection.rows[0].authorization.decision = 'evaluation_failure';
  calls = 0;
  checks = replay.reproduceOfflineReferences(report, frozen.corpus, evaluate);
  assert.equal(checks[0].reproduced, false);
  assert.equal(checks[26].reproduced, false);
});

test('live integrity accepts 32 planned rows and 12 unique receipts, with ASCII receipts reused only for duplicates', () => {
  const report = liveFixture();
  assert.equal(report.rows.length, 32);
  assert.equal(new Set(report.rows.flatMap(row => row.observed_receipts.map(receipt => receipt.comment_id))).size, 12);
  assert.doesNotThrow(() => replay.validateLiveReport(report, plan, planHash));
  assert.doesNotThrow(() => replay.validateAttemptJournal(report, journalFor(report)));
});

test('additive preflight timing and recovery evidence remain bound to the exact journal result', () => {
  const report = liveFixture(), row = report.rows.find(item => item.scenario === 'lost-ack');
  row.actual.timings.preflight_ms = 1;
  row.recovery.recovery_evidence = 'synthetic-new-id-after-preflight';
  assert.equal(replay.validateLiveReport(report, plan, planHash).benchmark_passed, true);
  const journal = structuredClone(journalFor(report));
  assert.doesNotThrow(() => replay.validateAttemptJournal(report, journal));
  const result = journal.find(entry => entry.event === 'result' && entry.scenario === 'lost-ack');
  result.recovery.recovery_evidence = 'different-operator-assertion';
  assert.throws(() => replay.validateAttemptJournal(report, journal), /attempt_journal_content/);
  result.recovery.recovery_evidence = row.recovery.recovery_evidence;
  result.actual.timings.preflight_ms = 2;
  assert.throws(() => replay.validateAttemptJournal(report, journal), /attempt_journal_content/);
});

test('optional recovery evidence must be a string, not a structured proof claim', () => {
  const report = liveFixture();
  report.rows.find(row => row.scenario === 'lost-ack').recovery.recovery_evidence = { verified: true };
  assert.throws(() => replay.validateLiveReport(report, plan, planHash), /recovery_evidence/);
});

test('preflight time obeys the existing finite nonnegative row timing bounds', () => {
  const report = liveFixture(), timings = report.rows[0].actual.timings;
  for (const invalid of [-1, Infinity, NaN, report.rows[0].total_ms + 1]) {
    timings.preflight_ms = invalid;
    assert.throws(() => replay.validateLiveReport(report, plan, planHash), /invalid_timing/);
  }
});

test('a wrong returned POST ID remains a faithful failed observation even when receipt content matches the intent', () => {
  const report = liveFixture(), first = report.rows[0];
  first.actual.outcome = 'unknown';
  first.actual.reason = 'readback_mismatch';
  first.actual.receipt = { ...first.actual.receipt, comment_id: 9000, content_matches: false,
    api_url: `https://api.github.com/repos/${plan.repository}/issues/comments/9000`,
    url: `${report.target.issue_url}#issuecomment-9000` };
  for (const row of report.rows.slice(1)) {
    row.actual = { outcome: 'not_started', reason: 'prior_row_failed', authorization: { decision: 'not_evaluated' } };
    delete row.recovery;
    row.observed_receipts = row.occurrence === first.occurrence ? first.observed_receipts : [];
  }
  for (const row of report.rows) row.passed = false;
  report.summary = liveSummary(report.rows);
  report.observations.run_scoped_comment_count = 1;
  report.passed = false;
  assert.equal(replay.validateLiveReport(report, plan, planHash).benchmark_passed, false);
  assert.doesNotThrow(() => replay.validateAttemptJournal(report, journalFor(report)));
});

for (const [name, mutate, reason] of [
  ['target repository', r => { r.target.repository = 'other/repository'; }, /live_plan/],
  ['target issue', r => { r.target.issue_number++; }, /live_(target|row)/],
  ['target URL', r => { r.target.issue_url += '?redirect=elsewhere'; }, /live_target/],
  ['run ID', r => { r.run_id = 'another-run'; }, /live_run/],
  ['occurrence', r => { r.rows[0].occurrence += '-other'; }, /live_row/],
  ['native target', r => { r.rows[0].native.call.issue_number++; }, /live_row/],
  ['body marker', r => { r.rows[0].native.call.body += ' altered'; }, /live_row/],
  ['MCP tool', r => { r.rows[1].native.call.name = 'different_tool'; }, /live_row/],
  ['principal consistency', r => { r.rows[1].context.principal = 'another-user'; }, /live_row/],
  ['extra context', r => { r.rows[0].context.extra = true; }, /live_row/],
  ['baseline grant', r => { r.rows[0].policy.grants[0].issue_number++; }, /live_row/],
  ['revocation transform', r => { r.rows.find(row => row.scenario === 'revoked').policy.revoked = false; }, /live_row/],
  ['narrowing transform', r => { r.rows.find(row => row.scenario === 'narrowed').policy.max_body_bytes = 8192; }, /live_row/],
  ['partial transform', r => { r.rows.find(row => row.scenario === 'partial-review').policy.allow_partial_direct = true; }, /live_row/],
  ['invalid-policy transform', r => { r.rows.find(row => row.scenario === 'invalid-policy').policy = r.rows[0].policy; }, /live_row/],
  ['scenario label', r => { r.rows[0].expected.expected_outcome = 'unknown'; }, /live_row/],
  ['wrong authorization failure', r => { r.rows.find(row => row.scenario === 'invalid-policy').actual.authorization.reason = 'opa_unavailable'; }, /passed_mismatch/],
  ['wrong duplicate reason', r => { r.rows.find(row => row.scenario === 'duplicate').actual.reason = 'binding_mismatch'; }, /passed_mismatch/],
  ['missing injection witness', r => { delete r.rows.find(row => row.scenario === 'lost-ack').actual.fault; }, /passed_mismatch/],
  ['failed injection witness', r => { r.rows.find(row => row.scenario === 'lost-ack').actual.fault.successful_post_ack_discarded = false; }, /passed_mismatch/],
  ['row ordering', r => { [r.rows[0], r.rows[1]] = [r.rows[1], r.rows[0]]; }, /live_row/],
  ['receipt API URL', r => { r.rows[0].observed_receipts[0].api_url += '?other=1'; }, /receipt/],
  ['receipt issue URL', r => { r.rows[0].observed_receipts[0].issue_url += '0'; }, /receipt/],
  ['receipt actor', r => { r.rows[0].observed_receipts[0].actor = 'other-user'; }, /receipt/],
  ['receipt byte count', r => { r.rows[0].observed_receipts[0].body_bytes++; }, /receipt/],
  ['receipt body digest', r => { r.rows[0].observed_receipts[0].body_sha256 = '0'.repeat(64); }, /receipt/],
  ['receipt success flag', r => { r.rows[0].observed_receipts[0].content_matches = 1; }, /receipt/],
  ['receipt ID', r => { r.rows[0].observed_receipts[0].comment_id = 0; }, /receipt/],
  ['missing readback', r => { delete r.rows[0].observed_receipts; }, /receipt/],
  ['extra readback', r => { r.rows[0].observed_receipts.push(r.rows[0].observed_receipts[0]); }, /receipt/],
  ['receipt cross-occurrence reuse', r => { r.rows[1].observed_receipts = r.rows[0].observed_receipts; }, /receipt/],
  ['duplicate gets a new receipt', r => { const row = r.rows.find(item => item.scenario === 'duplicate'); row.observed_receipts[0] = { ...row.observed_receipts[0], comment_id: 9000,
    api_url: `https://api.github.com/repos/${plan.repository}/issues/comments/9000`, url: `${r.target.issue_url}#issuecomment-9000` }; }, /receipt/],
  ['immediate receipt differs from readback', r => { r.rows[0].actual.receipt = { ...r.rows[0].actual.receipt, comment_id: 9000,
    api_url: `https://api.github.com/repos/${plan.repository}/issues/comments/9000`, url: `${r.target.issue_url}#issuecomment-9000` }; }, /receipt/],
  ['reconciliation receipt differs', r => { r.rows.find(row => row.scenario === 'lost-ack').recovery.receipt = r.rows[0].observed_receipts[0]; }, /receipt/],
  ['automatic resend claim', r => { r.rows.find(row => row.scenario === 'lost-ack').recovery.automatic_resend = true; }, /reconciliation/],
  ['invented aggregate', r => { r.summary.protocol.immediate_confirmed++; }, /summary_mismatch/],
  ['invented live timing', r => { r.summary.structured.normal_completion_cost.maximum_ms++; }, /summary_mismatch/],
  ['negative live timing', r => { r.rows[0].total_ms = -1; }, /invalid_timing/],
  ['aggregate comment count', r => { r.observations.run_scoped_comment_count = 16; }, /observation_count/],
  ['claimed expected count', r => { r.observations.expected_new_comments = 16; }, /observation_count/],
  ['negative initial count', r => { r.observations.before_comment_count = -1; }, /observation_count/],
  ['failed final readback', r => { r.final_read_error = true; }, /final_read/],
  ['source-stable flag', r => { r.sources_stable = false; }, /source_stability/],
  ['row pass flag', r => { r.rows[0].passed = false; }, /passed_mismatch/],
]) test(`live integrity rejects rehashed tampering: ${name}`, () => {
  const report = liveFixture();
  mutate(report);
  assert.throws(() => replay.validateLiveReport(report, plan, planHash), reason);
});

test('a failed recovery retains the original unknown outcome and injection witness, without passing credit', () => {
  const report = liveFixture();
  const failed = report.rows.findIndex(row => row.scenario === 'lost-ack');
  report.rows[failed].recovery = { outcome: 'unknown', reason: 'reconciliation_failure', automatic_resend: false };
  for (const row of report.rows.slice(failed + 1)) {
    row.actual = { outcome: 'not_started', reason: 'prior_row_failed', authorization: { decision: 'not_evaluated' } };
    delete row.recovery;
    if (row.scenario !== 'duplicate') row.observed_receipts = [];
  }
  for (const row of report.rows) row.passed = matchesPlannedOutcome(row.actual, row.expected, row.recovery)
    && row.observed_receipts.length === (['ascii', 'unicode', 'lost-ack', 'duplicate'].includes(row.scenario) ? 1 : 0)
    && row.observed_receipts.every(receipt => receipt.content_matches);
  report.observations.run_scoped_comment_count = new Set(report.rows.flatMap(row => row.observed_receipts.map(receipt => receipt.comment_id))).size;
  report.summary = liveSummary(report.rows);
  report.passed = false;
  assert.equal(report.rows[failed].actual.outcome, 'unknown');
  assert.equal(report.rows[failed].actual.fault.successful_post_ack_discarded, true);
  assert.equal(replay.validateLiveReport(report, plan, planHash).benchmark_passed, false);
  assert.doesNotThrow(() => replay.validateAttemptJournal(report, journalFor(report)));
});

test('full replay can validate an internally consistent failed live attempt without running a provider or OPA', async t => {
  const report = liveFixture(), directory = mkdtempSync(join(tmpdir(), 'effect-failed-live-replay-'));
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('network_forbidden'); });
  report.provenance.sources = sourceSnapshot();
  for (const [index, row] of report.rows.entries()) {
    row.actual = index === 0
      ? { outcome: 'unknown', reason: 'harness_or_transport_failure', authorization: { decision: 'evaluation_failure' } }
      : { outcome: 'not_started', reason: 'prior_row_failed', authorization: { decision: 'not_evaluated' } };
    delete row.recovery;
    row.observed_receipts = [];
    row.passed = false;
  }
  report.summary = liveSummary(report.rows);
  report.observations.run_scoped_comment_count = 0;
  report.passed = false;
  const rawJournal = journalFor(report).map(entry => JSON.stringify(entry)).join('\n') + '\n';
  report.attempt_journal.sha256 = digestBytes(rawJournal);
  try {
    const path = saveReport('synthetic-failed-replay-test', report, directory);
    const journalPath = join(directory, report.attempt_journal.file);
    writeFileSync(journalPath, rawJournal);
    writeFileSync(`${journalPath}.sha256`, `${report.attempt_journal.sha256}  ${report.attempt_journal.file}\n`);
    const result = await replay.replayReport(path);
    assert.equal(result.valid, true);
    assert.equal(result.benchmark_passed, false);
    assert.equal(result.checked_rows, 32);
    assert.equal(result.checks.every(check => check.authorization_replayed === false), true);
    assert.equal(result.observations.length, 0);
    assert.equal(fetch.mock.callCount(), 0);
    writeFileSync(journalPath, `${rawJournal}{}\n`);
    await assert.rejects(replay.replayReport(path), /attempt_journal_checksum/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

for (const [name, mutate] of [
  ['missing result', rows => { rows.splice(2, 1); }],
  ['extra result', rows => { rows.splice(2, 0, rows[2]); }],
  ['swapped events', rows => { [rows[1], rows[2]] = [rows[2], rows[1]]; }],
  ['begin target', rows => { rows[0].target.issue_number++; }],
  ['begin source inventory', rows => { rows[0].sources = [{ path: 'invented', sha256: '0'.repeat(64) }]; }],
  ['scheduled native', rows => { rows[1].native.call.body = 'other'; }],
  ['result outcome', rows => { rows[2].actual.outcome = 'unknown'; }],
  ['result timing', rows => { rows[2].total_ms++; }],
  ['result contains later readback', rows => { rows[2].observed_receipts = []; }],
  ['end pass flag', rows => { rows.at(-1).passed = false; }],
  ['end observation count', rows => { rows.at(-1).run_scoped_comment_count = 0; }],
  ['invalid timestamp', rows => { rows[1].at = 'not-a-date'; }],
]) test(`journal integrity rejects rehashed content mismatch: ${name}`, () => {
  const report = liveFixture(), journal = structuredClone(journalFor(report));
  mutate(journal);
  assert.throws(() => replay.validateAttemptJournal(report, journal), /attempt_journal/);
});

test('internally consistent operator assertions are not cryptographic authentication', () => {
  const report = liveFixture();
  assert.doesNotThrow(() => replay.validateLiveReport(report, plan, planHash));
  assert.doesNotThrow(() => replay.validateAttemptJournal(report, journalFor(report)));
  assert.match(replay.REPLAY_TRUST_BOUNDARY, /not cryptographically authenticated/);
  assert.match(replay.REPLAY_TRUST_BOUNDARY, /current content/);
});

import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { digestBytes } from './artifacts.mjs';
import { durationSummary, mappingMatches, scoreRows } from './scoring.mjs';
import { matchesPlannedOutcome } from './live-run.mjs';

const opaPin = JSON.parse(readFileSync(new URL('./tools.json', import.meta.url))).opa;
const dependencies = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).dependencies;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
const duration = value => Number.isFinite(value) && value >= 0;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)
  && Number.isFinite(Date.parse(value));
export const validRunId = value => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export const REPLAY_TRUST_BOUNDARY = 'Rehashed or forged operator reports and attempt journals are not cryptographically authenticated. '
  + 'Checks establish internal consistency and reproducible local calculations, not historical fsync or provider execution. '
  + 'Public readback establishes only current content, not original execution, notification delivery or complete provider provenance.';

function requireThat(condition, reason) {
  if (!condition) throw new Error(reason);
}

function timers(value) {
  if (!record(value)) return;
  for (const [key, time] of Object.entries(value)) if (key.endsWith('_ms')) requireThat(duration(time), 'invalid_timing');
}

function metadata(report) {
  requireThat(report.version === 1, 'unsupported_report_version');
  requireThat(typeof report.sources_stable === 'boolean' && (!report.passed || report.sources_stable), 'source_stability_mismatch');
  requireThat(report.provenance?.external_validation === false
    && report.provenance.case_authorship === 'same-project-ai-assisted', 'report_provenance_mismatch');
  const env = report.environment, binary = env?.opa_binary;
  const pinMatches = typeof binary?.sha256 === 'string' && binary.sha256 === opaPin.assets[`${env?.platform}-${env?.architecture}`]?.sha256;
  requireThat(binary?.pinned_version === opaPin.version && binary.matches_release_pin === pinMatches
    && (binary.sha256 === null || /^[a-f0-9]{64}$/.test(binary.sha256)) && (!report.passed || pinMatches)
    && isDeepStrictEqual(env?.dependencies, dependencies), 'report_environment_mismatch');
  requireThat(timestamp(report.started_at) && timestamp(report.finished_at)
    && Date.parse(report.finished_at) >= Date.parse(report.started_at) && duration(report.duration_ms), 'invalid_timing');
  let total = 0;
  for (const row of report.rows) {
    requireThat(record(row) && duration(row.total_ms), 'invalid_timing');
    total += row.total_ms;
    for (const value of [row.mapping, row.authorization, row.actual?.mapping, row.actual?.authorization,
      row.actual?.timings, row.transport, row.recovery]) {
      timers(value);
      if (record(value)) for (const [key, time] of Object.entries(value)) {
        if (key.endsWith('_ms')) requireThat(time <= row.total_ms, 'invalid_timing');
      }
    }
  }
  // These rows run sequentially. Nested mapping/consumer timers overlap and are not summed.
  requireThat(total <= report.duration_ms, 'invalid_timing');
  return total;
}

export function authorizationMatches(recorded, fresh) {
  if (!record(recorded) || !record(fresh)) return false;
  const { duration_ms: recordedTime, ...recordedValue } = recorded;
  const { duration_ms: freshTime, ...freshValue } = fresh;
  return (recordedTime === undefined ? freshTime === undefined : duration(recordedTime) && duration(freshTime))
    && isDeepStrictEqual(recordedValue, freshValue);
}

export function validateOfflineReport(report, frozen, upstream) {
  const { corpus, manifest, manifest_sha256: manifestHash } = frozen;
  const expectedCount = corpus.cases.reduce((sum, item) => sum + Object.keys(item.native).length * 2, 0);
  requireThat(Array.isArray(report.rows) && report.rows.length === expectedCount, 'missing_or_extra_rows');
  let measuredTotal = metadata(report);
  requireThat(report.provenance.case_manifest_sha256 === manifestHash
    && isDeepStrictEqual(report.provenance.counts, manifest.counts)
    && report.provenance.freeze_ordering === manifest.ordering, 'case_manifest_mismatch');
  const cases = new Map(corpus.cases.map(item => [item.id, item])), seen = new Set();
  for (const row of report.rows) {
    const item = cases.get(row.id), key = `${row.id}/${row.lane}/${row.strategy}`;
    requireThat(item && Object.hasOwn(item.native, row.lane) && ['protocol', 'structured'].includes(row.strategy)
      && !seen.has(key), 'invalid_or_duplicate_row');
    seen.add(key);
    requireThat(row.base_intent === item.base_intent && row.scenario === item.scenario
      && isDeepStrictEqual(row.native, item.native[row.lane]) && isDeepStrictEqual(row.context, item.context)
      && isDeepStrictEqual(row.policy, item.policy) && isDeepStrictEqual(row.expected, item.expected), 'row_input_mismatch');
    requireThat(row.mapping?.authority === 'not_evaluated' && record(row.authorization), 'row_result_mismatch');
  }
  const summary = Object.fromEntries(['protocol', 'structured'].map(strategy => {
    const selected = report.rows.filter(row => row.strategy === strategy);
    return [strategy, { ...scoreRows(selected), cold_total_cost: durationSummary(selected.map(row => row.total_ms)),
      accepted_cold_total_cost: durationSummary(selected.filter(row => row.mapping.status === 'accepted_partial').map(row => row.total_ms)) }];
  }));
  requireThat(isDeepStrictEqual(report.summary, summary), 'summary_mismatch');

  const accepted = corpus.cases.filter(item => item.expected.mapping.status === 'accepted_partial');
  requireThat(Array.isArray(report.pure_authorization) && report.pure_authorization.length === accepted.length,
    'authorization_reference_count_mismatch');
  requireThat(Array.isArray(report.diagnostic_lossy_projection?.rows)
    && report.diagnostic_lossy_projection.rows.length === accepted.length, 'diagnostic_count_mismatch');
  for (const [index, item] of accepted.entries()) {
    const reference = report.pure_authorization[index], diagnostic = report.diagnostic_lossy_projection.rows[index];
    requireThat(reference?.id === item.id && reference.base_intent === item.base_intent
      && reference.expected === item.expected.decision && record(reference.actual)
      && reference.matches === (reference.actual.decision === item.expected.decision), 'authorization_reference_mismatch');
    requireThat(duration(reference.actual.duration_ms), 'invalid_timing');
    const lossy = { status: 'accepted_partial', reason: 'declared_partial', authority: 'not_evaluated',
      projection: { ...item.expected.mapping.projection, body_sha256: '0'.repeat(64) } };
    requireThat(diagnostic?.id === item.id && diagnostic.base_intent === item.base_intent
      && isDeepStrictEqual(diagnostic.expected, item.expected) && isDeepStrictEqual(diagnostic.mapping, lossy)
      && record(diagnostic.authorization), 'diagnostic_projection_mismatch');
    requireThat(duration(diagnostic.authorization.duration_ms), 'invalid_timing');
    measuredTotal += reference.actual.duration_ms + diagnostic.authorization.duration_ms;
  }
  requireThat(measuredTotal <= report.duration_ms, 'invalid_timing');
  requireThat(isDeepStrictEqual(report.diagnostic_lossy_projection.score, scoreRows(report.diagnostic_lossy_projection.rows)),
    'diagnostic_score_mismatch');
  requireThat(isDeepStrictEqual(report.upstream_interface_check, upstream), 'upstream_check_mismatch');
  const passed = report.sources_stable && report.rows.every(row => mappingMatches(row.mapping, row.expected.mapping)
    && row.authorization.decision === row.expected.decision) && report.pure_authorization.every(row => row.matches);
  requireThat(report.passed === passed, 'benchmark_passed_mismatch');
  return { benchmark_passed: passed, summary };
}

function receiptBinding(receipt, params, principal, rejectedResponseId = false) {
  requireThat(record(receipt) && typeof receipt.content_matches === 'boolean', 'receipt_mismatch');
  const base = `https://api.github.com/repos/${params.owner}/${params.repo}/issues`;
  const matches = Number.isSafeInteger(receipt.comment_id) && receipt.comment_id > 0
    && receipt.api_url === `${base}/comments/${receipt.comment_id}` && receipt.issue_url === `${base}/${params.issue_number}`
    && receipt.actor === principal && receipt.body_bytes === Buffer.byteLength(params.body)
    && receipt.body_sha256 === digestBytes(Buffer.from(params.body));
  // The expected POST response ID is not serialized into an intermediate receipt.
  requireThat((receipt.content_matches === matches || (rejectedResponseId && receipt.content_matches === false))
    && receipt.observation === 'fresh-current-content-not-complete-provider-provenance', 'receipt_mismatch');
  if (matches) requireThat(receipt.url === `https://github.com/${params.owner}/${params.repo}/issues/${params.issue_number}#issuecomment-${receipt.comment_id}`,
    'receipt_url_mismatch');
  return matches;
}

export function validateLiveReport(report, plan, planHash) {
  requireThat(report.provenance?.plan_sha256 === planHash && report.target?.repository === plan.repository, 'live_plan_mismatch');
  requireThat(validRunId(report.run_id), 'invalid_live_run_id');
  const issue = report.target.issue_number;
  requireThat(Number.isSafeInteger(issue) && issue > 0 && issue <= 2147483647
    && report.target.issue_url === `https://github.com/${plan.repository}/issues/${issue}`, 'live_target_mismatch');
  const slots = plan.scenarios.flatMap((scenario, index) => (index % 2 ? [...plan.strategies].reverse() : plan.strategies)
    .flatMap(strategy => plan.lanes.map(lane => ({ scenario, strategy, lane }))));
  requireThat(Array.isArray(report.rows) && report.rows.length === slots.length, 'missing_or_extra_rows');
  metadata(report);
  requireThat(typeof report.final_read_error === 'boolean' && (!report.passed || !report.final_read_error), 'final_read_mismatch');
  const [owner, repo] = plan.repository.split('/'), principal = report.rows[0]?.context?.principal;
  requireThat(typeof principal === 'string' && principal.length > 0, 'live_row_context_mismatch');
  const context = { principal, data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' };
  const baseline = { revision: 'live-v1', principal, revoked: false, allow_partial_direct: true, max_body_bytes: 8192,
    grants: [{ repository: plan.repository, issue_number: issue, data_class: 'synthetic-public' }] };
  const identities = new Map(), occurrences = new Map();
  let stopped = false;
  for (const [index, { scenario, strategy, lane }] of slots.entries()) {
    const row = report.rows[index], selected = scenario.reuses ?? scenario.id, key = `${strategy}-${lane}`;
    const occurrence = `${report.run_id}-${key}-${selected}`;
    const body = `Synthetic interoperability test. action-effect-run:${report.run_id}/${key}/${selected}${selected === 'unicode' ? '\nUnicode: \u{1F3AB} e\u0301.' : ''}`;
    const params = { owner, repo, issue_number: issue, body };
    const native = lane === 'sdk' ? { lane, call: params } : { lane, call: { name: 'add_issue_comment', arguments: params } };
    let policy = baseline;
    if (scenario.id === 'revoked') policy = { ...baseline, revision: 'live-v2-revoked', revoked: true };
    if (scenario.id === 'narrowed') policy = { ...baseline, revision: 'live-v2-narrowed', max_body_bytes: 1 };
    if (scenario.id === 'partial-review') policy = { ...baseline, revision: 'live-v2-unknown', allow_partial_direct: false };
    if (scenario.id === 'invalid-policy') policy = {};
    requireThat(row.scenario === scenario.id && row.strategy === strategy && row.lane === lane && row.occurrence === occurrence
      && isDeepStrictEqual(row.native, native) && isDeepStrictEqual(row.context, context)
      && isDeepStrictEqual(row.policy, policy) && isDeepStrictEqual(row.expected, scenario), 'live_row_input_mismatch');
    requireThat(record(row.actual), 'live_row_result_mismatch');
    requireThat(Array.isArray(row.observed_receipts), 'receipt_list_mismatch');
    const ids = new Set();
    for (const receipt of row.observed_receipts) {
      receiptBinding(receipt, params, principal);
      requireThat(Number.isSafeInteger(receipt.comment_id) && receipt.comment_id > 0 && !ids.has(receipt.comment_id), 'receipt_identity_mismatch');
      ids.add(receipt.comment_id);
      requireThat(!identities.has(receipt.comment_id) || identities.get(receipt.comment_id) === occurrence, 'receipt_occurrence_mismatch');
      identities.set(receipt.comment_id, occurrence);
    }
    requireThat(!occurrences.has(occurrence) || isDeepStrictEqual(occurrences.get(occurrence), row.observed_receipts), 'receipt_duplicate_mismatch');
    occurrences.set(occurrence, row.observed_receipts);
    for (const result of [row.actual, row.recovery]) {
      if (result && Object.hasOwn(result, 'recovery_evidence')) {
        requireThat(typeof result.recovery_evidence === 'string', 'recovery_evidence_mismatch');
      }
      if (result?.receipt) {
        receiptBinding(result.receipt, params, principal,
          result === row.actual && result.outcome === 'unknown' && result.reason === 'readback_mismatch');
        if (result.outcome === 'confirmed' && row.observed_receipts.length) {
          requireThat(ids.has(result.receipt.comment_id), 'receipt_result_mismatch');
        }
      }
    }
    if (row.actual.outcome === 'confirmed') requireThat(row.actual.receipt?.content_matches === true, 'receipt_confirmation_mismatch');
    if (row.recovery?.outcome === 'confirmed') requireThat(row.recovery.receipt?.content_matches === true
      && row.recovery.automatic_resend === false, 'reconciliation_receipt_mismatch');
    const expectedCount = ['ascii', 'unicode', 'lost-ack', 'duplicate'].includes(scenario.id) ? 1 : 0;
    const planned = matchesPlannedOutcome(row.actual, scenario, row.recovery);
    requireThat(row.passed === (planned && row.observed_receipts.length === expectedCount
      && row.observed_receipts.every(receipt => receipt.content_matches)), 'row_passed_mismatch');
    if (stopped) requireThat(isDeepStrictEqual(row.actual,
      { outcome: 'not_started', reason: 'prior_row_failed', authorization: { decision: 'not_evaluated' } }), 'live_row_stop_mismatch');
    if (!planned) stopped = true;
    if (row.transport) requireThat(isDeepStrictEqual(row.transport.result, row.actual), 'live_row_transport_mismatch');
  }
  requireThat(nonnegative(report.observations?.before_comment_count)
    && report.observations.expected_new_comments === plan.maximum_new_comments
    && report.observations.run_scoped_comment_count === identities.size, 'observation_count_mismatch');
  const summary = Object.fromEntries(plan.strategies.map(strategy => {
    const rows = report.rows.filter(row => row.strategy === strategy);
    return [strategy, { scheduled_rows: rows.length, rows_passed: rows.filter(row => row.passed).length,
      immediate_confirmed: rows.filter(row => row.actual.outcome === 'confirmed').length,
      unknown_before_reconciliation: rows.filter(row => row.actual.outcome === 'unknown').length,
      reconciled_confirmed: rows.filter(row => row.recovery?.outcome === 'confirmed').length,
      duplicate_suppressed: rows.filter(row => row.actual.outcome === 'duplicate_suppressed').length,
      withheld: rows.filter(row => row.actual.outcome === 'withheld').length,
      normal_completion_cost: durationSummary(rows.filter(row => ['ascii', 'unicode'].includes(row.scenario)).map(row => row.total_ms)) }];
  }));
  requireThat(isDeepStrictEqual(report.summary, summary), 'summary_mismatch');
  const passed = !report.final_read_error && report.sources_stable && report.rows.every(row => row.passed)
    && identities.size === plan.maximum_new_comments;
  requireThat(report.passed === passed, 'benchmark_passed_mismatch');
  return { benchmark_passed: passed, summary, unique_receipts: identities.size };
}

export function validateAttemptJournal(report, entries) {
  requireThat(Array.isArray(entries) && entries.length === report.rows.length * 2 + 2, 'attempt_journal_count_mismatch');
  const [owner, repo] = report.target.repository.split('/');
  const expected = [{ event: 'begin', run_id: report.run_id,
    target: { owner, repo, issue_number: report.target.issue_number }, plan_sha256: report.provenance.plan_sha256,
    sources: report.provenance.sources }];
  for (const row of report.rows) {
    expected.push({ event: 'scheduled', scenario: row.scenario, strategy: row.strategy, lane: row.lane,
      occurrence: row.occurrence, native: row.native, context: row.context, policy: row.policy });
    // The fsynced result precedes final readback, which adds exactly these two fields.
    const { observed_receipts, passed, ...beforeReadback } = row;
    expected.push({ event: 'result', ...beforeReadback });
  }
  expected.push({ event: 'end', passed: report.passed, final_read_error: report.final_read_error,
    run_scoped_comment_count: report.observations.run_scoped_comment_count });
  for (const [index, entry] of entries.entries()) {
    requireThat(record(entry) && timestamp(entry.at), 'attempt_journal_timestamp_mismatch');
    const { at, ...content } = entry;
    requireThat(isDeepStrictEqual(content, expected[index]), 'attempt_journal_content_mismatch');
  }
}

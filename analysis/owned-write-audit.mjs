import { readFileSync, realpathSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPublicValue, digestBytes, saveArtifact } from '../field-study/artifacts.mjs';

export const STUDY_SHA256 = '735bfdfc5c5ae993f64b6374ec599bf4ee76429dbcf995305cc2c9c3832ff6d7';
const STUDY_FILE = 'owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json';
const ROOT = 'https://api.github.com/repos/OndCo/Action-Effect-Bench';
const ISSUE = `${ROOT}/issues/2`, WEB = 'https://github.com/OndCo/Action-Effect-Bench/issues/2';
const IDS = [6268808655, 6268811053, 6268818220, 6268820402, 6268823718];
const URLS = [ISSUE, ...IDS.map(id => `${ROOT}/issues/comments/${id}`)];
const COMPONENTS = ['mapping_ms', 'consumer_ms', 'ledger_ms', 'principal_ms', 'preflight_ms', 'authority_ms', 'dispatch_ms', 'readback_ms'];
const MAX_RESPONSE = 128 * 1024;
const check = (condition, code) => { if (!condition) throw new Error(code); };
const count = (values, predicate) => values.filter(predicate).length;
const validCost = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function stats(values) {
  const present = values.filter(value => value !== undefined && value !== null);
  check(present.every(validCost), 'invalid_cost');
  const sum = present.length ? present.reduce((a, b) => a + b, 0) : null;
  return { denominator: values.length, observed: present.length, missing: values.length - present.length,
    sum, mean: present.length ? sum / present.length : null,
    min: present.length ? Math.min(...present) : null, max: present.length ? Math.max(...present) : null };
}
function binding(value, kind) {
  check(value && Number.isSafeInteger(value.id) && typeof value.body === 'string'
    && typeof value.url === 'string' && typeof value.html_url === 'string'
    && Number.isSafeInteger(value.user?.id) && typeof value.user.login === 'string', 'invalid_content_binding');
  return { kind, id: value.id, api_url: value.url, url: value.html_url,
    user: { id: value.user.id, login: value.user.login }, body_sha256: digestBytes(value.body), body_bytes: Buffer.byteLength(value.body),
    ...(kind === 'issue' ? { number: value.number } : { issue_url: value.issue_url }) };
}

/** expectedSha256 is injectable for synthetic unit fixtures; the publishing CLI never overrides the pin. */
export function auditOwnedWrite(raw, { expectedSha256 = STUDY_SHA256 } = {}) {
  check(digestBytes(raw) === expectedSha256, 'study_checksum_mismatch');
  const report = JSON.parse(Buffer.from(raw).toString('utf8'));
  assertPublicValue(report);
  check(report.format === 'action-effect-owned-write-study/1' && report.status === 'recorded', 'study_format');
  const { manifest, phases, cases, current_comments: comments } = report;
  check(manifest.target.owner === 'OndCo' && manifest.target.repo === 'Action-Effect-Bench'
    && manifest.target.issue_number === 2, 'study_target');
  const scenarios = new Map(manifest.plan.scenarios.map(s => [s.id, s]));
  const references = cases.flatMap(c => [c.initial_phase, c.recovery_phase, c.duplicate_phase].filter(Boolean));
  check(scenarios.size === cases.length && new Set(phases.map(p => p.id)).size === phases.length
    && new Set(references).size === references.length && references.length === phases.length
    && phases.every(p => references.includes(p.id) && scenarios.has(p.scenario_id)
      && ['execute', 'reconcile', 'probe'].includes(p.mode) && p.id === `${p.scenario_id}.${p.mode}`), 'phase_inventory');
  check(comments.length === IDS.length && new Set(comments.map(c => c.id)).size === IDS.length
    && comments.every(c => IDS.includes(c.id)), 'comment_inventory');
  const issue = binding(manifest.setup.issue, 'issue');
  check(issue.api_url === ISSUE && issue.url === WEB && issue.number === 2 && issue.user.login === manifest.principal, 'study_target');
  const commitments = [{ source: 'manifest.setup.issue', scenario_id: null, synthetic: false, expected: issue }];
  for (const id of IDS) {
    const comment = comments.find(c => c.id === id), expected = binding(comment, 'comment');
    const matches = manifest.plan.scenarios.filter(s => s.reference_projection.body_sha256 === expected.body_sha256);
    check(matches.length === 1, 'comment_commitment');
    const scenario = matches[0], args = scenario.lane === 'sdk' ? scenario.native.call : scenario.native.call.arguments;
    check(args.body === comment.body && scenario.reference_projection.body_bytes === expected.body_bytes
      && expected.api_url === `${ROOT}/issues/comments/${id}` && expected.url === `${WEB}#issuecomment-${id}`
      && expected.issue_url === ISSUE && expected.user.login === manifest.principal, 'comment_commitment');
    commitments.push({ source: 'current_comments + manifest.plan.scenarios.reference_projection', scenario_id: scenario.id,
      synthetic: scenario.fault !== 'none', expected });
  }
  const receipts = phases.flatMap(p => p.result?.receipt ? [p.result.receipt] : []);
  for (const receipt of receipts) {
    const expected = commitments.find(c => c.expected.id === receipt.comment_id)?.expected;
    check(expected && receipt.content_matches === true && receipt.body_sha256 === expected.body_sha256
      && receipt.body_bytes === expected.body_bytes && receipt.url === expected.url && receipt.api_url === expected.api_url
      && receipt.issue_url === ISSUE && receipt.actor === expected.user.login, 'receipt_commitment');
  }
  const execute = phases.filter(p => p.mode === 'execute'), recovery = phases.filter(p => p.mode === 'reconcile');
  const probe = phases.filter(p => p.mode === 'probe'), gatePhases = [...execute, ...probe];
  check(phases.every(p => validCost(p.process.elapsed_ms)) && validCost(report.total_duration_ms), 'invalid_cost');
  const phaseWall = stats(phases.map(p => p.process.elapsed_ms));
  const outside = report.total_duration_ms - phaseWall.sum;
  check(outside >= 0, 'invalid_cost');
  const phaseRows = phases.map(p => ({ id: p.id, scenario_id: p.scenario_id, mode: p.mode,
    scenario_lane: scenarios.get(p.scenario_id).lane, native_lane: p.mode === 'execute' ? scenarios.get(p.scenario_id).lane : 'sdk',
    synthetic_control: scenarios.get(p.scenario_id).fault !== 'none', outcome: p.result?.outcome ?? 'process-killed',
    phase_wall_ms: p.process.elapsed_ms, gate_ms: p.result?.timings?.total_ms ?? null,
    recovery_ms: p.mode === 'reconcile' ? p.result?.duration_ms ?? null : null,
    journal_complete: p.journal.complete, components_ms: p.result?.timings ?? null }));
  const paired = Object.fromEntries(['protocol', 'structured'].map(strategy => {
    const values = phases.map(p => p.stored?.preparations?.find(v => v.strategy === strategy));
    return [strategy, { mapping_ms: stats(values.map(v => v?.prepared.mapping_ms)),
      consumer_ms: stats(values.map(v => v?.prepared.consumer_ms)), authority_ms: stats(values.map(v => v?.authority.duration_ms)) }];
  }));
  const mappings = gatePhases.flatMap(p => p.result?.mapping ? [p.result.mapping] : []);
  const candidates = manifest.plan.candidates;
  return {
    format: 'action-effect-owned-write-audit/1', run_id: report.run_id,
    input_report: { file: STUDY_FILE, sha256: digestBytes(raw), published_checksum_pin: digestBytes(raw) === STUDY_SHA256 },
    counts: { cases: cases.length, normal_cases: count([...scenarios.values()], s => s.fault === 'none'),
      synthetic_control_cases: count([...scenarios.values()], s => s.fault !== 'none'), phases: phases.length,
      completed_phase_results: count(phases, p => p.result !== null), killed_phases: count(phases, p => p.process.planned_kill),
      sealed_journals: count(phases, p => p.journal.complete), partial_journals: count(phases, p => !p.journal.complete),
      candidates: candidates.length, eligible_candidates: count(candidates, c => c.eligible), withheld_candidates: count(candidates, c => !c.eligible),
      comment_objects: comments.length, useful_output_comments: count(commitments, c => c.scenario_id !== null && !c.synthetic),
      synthetic_control_comments: count(commitments, c => c.synthetic), write_permits: report.write_permits.length,
      comment_call_ceiling: manifest.plan.max_comment_calls, confirmed_receipts: receipts.length,
      duplicate_probes: probe.length, suppressed_probes: count(probe, p => p.result?.outcome === 'duplicate_suppressed'),
      recovery_attempts: recovery.length, recovered_confirmed: count(recovery, p => p.result?.outcome === 'confirmed'),
      recovery_unknown: count(recovery, p => p.result?.outcome === 'unknown') },
    initial_outcomes: Object.fromEntries(['confirmed', 'withheld', 'unknown', 'process-killed'].map(outcome =>
      [outcome, count(execute, p => (p.result?.outcome ?? 'process-killed') === outcome)])),
    costs: { units: 'milliseconds', run_wall_ms: report.total_duration_ms, phase_wall_ms: phaseWall, outside_workers_ms: outside,
      execute: { phase_wall_ms: stats(execute.map(p => p.process.elapsed_ms)), gate_ms: stats(execute.map(p => p.result?.timings?.total_ms)),
        components_ms: Object.fromEntries(COMPONENTS.map(key => [key, stats(execute.map(p => p.result?.timings?.[key]))])) },
      recovery: { phase_wall_ms: stats(recovery.map(p => p.process.elapsed_ms)), routine_ms: stats(recovery.map(p => p.result?.duration_ms)) },
      probe: { phase_wall_ms: stats(probe.map(p => p.process.elapsed_ms)), gate_ms: stats(probe.map(p => p.result?.timings?.total_ms)) },
      paired_preparation: paired,
      scope: 'Recorded durations, not monetary costs. Missing killed-worker results are not zero-cost samples. Worker wall time includes setup and paired preparation; gate and recovery timers are nested. Consumer time is nested in mapping time. Do not sum nested timers. Outside-worker time is unattributed supervisor/read/journal work. Synthetic waits and unequal tasks prohibit a performance superiority claim.' },
    observation_boundaries: {
      mapping_results: { denominator: gatePhases.length, observed: mappings.length, missing: gatePhases.length - mappings.length,
        accepted_partial: count(mappings, m => m.status === 'accepted_partial'), accepted_full: count(mappings, m => m.status === 'accepted_full'),
        direct_partial_descriptions: count(mappings, m => m.description?.coverage?.scope === 'direct' && m.description.coverage.completeness === 'partial') },
      complete_provider_effects_observed: false, performance_superiority_claim: false,
      provider_wire_attempt_count: report.scopes.provider_wire_attempt_count,
      recorded_automatic_resend: report.scopes.automatic_resend,
      new_model_requests_in_study: report.scopes.new_model_requests,
      scope: 'Arithmetic over the pinned study, not another runner replay. Paired preparation observations are related, not independent tasks. Complete journals and exact current comment bodies do not establish full effect coverage: notifications, webhooks and internal descendants remain unobserved. Recovery remains unknown without unique readback. The two useful-output comments are selected maintainer outputs, not independently validated usefulness or human review. Public GETs establish current content, not execution provenance, original authority, internet outage, wire POST count, or global exactly-once delivery.' },
    phase_rows: phaseRows, commitments,
  };
}

/** HTTPS has no automatic redirect or retry here; no credential or proxy environment is consulted. */
export async function anonymousGet(url, { request = httpsRequest } = {}) {
  check(URLS.includes(url), 'public_url_not_allowed');
  return new Promise((resolveReply, reject) => {
    let req, timer, settled = false;
    const finish = (error, reply) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolveReply(reply);
    };
    const fail = code => { finish(new Error(code)); req?.destroy(); };
    try {
      req = request(url, { method: 'GET', agent: false, rejectUnauthorized: true, headers: {
        Accept: 'application/vnd.github+json', 'User-Agent': 'action-effect-owned-write-audit',
        'X-GitHub-Api-Version': '2022-11-28', 'Accept-Encoding': 'identity',
      } }, response => {
        const chunks = [];
        let size = 0;
        response.on('data', chunk => {
          size += chunk.length;
          if (size > MAX_RESPONSE) { fail('public_response_too_large'); return; }
          chunks.push(Buffer.from(chunk));
        });
        response.once('error', () => fail('public_network_error'));
        response.once('aborted', () => fail('public_network_error'));
        response.once('end', () => finish(null, { status: response.statusCode, body: Buffer.concat(chunks) }));
      });
      req.once('error', () => fail('public_network_error'));
      timer = setTimeout(() => fail('public_timeout'), 20000);
      req.end();
    } catch { fail('public_network_error'); }
  });
}

export async function observePublic(audit, { get = anonymousGet, now = () => new Date().toISOString() } = {}) {
  const result = { status: 'observing', matched_issue: false, matched_comments: 0, requests: [],
    scope: 'Anonymous fixed-origin GitHub GETs compare current content to a raw study commitment, not execution provenance. No credentials, redirects, retries, mutations, or comment-list pagination.' };
  try {
    check(audit.commitments.length === URLS.length
      && audit.commitments.every((c, i) => c.expected.api_url === URLS[i]), 'public_url_not_allowed');
    for (const commitment of audit.commitments) {
      const expected = commitment.expected;
      const row = { method: 'GET', url: expected.api_url, requested_at: now(), observed_at: null,
        status: null, raw_response_utf8: null, response_sha256: null, response_bytes: null, expected, actual: null };
      result.requests.push(row);
      const response = await get(expected.api_url);
      row.observed_at = now();
      const bytes = Buffer.from(response.body);
      row.status = response.status;
      row.raw_response_utf8 = bytes.toString('utf8');
      row.response_sha256 = digestBytes(bytes);
      row.response_bytes = bytes.length;
      check(response.status === 200, 'public_http_status');
      check(bytes.length <= MAX_RESPONSE && Buffer.from(row.raw_response_utf8).equals(bytes), 'public_invalid_response');
      let value;
      try { value = JSON.parse(row.raw_response_utf8); row.actual = binding(value, expected.kind); }
      catch { throw new Error('public_invalid_response'); }
      check(JSON.stringify(row.actual) === JSON.stringify(expected), 'public_commitment_mismatch');
      if (expected.kind === 'issue') result.matched_issue = true;
      else result.matched_comments += 1;
    }
    result.status = 'matched';
    return result;
  } catch (error) {
    const allowed = ['public_url_not_allowed', 'public_http_status', 'public_invalid_response', 'public_commitment_mismatch',
      'public_response_too_large', 'public_timeout', 'public_network_error'];
    const code = allowed.includes(error?.message) ? error.message : 'public_network_error';
    result.status = 'failed';
    result.failure = code;
    throw Object.assign(new Error(code), { public_observation: result });
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), publicRead = args.includes('--public');
  const paths = args.filter(arg => arg !== '--public');
  check(paths.length <= 1 && args.length === paths.length + Number(publicRead)
    && paths.every(path => !path.startsWith('-')), 'usage: owned-write-audit.mjs [pinned-study.json] [--public]');
  const reports = fileURLToPath(new URL('../reports/', import.meta.url)), input = resolve(reports, STUDY_FILE);
  check(!paths.length || resolve(paths[0]) === input, 'study_path_mismatch');
  const audit = auditOwnedWrite(readFileSync(input));
  audit.created_at = new Date().toISOString();
  audit.source = { file: 'analysis/owned-write-audit.mjs', sha256: digestBytes(readFileSync(fileURLToPath(import.meta.url))) };
  audit.public_observation = { status: 'not_requested', requests: [] };
  if (publicRead) {
    try { audit.public_observation = await observePublic(audit); }
    catch (error) { audit.public_observation = error.public_observation; process.exitCode = 1; }
  }
  const artifact = saveArtifact(reports, 'owned-write-audit', audit);
  console.log(JSON.stringify({ ...artifact, counts: audit.counts, costs_ms: {
    run: audit.costs.run_wall_ms, workers: audit.costs.phase_wall_ms.sum, execute_gate_observed: audit.costs.execute.gate_ms.sum,
    recovery_routine: audit.costs.recovery.routine_ms.sum, probe_gate: audit.costs.probe.gate_ms.sum,
  }, public_status: audit.public_observation.status, public_gets: audit.public_observation.requests.length }, null, 2));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { digestBytes } from '../field-study/artifacts.mjs';

const api = await import('./owned-write-audit.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('/analysis/owned-write-audit.mjs')) return {};
  throw error;
});
const invoke = (name, ...args) => {
  assert.equal(typeof api[name], 'function', `${name} must be implemented`);
  return api[name](...args);
};
const ROOT = 'https://api.github.com/repos/OndCo/Action-Effect-Bench';
const ISSUE = `${ROOT}/issues/2`;
const WEB = 'https://github.com/OndCo/Action-Effect-Bench/issues/2';
const IDS = [6268808655, 6268811053, 6268818220, 6268820402, 6268823718];
const UTC = '2026-10-19T15:00:00.000Z';

function fixture() {
  const owner = { id: 67523717, login: 'jw-ond' };
  const current_comments = IDS.map((id, i) => ({ id, url: `${ROOT}/issues/comments/${id}`,
    html_url: `${WEB}#issuecomment-${id}`, issue_url: ISSUE, user: { ...owner }, body: `fixture ${i}: \u00e9\n` }));
  const issue = { id: 5924829067, number: 2, url: ISSUE, html_url: WEB, user: { ...owner }, body: 'Fixture issue.\n' };
  const faults = ['none', 'none', 'revoke-after-preflight', 'narrow-after-preflight',
    'crash-before-send', 'crash-after-reply', 'timeout-after-reply', 'disconnect-after-reply'];
  const outcomes = ['confirmed', 'confirmed', 'withheld', 'withheld', null, null, 'unknown', 'unknown'];
  const commentByScenario = [0, 1, null, null, null, 2, 3, 4];
  const phases = [], cases = [];
  const scenarios = faults.map((fault, i) => {
    const id = `scenario-${i}`, lane = i % 2 ? 'mcp' : 'sdk';
    const body = current_comments[commentByScenario[i]]?.body ?? `no comment ${i}\n`;
    const args = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2, body };
    const scenario = { id, lane, fault, native: { lane, call: lane === 'sdk' ? args : { name: 'add_issue_comment', arguments: args } },
      reference_projection: { body_sha256: digestBytes(body), body_bytes: Buffer.byteLength(body) } };
    const add = (mode, outcome, elapsed, duration) => {
      let result = outcome === null ? null : { outcome };
      if (result && mode !== 'reconcile') result = { ...result, mapping: { status: 'accepted_partial',
        description: { coverage: { scope: 'direct', completeness: 'partial' } } },
      timings: { mapping_ms: 2, consumer_ms: 1, total_ms: duration,
        ...(mode === 'execute' ? { authority_ms: 1 } : {}),
        ...(mode === 'execute' && outcome !== 'withheld' ? { dispatch_ms: 4 } : {}) } };
      if (mode === 'reconcile') result = { ...result, duration_ms: duration, automatic_resend: false };
      if (outcome === 'confirmed') {
        const c = current_comments[commentByScenario[i]];
        result.receipt = { comment_id: c.id, url: c.html_url, api_url: c.url, issue_url: ISSUE,
          actor: c.user.login, body_sha256: digestBytes(c.body), body_bytes: Buffer.byteLength(c.body), content_matches: true };
      }
      phases.push({ id: `${id}.${mode}`, scenario_id: id, mode, process: { elapsed_ms: elapsed, planned_kill: result === null },
        result, journal: { valid: true, complete: result !== null }, stored: result && { preparations: ['protocol', 'structured'].map(strategy => ({
          strategy, prepared: { status: 'accepted_partial', mapping_ms: 3, consumer_ms: 2 }, authority: { duration_ms: 1 },
        })) } });
    };
    add('execute', outcomes[i], 100, 50);
    if (i >= 4) add('reconcile', i === 4 ? 'unknown' : 'confirmed', 20, 10);
    add('probe', 'duplicate_suppressed', 10, 5);
    cases.push({ scenario_id: id, initial_phase: `${id}.execute`, recovery_phase: i >= 4 ? `${id}.reconcile` : null,
      duplicate_phase: `${id}.probe` });
    return scenario;
  });
  return { format: 'action-effect-owned-write-study/1', status: 'recorded', run_id: 'fixture-owned-write',
    manifest: { principal: owner.login, target: { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2 },
      setup: { issue, initial_comments: [] }, plan: { scenarios, max_comment_calls: 12,
        candidates: Array.from({ length: 6 }, (_, i) => ({ eligible: i < 2 })) } },
    cases, phases, current_comments, write_permits: IDS.map((_, slot) => ({ slot })), total_duration_ms: 1000,
    scopes: { new_model_requests: 0, provider_wire_attempt_count: 'not_measured', automatic_resend: false } };
}
function audit(report = fixture()) {
  const raw = Buffer.from(JSON.stringify(report));
  return invoke('auditOwnedWrite', raw, { expectedSha256: digestBytes(raw) });
}
function responses(report) {
  return new Map([report.manifest.setup.issue, ...report.current_comments].map(value => [value.url, value]));
}

test('keeps phase, gate, recovery, probe and partial-observation denominators separate', () => {
  const result = audit();
  assert.deepEqual(result.counts, { cases: 8, normal_cases: 2, synthetic_control_cases: 6, phases: 20,
    completed_phase_results: 18, killed_phases: 2, sealed_journals: 18, partial_journals: 2,
    candidates: 6, eligible_candidates: 2, withheld_candidates: 4, comment_objects: 5,
    useful_output_comments: 2, synthetic_control_comments: 3, write_permits: 5, comment_call_ceiling: 12,
    confirmed_receipts: 5, duplicate_probes: 8, suppressed_probes: 8, recovery_attempts: 4, recovered_confirmed: 3,
    recovery_unknown: 1 });
  assert.deepEqual(result.costs.execute.gate_ms, { denominator: 8, observed: 6, missing: 2, sum: 300, mean: 50, min: 50, max: 50 });
  assert.equal(result.costs.execute.components_ms.dispatch_ms.observed, 4);
  assert.equal(result.costs.recovery.routine_ms.sum, 40);
  assert.equal(result.costs.probe.gate_ms.sum, 40);
  assert.equal(result.costs.phase_wall_ms.sum, 960);
  assert.equal(result.costs.outside_workers_ms, 40);
  assert.equal(result.costs.paired_preparation.protocol.mapping_ms.denominator, 20);
  assert.equal(result.costs.paired_preparation.protocol.mapping_ms.observed, 18);
  assert.equal(result.observation_boundaries.mapping_results.denominator, 16);
  assert.equal(result.observation_boundaries.mapping_results.accepted_partial, 14);
  assert.equal(result.observation_boundaries.mapping_results.accepted_full, 0);
  assert.equal(result.observation_boundaries.mapping_results.missing, 2);
  assert.equal(result.observation_boundaries.complete_provider_effects_observed, false);
  assert.equal(result.observation_boundaries.performance_superiority_claim, false);
});

test('published input checksum is fixed and mismatched bytes fail before JSON parsing', () => {
  assert.equal(api.STUDY_SHA256, '735bfdfc5c5ae993f64b6374ec599bf4ee76429dbcf995305cc2c9c3832ff6d7');
  assert.throws(() => invoke('auditOwnedWrite', Buffer.from('not JSON')), /study_checksum_mismatch/);
});

for (const [label, change, reason] of [
  ['duplicate phase', r => r.phases.push(r.phases[0]), 'phase_inventory'],
  ['negative cost', r => { r.phases[0].result.timings.total_ms = -1; }, 'invalid_cost'],
  ['changed commitment', r => { r.current_comments[0].body += 'changed'; }, 'comment_commitment'],
  ['wrong issue', r => { r.manifest.target.issue_number = 1; }, 'study_target'],
  ['wrong comment inventory', r => { r.current_comments[0].id = 7; }, 'comment_inventory'],
]) test(`rejects fixture ${label}`, () => {
  const report = fixture(); change(report);
  assert.throws(() => audit(report), new RegExp(reason));
});

test('public observation retains six raw responses, hashes and UTC times with exact content bindings', async () => {
  const report = fixture(), values = responses(report), requested = [];
  const result = await invoke('observePublic', audit(report), { now: () => UTC, get: async url => {
    requested.push(url);
    return { status: 200, body: Buffer.from(`${JSON.stringify(values.get(url))}\n`) };
  } });
  assert.deepEqual(requested, [ISSUE, ...IDS.map(id => `${ROOT}/issues/comments/${id}`)]);
  assert.equal(result.matched_comments, 5);
  assert.equal(result.matched_issue, true);
  assert.equal(result.requests.length, 6);
  for (const row of result.requests) {
    assert.equal(row.observed_at, UTC);
    assert.equal(row.response_sha256, digestBytes(row.raw_response_utf8));
    assert.deepEqual(row.actual, row.expected);
  }
  assert.match(result.scope, /current content.*not.*provenance/i);
});

for (const [label, change] of [
  ['body', c => { c.body += 'changed'; }], ['ID', c => { c.id += 1; }],
  ['URL', c => { c.html_url = c.html_url.replace('/issues/2', '/issues/1'); }],
  ['user login', c => { c.user.login = 'someone-else'; }], ['user ID', c => { c.user.id += 1; }],
]) test(`public ${label} mismatch rejects and retains failure evidence without more GETs`, async () => {
  const report = fixture(), result = audit(report), values = responses(structuredClone(report));
  change(values.get(`${ROOT}/issues/comments/${IDS[0]}`));
  let calls = 0;
  await assert.rejects(() => invoke('observePublic', result, { now: () => UTC, get: async url => {
    calls += 1; return { status: 200, body: Buffer.from(JSON.stringify(values.get(url))) };
  } }), error => {
    assert.equal(error.message, 'public_commitment_mismatch');
    assert.equal(error.public_observation.requests.length, 2);
    assert.equal(error.public_observation.requests[1].observed_at, UTC);
    return true;
  });
  assert.equal(calls, 2);
});

test('redirect and HTTP failure are retained and never followed or retried', async () => {
  for (const status of [301, 403]) {
    let calls = 0;
    await assert.rejects(() => invoke('observePublic', audit(), { now: () => UTC, get: async () => {
      calls += 1; return { status, body: Buffer.from('{"message":"fixture refusal"}') };
    } }), /public_http_status/);
    assert.equal(calls, 1);
  }
});

test('anonymous transport permits only the six literal URLs and sends no credentials or redirects', async () => {
  let calls = 0;
  const request = (url, options, onResponse) => {
    calls += 1;
    assert.equal(url, ISSUE);
    assert.deepEqual(options, { method: 'GET', agent: false, rejectUnauthorized: true, headers: {
      Accept: 'application/vnd.github+json', 'User-Agent': 'action-effect-owned-write-audit',
      'X-GitHub-Api-Version': '2022-11-28', 'Accept-Encoding': 'identity',
    } });
    const req = new EventEmitter();
    req.end = () => queueMicrotask(() => onResponse(Object.assign(Readable.from([Buffer.from('{}')]), { statusCode: 200 })));
    req.destroy = error => req.emit('error', error);
    return req;
  };
  const reply = await invoke('anonymousGet', ISSUE, { request });
  assert.equal(reply.body.toString(), '{}');
  for (const url of [ISSUE.replace('https:', 'http:'), `${ISSUE}?x=1`, `${ISSUE}/comments`,
    ISSUE.replace('/2', '/1'), ISSUE.replace('api.github.com', 'example.com'), `${ROOT}/issues/comments/7`]) {
    await assert.rejects(async () => invoke('anonymousGet', url, { request }), /public_url_not_allowed/);
  }
  assert.equal(calls, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildWritePlan } from '../write-plan.mjs';

const reportFile = 'field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json';
const evidenceRef = '7306d8b45402bb2ee7f9a1fbaf7203835e599110';
const sourceUrl = `https://github.com/OndCo/Action-Effect-Bench/blob/${evidenceRef}/reports/${reportFile}`;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sourceBytes = readFileSync(new URL(`../../reports/${reportFile}`, import.meta.url));
const sourceReport = JSON.parse(sourceBytes);
const sourceReview = JSON.parse(readFileSync(new URL('../../analysis/review-second-field-use.json', import.meta.url)));
const inventory = [
  ['T1', 'release-integrity', 'sdk', 'completed', 5168, 'complete'],
  ['T2', 'clean-clone-quickstart', 'mcp', 'failed', 6272, 'partial'],
  ['T3', 'consumer-v1-1-migration', 'sdk', 'failed', 7051, 'partial'],
  ['T4', 'official-mcp-compatibility', 'mcp', 'completed', 5997, 'complete'],
  ['T5', 'limits-and-recovery', 'sdk', 'failed', 6267, 'partial'],
  ['T6', 'conformance-support', 'mcp', 'failed', 6454, 'partial'],
];
const scenarioRows = [
  ['normal-release-integrity', 'sdk', 'protocol', 'none', 'confirmed', null, 'allow', null, 1],
  ['normal-official-mcp-compatibility', 'mcp', 'structured', 'none', 'confirmed', null, 'allow', null, 1],
  ['fault-revoked', 'mcp', 'protocol', 'revoke-after-preflight', 'withheld', 'revoked', 'deny', null, 0],
  ['fault-narrowed', 'sdk', 'structured', 'narrow-after-preflight', 'withheld', 'body_too_large', 'deny', null, 0],
  ['fault-pre-send-crash', 'sdk', 'protocol', 'crash-before-send', 'process-killed', null, 'allow', 'unknown', 0],
  ['fault-post-reply-crash', 'mcp', 'protocol', 'crash-after-reply', 'process-killed', null, 'allow', 'confirmed', 1],
  ['fault-sdk-timeout', 'sdk', 'structured', 'timeout-after-reply', 'unknown', 'provider_or_readback_failure', 'allow', 'confirmed', 1],
  ['fault-mcp-disconnect', 'mcp', 'protocol', 'disconnect-after-reply', 'unknown', 'provider_or_readback_failure', 'allow', 'confirmed', 1],
];

function fixture() {
  return structuredClone({ report: sourceReport, review: sourceReview,
    target: { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2 },
    principal: 'fixture-user', runId: 'owned-write-2026-10-19.fixture' });
}

function params(scenario) {
  return scenario.lane === 'sdk' ? scenario.native.call : scenario.native.call.arguments;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Boundary fixtures keep correspondence fields honest; they are not new approved evidence.
function changeOutput(input, index, change) {
  const row = input.report.tasks[index], reviewed = input.review.tasks[index];
  const output = JSON.parse(row.result.finalOutput);
  change(output);
  row.result.finalOutput = JSON.stringify(output);
  const bytes = Buffer.byteLength(output.report_markdown);
  reviewed.lengths.report_markdown_bytes = bytes;
  reviewed.lengths.final_output_text_bytes = Buffer.byteLength(row.result.finalOutput);
  reviewed.lengths.markdown_within_frozen_budget = bytes <= 6000;
  reviewed.lengths.markdown_within_comment_profile_budget = bytes <= 8192;
  reviewed.format_deviation.markdown_exceeds_frozen_byte_budget = bytes > 6000;
  reviewed.format_deviation.original_delivery_compliance = bytes <= 6000 ? 'met' : 'not_met';
  reviewed.citations.urls = [...output.citations];
  reviewed.citations.count = output.citations.length;
  if (row.result.status === 'completed') row.mechanical_checks.body_bytes = bytes;
  reviewed.mechanical_checks_recorded = structuredClone(row.mechanical_checks);
  return output;
}

test('exports the pure owned-write plan builder', () => {
  assert.equal(typeof buildWritePlan, 'function');
});

test('uses the actual immutable second report as the fixture', () => {
  assert.equal(sha256(sourceBytes), 'e6d9fe0e27ca93932fb9102cc5d5b7f16e4c7c138cd72c79eeeaaf1cb2961999');
  assert.equal(sourceReview.provenance.original_report.raw_sha256, sha256(sourceBytes));
});

test('returns the fixed six-candidate and eight-executable population with separate ceilings', () => {
  const input = fixture(), plan = buildWritePlan(input);
  assert.deepEqual(Object.keys(plan).sort(), ['format', 'target', 'principal', 'run_id', 'candidates',
    'scenarios', 'max_comment_calls', 'expected_comment_objects'].sort());
  assert.equal(plan.format, 'action-effect-owned-write-plan/1');
  assert.deepEqual(plan.target, input.target);
  assert.equal(plan.principal, input.principal);
  assert.equal(plan.run_id, input.runId);
  assert.equal(plan.max_comment_calls, 12);
  assert.equal(plan.expected_comment_objects, 5);
  assert.equal(plan.candidates.length, 6);
  assert.equal(plan.scenarios.length, 8);
  assert.equal(plan.scenarios.reduce((sum, row) => sum + row.expected.new_comments, 0), 5);
});

for (const [index, [label, id, lane, status, bytes, grade]] of inventory.entries()) {
  test(`retains ${label} identity, original outcome, mechanical labels and eligibility`, () => {
    const input = fixture(), candidate = buildWritePlan(input).candidates[index];
    const eligible = status === 'completed';
    const output = JSON.parse(input.report.tasks[index].result.finalOutput);
    assert.deepEqual(candidate, {
      id, label, lane, original_outcome: { status, reason: eligible ? 'final_output' : 'report_bytes_exceeded' },
      eligible, withheld_reason: eligible ? null : 'report_bytes_exceeded',
      report_object_sha256: sha256(JSON.stringify(output)), report_markdown_bytes: bytes,
      internal_review_grade: grade, original_mechanical_checks: input.report.tasks[index].mechanical_checks,
    });
    if (!eligible) {
      assert.equal(candidate.original_mechanical_checks.quality, 'no_result');
      assert.equal(candidate.original_mechanical_checks.body_bytes, null);
      assert.equal(candidate.original_mechanical_checks.report_schema_valid, false);
      assert.ok(!Object.hasOwn(candidate, 'native'));
      assert.ok(!Object.hasOwn(candidate, 'occurrence'));
    }
  });
}

test('selects only the two completed actual outputs and never schedules a withheld report', () => {
  const plan = buildWritePlan(fixture());
  assert.deepEqual(plan.candidates.filter(row => row.eligible).map(row => row.id),
    ['release-integrity', 'official-mcp-compatibility']);
  assert.deepEqual(plan.scenarios.filter(row => row.fault === 'none').map(row => row.id),
    ['normal-release-integrity', 'normal-official-mcp-compatibility']);
  for (const row of plan.candidates.filter(row => !row.eligible)) {
    assert.ok(!plan.scenarios.some(scenario => scenario.id === `normal-${row.id}`));
  }
});

for (const [index, expectedRow] of scenarioRows.entries()) {
  const [id, lane, strategy, fault, initial_outcome, reason, decision, recovery_outcome, new_comments] = expectedRow;
  test(`constructs ${id} in order with exact native, context, expectation and literal reference fields`, () => {
    const input = fixture(), scenario = buildWritePlan(input).scenarios[index];
    assert.deepEqual(Object.keys(scenario).sort(), ['id', 'lane', 'strategy', 'fault', 'occurrence',
      'native', 'context', 'reference_projection', 'expected'].sort());
    assert.deepEqual([scenario.id, scenario.lane, scenario.strategy, scenario.fault], [id, lane, strategy, fault]);
    assert.equal(scenario.occurrence, `${input.runId}.${id}`);
    assert.deepEqual(scenario.expected, { initial_outcome, reason, decision, recovery_outcome, new_comments });
    const call = params(scenario);
    assert.deepEqual(Object.keys(call).sort(), ['owner', 'repo', 'issue_number', 'body'].sort());
    assert.deepEqual(call, { ...input.target, body: call.body });
    assert.deepEqual(scenario.native, lane === 'sdk' ? { lane, call }
      : { lane, call: { name: 'add_issue_comment', arguments: call } });
    const dataClass = fault === 'none' ? 'public-maintainer-draft' : 'synthetic-public';
    assert.deepEqual(scenario.context, { principal: input.principal, data_class: dataClass,
      implementation: 'github-comment-bridge/1' });
    assert.deepEqual(scenario.reference_projection, {
      operation: 'create_issue_comment', repository: 'OndCo/Action-Effect-Bench', issue_number: 2,
      endpoint: 'https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/2/comments',
      body_sha256: sha256(Buffer.from(call.body, 'utf8')), body_bytes: Buffer.byteLength(call.body, 'utf8'),
      data_class: dataClass,
    });
    assert.ok(Buffer.byteLength(call.body, 'utf8') <= 8192);
  });
}

for (const [scenarioIndex, sourceIndex] of [[0, 0], [1, 3]]) {
  test(`normal ${inventory[sourceIndex][0]} embeds every original byte with honest internal-review provenance`, () => {
    const input = fixture(), plan = buildWritePlan(input), scenario = plan.scenarios[scenarioIndex];
    const body = params(scenario).body, output = JSON.parse(input.report.tasks[sourceIndex].result.finalOutput);
    const original = Buffer.from(output.report_markdown, 'utf8');
    const start = Buffer.from(body, 'utf8').indexOf(original);
    assert.ok(start >= 0);
    assert.deepEqual(Buffer.from(body, 'utf8').subarray(start, start + original.length), original);
    assert.ok(body.includes(output.conclusion));
    let position = body.indexOf(output.conclusion) + output.conclusion.length;
    for (const url of output.citations) {
      const next = body.indexOf(url, position);
      assert.ok(next >= position);
      position = next + url.length;
    }
    assert.ok(body.includes(sourceUrl));
    assert.ok(body.includes(output.task_id));
    assert.ok(body.includes(sha256(JSON.stringify(output))));
    assert.ok(body.includes(scenario.occurrence));
    assert.match(body, /internal maintainer working result/i);
    assert.match(body, /same-project AI-assisted source review/i);
    assert.match(body, /not independent endorsement or a whole-system pass/i);
    assert.doesNotMatch(body, /Not published|Requires maintainer approval before dispatch/);
  });
}

test('fault notes are explicit synthetic controls, unique by occurrence, not extra useful model tasks', () => {
  const input = fixture(), plan = buildWritePlan(input), faults = plan.scenarios.slice(2);
  assert.equal(faults.length, 6);
  for (const scenario of faults) {
    const body = params(scenario).body;
    assert.match(body, /synthetic control note/i);
    assert.match(body, /not a useful model task/i);
    assert.ok(body.includes(scenario.id));
    assert.ok(body.includes(scenario.fault));
    assert.ok(body.includes(scenario.occurrence));
    for (const row of input.report.tasks) assert.ok(!body.includes(JSON.parse(row.result.finalOutput).report_markdown));
  }
  assert.equal(new Set(plan.scenarios.map(row => row.id)).size, 8);
  assert.equal(new Set(plan.scenarios.map(row => row.occurrence)).size, 8);
  assert.equal(new Set(plan.scenarios.map(row => params(row).body)).size, 8);
});

test('is deterministic with deeply frozen inputs and has no cross-call mutable state', () => {
  const input = freeze(fixture()), before = JSON.stringify(input), first = buildWritePlan(input);
  assert.deepEqual(first, buildWritePlan(input));
  assert.equal(JSON.stringify(input), before);
  first.target.issue_number = 99;
  first.scenarios[0].native.call.body = 'changed returned plan';
  first.scenarios[0].context.principal = 'other';
  first.scenarios[0].expected.new_comments = 99;
  first.candidates[0].original_mechanical_checks.quality = 'rewritten';
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(buildWritePlan(input), buildWritePlan(fixture()));
});

test('a fresh run changes every occurrence and body binding without changing the population', () => {
  const input = fixture(), first = buildWritePlan(input);
  input.runId = 'another-run';
  const second = buildWritePlan(input);
  assert.deepEqual(first.candidates, second.candidates);
  for (const [index, row] of second.scenarios.entries()) {
    assert.notEqual(row.occurrence, first.scenarios[index].occurrence);
    assert.notEqual(row.reference_projection.body_sha256, first.scenarios[index].reference_projection.body_sha256);
  }
});

for (const issueNumber of [2, 2147483647]) {
  test(`accepts issue ${issueNumber} and derives every endpoint from the native target`, () => {
    const input = fixture(); input.target.issue_number = issueNumber;
    for (const row of buildWritePlan(input).scenarios) {
      assert.equal(params(row).issue_number, issueNumber);
      assert.equal(row.reference_projection.issue_number, issueNumber);
      assert.equal(row.reference_projection.endpoint,
        `https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/${issueNumber}/comments`);
    }
  });
}

for (const issueNumber of [undefined, null, true, '2', 0, -1, 1, 2.5, 2147483648, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
  test(`rejects invalid or legacy issue number ${String(issueNumber)}`, () => {
    const input = fixture(); input.target.issue_number = issueNumber;
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

for (const principal of ['OndCo', 'A', 'A'.repeat(39), 'provider-user-7']) {
  test(`accepts a safe provider login of length ${principal.length} without normalizing it`, () => {
    const input = fixture(); input.principal = principal;
    assert.ok(buildWritePlan(input).scenarios.every(row => row.context.principal === principal));
  });
}

for (const principal of [undefined, null, 3, {}, '', '-user', 'A'.repeat(40), 'a_b', 'a/b', 'a.b', 'a b', 'a\n', 'a\r', '\u00e9', 'a[bot]']) {
  test(`rejects unsafe provider login ${JSON.stringify(principal)}`, () => {
    const input = fixture(); input.principal = principal;
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

for (const runId of ['a', '2026-10-19T07-15-38.744Z_a76953f1', 'A'.repeat(64)]) {
  test(`accepts a safe run ID of length ${runId.length} with bounded ledger-compatible occurrences`, () => {
    const input = fixture(); input.runId = runId;
    for (const row of buildWritePlan(input).scenarios) {
      assert.equal(row.occurrence, `${runId}.${row.id}`);
      assert.match(row.occurrence, /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
      assert.ok(Buffer.byteLength(row.occurrence, 'utf8') <= 120);
    }
  });
}

for (const runId of [undefined, null, 3, {}, '', 'A'.repeat(65), '../run', '-run', 'a/b', 'a\\b', 'a:b', 'a b', 'a\n', 'a\r', 'a\0', '\u4e00']) {
  test(`rejects unsafe run ID ${JSON.stringify(runId)}`, () => {
    const input = fixture(); input.runId = runId;
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

const mutations = [
  ['absent input', () => undefined],
  ['null input', () => null],
  ['extra dispatch instructions', input => { input.execute = true; }],
  ['null target', input => { input.target = null; }],
  ['array target', input => { input.target = ['OndCo', 'Action-Effect-Bench', 2]; }],
  ['different owner', input => { input.target.owner = 'Other'; }],
  ['case-normalized owner', input => { input.target.owner = 'ondco'; }],
  ['different repository', input => { input.target.repo = 'Action-Effect-Spec'; }],
  ['absent target field', input => { delete input.target.repo; }],
  ['extra target body', input => { input.target.body = 'override'; }],
  ['target endpoint override', input => { input.target.endpoint = 'https://example.com'; }],
  ['null report', input => { input.report = null; }],
  ['wrong report format', input => { input.report.format = 'field-study-use/2'; }],
  ['wrong population', input => { input.report.population = 'other-study'; }],
  ['unrecorded report', input => { input.report.status = 'running'; }],
  ['changed source inventory', input => { input.report.source_inventory_unchanged = false; }],
  ['missing report tasks', input => { delete input.report.tasks; }],
  ['extra report task', input => { input.report.tasks.push(structuredClone(input.report.tasks[0])); }],
  ['omitted report task', input => { input.report.tasks.pop(); }],
  ['duplicate report task', input => { input.report.tasks[1] = structuredClone(input.report.tasks[0]); }],
  ['reordered report tasks', input => { input.report.tasks.reverse(); }],
  ['changed task ID', input => { input.report.tasks[0].id = 'other'; }],
  ['changed task lane', input => { input.report.tasks[0].lane = 'mcp'; }],
  ['rewritten failed status', input => { input.report.tasks[1].result.status = 'completed'; }],
  ['changed successful status', input => { input.report.tasks[0].result.status = 'failed'; }],
  ['changed failure reason', input => { input.report.tasks[1].result.reason = 'timeout'; }],
  ['changed completion reason', input => { input.report.tasks[0].result.reason = 'manually_accepted'; }],
  ['extra task-level eligibility', input => { input.report.tasks[1].eligible = true; }],
  ['extra result authorization', input => { input.report.tasks[1].result.authorized = true; }],
  ['missing final output', input => { delete input.report.tasks[0].result.finalOutput; }],
  ['changed mechanical failure label', input => { input.report.tasks[1].mechanical_checks.quality = 'complete'; }],
  ['falsified report summary', input => { input.report.summary.completed_task_loops = 6; }],
  ['extra report write grant', input => { input.report.grants = [input.target]; }],
  ['null review', input => { input.review = null; }],
  ['wrong review version', input => { input.review.version = 2; }],
  ['first review substituted', input => { input.review.id = 'review-first-field-use'; }],
  ['different evidence file', input => { input.review.provenance.original_report.path = 'reports/other.json'; }],
  ['unpinned evidence ref', input => { input.review.provenance.original_report.ref = 'main'; }],
  ['different evidence digest', input => { input.review.provenance.original_report.raw_sha256 = '0'.repeat(64); }],
  ['different evidence byte count', input => { input.review.provenance.original_report.byte_length++; }],
  ['different evidence repository', input => { input.review.provenance.original_report.repository = 'Other/Repo'; }],
  ['claimed independent reviewer', input => { input.review.actor.independent_external_reviewer = true; }],
  ['claimed human reviewer', input => { input.review.actor.human_reviewer = true; }],
  ['claimed external validation', input => { input.review.scope.external_validation = true; }],
  ['wrong review population count', input => { input.review.scope.task_count = 7; }],
  ['missing review tasks', input => { delete input.review.tasks; }],
  ['extra review task', input => { input.review.tasks.push(structuredClone(input.review.tasks[0])); }],
  ['omitted review task', input => { input.review.tasks.pop(); }],
  ['duplicate review task', input => { input.review.tasks[1] = structuredClone(input.review.tasks[0]); }],
  ['reordered review tasks', input => { input.review.tasks.reverse(); }],
  ['wrong review task label', input => { input.review.tasks[0].label = 'T4'; }],
  ['wrong review lane', input => { input.review.tasks[0].lane = 'mcp'; }],
  ['wrong review loop status', input => { input.review.tasks[0].loop_status = 'failed'; }],
  ['wrong review loop reason', input => { input.review.tasks[1].loop_reason = 'final_output'; }],
  ['wrong nested review outcome', input => { input.review.tasks[1].loop_outcome.status = 'completed'; }],
  ['reviewed automatic retry', input => { input.review.tasks[1].loop_outcome.automatic_retry = true; }],
  ['review points to another output', input => { input.review.tasks[0].report_evidence.json_pointer = '/tasks/3/result/finalOutput'; }],
  ['review mechanical mismatch', input => { input.review.tasks[1].mechanical_checks_recorded.quality = 'not_reviewed'; }],
  ['reviewed body byte mismatch', input => { input.review.tasks[0].lengths.report_markdown_bytes++; }],
  ['reviewed envelope byte mismatch', input => { input.review.tasks[0].lengths.final_output_text_bytes++; }],
  ['relaxed report budget', input => { input.review.tasks[1].lengths.frozen_maximum_report_bytes = 8192; }],
  ['false failed-body budget compliance', input => { input.review.tasks[1].lengths.markdown_within_frozen_budget = true; }],
  ['false JSON shape approval', input => { input.review.tasks[0].format_deviation.parsed_envelope_shape_valid = false; }],
  ['false original compliance', input => { input.review.tasks[1].format_deviation.original_delivery_compliance = 'met'; }],
  ['changed citation list', input => { input.review.tasks[0].citations.urls[0] = 'https://example.com'; }],
  ['changed citation count', input => { input.review.tasks[0].citations.count++; }],
  ['unobserved review citations', input => { input.review.tasks[0].citations.all_observed = false; }],
  ['missing review facts', input => { input.review.tasks[0].facts = []; }],
  ['omitted review fact', input => { input.review.tasks[0].facts.pop(); }],
  ['duplicate review fact', input => { input.review.tasks[0].facts[1] = structuredClone(input.review.tasks[0].facts[0]); }],
  ['reordered review facts', input => { input.review.tasks[0].facts.reverse(); }],
  ['invented fact ID', input => { input.review.tasks[0].facts[0].id = 'other'; }],
  ['unknown fact status', input => { input.review.tasks[0].facts[0].status = 'approved'; }],
  ['incomplete T1 despite claimed complete grade', input => { input.review.tasks[0].facts[0].status = 'partial'; }],
  ['incorrect T4 despite claimed complete grade', input => { input.review.tasks[3].facts[0].status = 'incorrect'; }],
  ['regraded retained T5 omission', input => { input.review.tasks[4].facts[0].status = 'met'; }],
  ['regraded retained T6 omission', input => { input.review.tasks[5].facts[3].status = 'met'; }],
  ['missing review quotation', input => { input.review.tasks[0].facts[0].evidence_quotes = []; }],
  ['invented review quotation', input => { input.review.tasks[0].facts[0].evidence_quotes = ['not present in the report']; }],
  ['forged failed report grade', input => { input.review.tasks[1].overall_report_grade = 'complete'; }],
  ['changed completed report grade', input => { input.review.tasks[0].overall_report_grade = 'partial'; }],
  ['forged grade summary', input => { input.review.overall_report_grading.derived_report_grades.T2 = 'complete'; }],
  ['forged review totals', input => { input.review.totals.overall_report_grades.complete = 6; }],
  ['forged fact totals', input => { input.review.totals.fact_statuses.met = 30; }],
  ['claimed actual human acceptance', input => { input.review.tasks[0].human_acceptance = 'accepted'; }],
  ['extra review permission', input => { input.review.tasks[1].permission_to_write = true; }],
];

for (const [name, change] of mutations) {
  test(`rejects ${name} instead of adapting the approved plan`, () => {
    let input = fixture();
    const replacement = change(input);
    if (name === 'absent input' || name === 'null input') input = replacement;
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

for (const [name, value] of [
  ['null', 'null'], ['array', '[]'], ['malformed JSON', '{'], ['raw Markdown', '# Report'],
  ['fenced JSON', '```json\n{}\n```'], ['concatenated JSON', '{}{}'],
]) {
  test(`rejects ${name} in a retained finalOutput`, () => {
    const input = fixture(); input.report.tasks[0].result.finalOutput = value;
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

for (const [name, change] of [
  ['missing report field', value => { delete value.conclusion; }],
  ['extra report field', value => { value.approved = true; }],
  ['wrong original task ID', value => { value.task_id = 'official-mcp-compatibility'; }],
  ['non-string Markdown', value => { value.report_markdown = 3; }],
  ['blank Markdown', value => { value.report_markdown = ' \r\n'; }],
  ['blank conclusion', value => { value.conclusion = ' \n'; }],
  ['non-string conclusion', value => { value.conclusion = false; }],
  ['non-array citations', value => { value.citations = 'https://github.com'; }],
  ['non-string citation', value => { value.citations = [3]; }],
  ['unpaired Markdown surrogate', value => { value.report_markdown += '\ud800'; }],
  ['unpaired conclusion surrogate', value => { value.conclusion += '\udfff'; }],
  ['unpaired citation surrogate', value => { value.citations[0] += '\ud800'; }],
]) {
  test(`rejects ${name} in the exact original report schema`, () => {
    const input = fixture(), value = JSON.parse(input.report.tasks[0].result.finalOutput);
    change(value);
    input.report.tasks[0].result.finalOutput = JSON.stringify(value);
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

for (const key of ['task_id', 'ta\\u0073k_id']) {
  test(`rejects duplicate JSON member ${key} rather than accepting JSON.parse last-wins`, () => {
    const input = fixture(), row = input.report.tasks[0];
    row.result.finalOutput = `{"${key}":"forged",${row.result.finalOutput.slice(1)}`;
    input.review.tasks[0].lengths.final_output_text_bytes = Buffer.byteLength(row.result.finalOutput);
    assert.throws(() => buildWritePlan(input), /write_plan_report_schema/);
  });
}

test('preserves leading/trailing whitespace, CRLF and Unicode without normalization', () => {
  const input = fixture();
  const output = changeOutput(input, 0, value => {
    value.report_markdown = ` \r\n${value.report_markdown}\r\n e\u0301 \u00e9 \ud83e\uddea  `;
    value.conclusion = ` \n${value.conclusion}\r\n  `;
  });
  const plan = buildWritePlan(input), body = params(plan.scenarios[0]).body;
  assert.ok(body.includes(output.report_markdown));
  assert.ok(body.includes(output.conclusion));
  assert.equal(plan.candidates[0].report_object_sha256, sha256(JSON.stringify(output)));
  assert.equal(plan.scenarios[0].reference_projection.body_sha256, sha256(Buffer.from(body, 'utf8')));
});

test('allows exactly 6000 UTF-8 report bytes', () => {
  const input = fixture();
  const output = changeOutput(input, 3, value => { value.report_markdown += '\u00e9x'; });
  assert.equal(Buffer.byteLength(output.report_markdown), 6000);
  const plan = buildWritePlan(input);
  assert.equal(plan.candidates[3].eligible, true);
  assert.ok(params(plan.scenarios[1]).body.includes(output.report_markdown));
});

test('rejects 6001 UTF-8 report bytes even when the claimed loop completed and character count fits', () => {
  const input = fixture();
  const output = changeOutput(input, 3, value => { value.report_markdown += '\u00e9\u00e9'; });
  assert.equal(Buffer.byteLength(output.report_markdown), 6001);
  assert.ok(output.report_markdown.length < 6000);
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

test('rejects shortening a retained failed body rather than promoting or silently rewriting it', () => {
  const input = fixture();
  changeOutput(input, 1, value => { value.report_markdown = 'shortened failed output'; });
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

test('allows exactly 8192 rendered UTF-8 bytes with the entire original conclusion', () => {
  const input = fixture(), initial = buildWritePlan(input);
  const padding = 8192 - Buffer.byteLength(params(initial.scenarios[1]).body);
  assert.ok(padding > 0);
  const output = changeOutput(input, 3, value => { value.conclusion += 'x'.repeat(padding); });
  const body = params(buildWritePlan(input).scenarios[1]).body;
  assert.equal(Buffer.byteLength(body), 8192);
  assert.ok(body.includes(output.conclusion));
});

test('rejects 8193 rendered bytes rather than trimming or rewriting the source', () => {
  const input = fixture(), initial = buildWritePlan(input);
  const padding = 8193 - Buffer.byteLength(params(initial.scenarios[1]).body);
  changeOutput(input, 3, value => { value.conclusion += 'x'.repeat(padding); });
  const before = JSON.stringify(input);
  assert.throws(() => buildWritePlan(input), /write_plan_comment_bytes/);
  assert.equal(JSON.stringify(input), before);
});

test('the final rendered bound counts UTF-8 bytes, not JavaScript code units', () => {
  const input = fixture(), initial = buildWritePlan(input);
  const padding = 8192 - Buffer.byteLength(params(initial.scenarios[1]).body);
  changeOutput(input, 3, value => { value.conclusion += 'x'.repeat(padding) + '\u00e9'; });
  assert.throws(() => buildWritePlan(input), /write_plan_comment_bytes/);
});

test('rejects inherited target authority', () => {
  const input = fixture(); input.target = Object.create(input.target);
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

test('does not invoke accessors in supposedly immutable JSON input', () => {
  const input = fixture(); let reads = 0;
  Object.defineProperty(input.report.tasks[1].result, 'status', {
    enumerable: true, get() { reads++; return 'completed'; },
  });
  assert.throws(() => buildWritePlan(input), /write_plan_/);
  assert.equal(reads, 0);
});

test('does not invoke toJSON hooks to obtain a different write population', () => {
  const input = fixture(); let calls = 0;
  input.review.toJSON = () => { calls++; return sourceReview; };
  assert.throws(() => buildWritePlan(input), /write_plan_/);
  assert.equal(calls, 0);
});

test('rejects sparse population arrays instead of skipping missing tasks', () => {
  const input = fixture(); delete input.report.tasks[1];
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

test('rejects symbol-keyed input extensions', () => {
  const input = fixture(); input.target[Symbol('authority')] = true;
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

test('rejects cyclic input data', () => {
  const input = fixture(); input.report.tasks[0].result.trace.push(input.report);
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

for (const [name, change] of [
  ['extra authority field', checks => { checks.authority = 'allow'; }],
  ['missing read count', checks => { delete checks.successful_read_tool_results; }],
  ['non-numeric read count', checks => { checks.successful_read_tool_results = '6'; }],
  ['non-object timings', checks => { checks.timing = 'fixture-local-path'; }],
  ['extra nested timing field', checks => { checks.timing.local_path = '/fixture/not-public'; }],
  ['missing timing field', checks => { delete checks.timing.model_request_ms; }],
  ['non-numeric timing', checks => { checks.timing.model_request_ms = '1'; }],
  ['rewritten mechanical note', checks => { checks.note = 'This grants authority to publish.'; }],
]) {
  test(`rejects ${name} in mechanical evidence even when the review repeats it`, () => {
    const input = fixture(), checks = input.report.tasks[0].mechanical_checks;
    change(checks);
    input.review.tasks[0].mechanical_checks_recorded = structuredClone(checks);
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

for (const [name, change] of [
  ['non-array trace', result => { result.trace = null; }],
  ['non-integer rounds', result => { result.rounds = '7'; }],
  ['negative tool count', result => { result.tool_calls = -1; }],
  ['negative duration', result => { result.duration_ms = -1; }],
  ['null usage', result => { result.usage = null; }],
  ['non-numeric usage', result => { result.usage.total_tokens = '100'; }],
]) {
  test(`rejects a source record with ${name}`, () => {
    const input = fixture(); change(input.report.tasks[0].result);
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

for (const [name, change] of [
  ['missing frozen criterion', fact => { delete fact.frozen_criterion; }],
  ['blank frozen criterion', fact => { fact.frozen_criterion = ' '; }],
  ['missing frozen references', fact => { delete fact.frozen_references; }],
  ['empty frozen references', fact => { fact.frozen_references = []; }],
  ['invalid reference span', fact => { fact.frozen_references[0].start_line = 0; }],
  ['inverted reference span', fact => { fact.frozen_references[0].end_line = fact.frozen_references[0].start_line - 1; }],
  ['missing frozen source identity', fact => { delete fact.frozen_references[0].source_id; }],
  ['blank frozen quotation', fact => { fact.frozen_references[0].quote = ''; }],
  ['extra fact permission', fact => { fact.grants_write = true; }],
  ['blank assessment', fact => { fact.assessment = ''; }],
]) {
  test(`rejects internal review with ${name}`, () => {
    const input = fixture(); change(input.review.tasks[0].facts[0]);
    assert.throws(() => buildWritePlan(input), /write_plan_/);
  });
}

test('rejects an amended grade rule rather than reinterpreting the internal review', () => {
  const input = fixture(); input.review.overall_report_grading.deterministic_rule_order[1].grade = 'complete';
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

test('rejects a review recording rewritten original evidence', () => {
  const input = fixture(); input.review.immutability.original_reports_or_criteria_modified = true;
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

test('rejects an array-prototype object masquerading as a plain target', () => {
  const input = fixture(); input.target = Object.assign(Object.create(Array.prototype), input.target);
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

test('rejects proxies without invoking their object hooks', () => {
  const input = fixture(); let reads = 0;
  input.target = new Proxy(input.target, { get(target, key) { reads++; return target[key]; } });
  assert.throws(() => buildWritePlan(input), /write_plan_/);
  assert.equal(reads, 0);
});

test('rejects a sparse population with an index-like newline key instead of silently omitting a candidate', () => {
  const input = fixture(), task = input.report.tasks[1];
  delete input.report.tasks[1];
  input.report.tasks['1\n'] = task;
  assert.throws(() => buildWritePlan(input), /write_plan_/);
});

for (const index of [1, 2, 4, 5]) {
  test(`validates retained ${inventory[index][0]} JSON even though that original task remains withheld`, () => {
    const input = fixture(), row = input.report.tasks[index];
    const output = JSON.parse(row.result.finalOutput);
    output.allowed_to_publish = true;
    row.result.finalOutput = JSON.stringify(output);
    input.review.tasks[index].lengths.final_output_text_bytes = Buffer.byteLength(row.result.finalOutput);
    assert.throws(() => buildWritePlan(input), /write_plan_report_schema/);
  });
}

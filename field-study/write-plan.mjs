import { createHash } from 'node:crypto';
import { isDeepStrictEqual, types } from 'node:util';

const REPORT_FILE = 'field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json';
const EVIDENCE_REF = '7306d8b45402bb2ee7f9a1fbaf7203835e599110';
const SOURCE_URL = `https://github.com/OndCo/Action-Effect-Bench/blob/${EVIDENCE_REF}/reports/${REPORT_FILE}`;
const GRADE_DIMENSION = 'substantive_and_markdown_byte_completeness';
const REPORT_FIELDS = ['task_id', 'report_markdown', 'conclusion', 'citations'];
const POPULATION = [
  { id: 'release-integrity', lane: 'sdk', status: 'completed', citations: 6,
    facts: ['companion-pin', 'measurement-identity', 'report-byte-comparison', 'verification-boundary'] },
  { id: 'clean-clone-quickstart', lane: 'mcp', status: 'failed', citations: 5,
    facts: ['prerequisites-and-layout', 'verified-dependency-setup', 'retained-setup-history',
      'offline-checks-and-replay', 'live-operation-separate'] },
  { id: 'consumer-v1-1-migration', lane: 'sdk', status: 'failed', citations: 3,
    facts: ['version-and-capability-boundary', 'selection-and-rollback', 'configuration-versus-applicability',
      'ordered-final-projection', 'historical-cohort-and-scope'] },
  { id: 'official-mcp-compatibility', lane: 'mcp', status: 'completed', citations: 5,
    facts: ['released-server-and-dependencies', 'advertised-tool-and-profile-domain',
      'actual-result-representation', 'identity-and-observation-limits'] },
  { id: 'limits-and-recovery', lane: 'sdk', status: 'failed', citations: 5, partial: 'native-and-body-limits',
    facts: ['native-and-body-limits', 'complete-bounded-listing', 'known-response-id', 'idless-reconciliation',
      'uncertainty-authority-and-descendants', 'documented-recovery-entrypoint'] },
  { id: 'conformance-support', lane: 'mcp', status: 'failed', citations: 5, partial: 'runtime-population',
    facts: ['design-coverage-not-execution', 'legacy-case-populations', 'implemented-contract-scope',
      'runtime-population', 'method-counts-not-workloads', 'agreement-and-digest-oracle'] },
];
const SCENARIOS = [
  ['normal-release-integrity', 'sdk', 'protocol', 'none', 'confirmed', null, 'allow', null, 1, 0],
  ['normal-official-mcp-compatibility', 'mcp', 'structured', 'none', 'confirmed', null, 'allow', null, 1, 3],
  ['fault-revoked', 'mcp', 'protocol', 'revoke-after-preflight', 'withheld', 'revoked', 'deny', null, 0],
  ['fault-narrowed', 'sdk', 'structured', 'narrow-after-preflight', 'withheld', 'body_too_large', 'deny', null, 0],
  ['fault-pre-send-crash', 'sdk', 'protocol', 'crash-before-send', 'process-killed', null, 'allow', 'unknown', 0],
  ['fault-post-reply-crash', 'mcp', 'protocol', 'crash-after-reply', 'process-killed', null, 'allow', 'confirmed', 1],
  ['fault-sdk-timeout', 'sdk', 'structured', 'timeout-after-reply', 'unknown', 'provider_or_readback_failure', 'allow', 'confirmed', 1],
  ['fault-mcp-disconnect', 'mcp', 'protocol', 'disconnect-after-reply', 'unknown', 'provider_or_readback_failure', 'allow', 'confirmed', 1],
];

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const scalar = value => typeof value === 'string' && value.isWellFormed();
const text = value => scalar(value) && value.trim().length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const check = (value, code) => { if (!value) throw new Error(`write_plan_${code}`); };
const same = (value, expected, code) => check(isDeepStrictEqual(value, expected), code);
const matches = (value, pattern) => typeof value === 'string' && pattern.exec(value)?.[0] === value;

function exactKeys(value, keys, code) {
  check(object(value) && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key)), code);
}

function fields(value, expected, code) {
  check(object(value), code);
  for (const [key, wanted] of Object.entries(expected)) same(value[key], wanted, code);
}

// Reject executable object hooks before reading any purported JSON fields.
function jsonData(value, ancestors = new Set(), depth = 0) {
  check(depth <= 100, 'input');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number') { check(Number.isFinite(value), 'input'); return; }
  check(typeof value === 'object' && !types.isProxy(value), 'input');
  check(Array.isArray(value) ? Object.getPrototypeOf(value) === Array.prototype
    : [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'input');
  check(!ancestors.has(value), 'input');
  ancestors.add(value);
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value)) check(keys.length === value.length + 1, 'input');
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(typeof key === 'string' && descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'input');
    if (Array.isArray(value)) check(/^(0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length, 'input');
    jsonData(descriptor.value, ancestors, depth + 1);
  }
  ancestors.delete(value);
}

function originalReport(raw, id) {
  try {
    check(typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') <= 16 * 1024 * 1024, 'report_schema');
    const value = JSON.parse(raw);
    exactKeys(value, REPORT_FIELDS, 'report_schema');
    check(value.task_id === id && ['report_markdown', 'conclusion'].every(key => scalar(value[key]) && value[key].trim())
      && Array.isArray(value.citations) && value.citations.every(scalar), 'report_schema');
    // This schema has only four top-level members and a string array. Tokenize
    // whole strings so punctuation inside the Markdown cannot masquerade as keys.
    const names = [];
    let previous;
    for (const [token] of raw.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:]/g)) {
      if (token === ':') names.push(JSON.parse(previous));
      previous = token;
    }
    check(names.length === 4 && new Set(names).size === 4, 'report_schema');
    return value;
  } catch { throw new Error('write_plan_report_schema'); }
}

function validateStudy(report, review) {
  exactKeys(report, ['format', 'population', 'status', 'source_inventory_unchanged', 'freeze', 'provenance',
    'configuration', 'scopes', 'journal', 'native_setup', 'tasks', 'summary', 'duration_ms'], 'report');
  fields(report, { format: 'field-study-use/1', population: 'same-project-real-model-maintainer-use',
    status: 'recorded', source_inventory_unchanged: true }, 'report');
  check(Array.isArray(report.tasks) && report.tasks.length === POPULATION.length, 'population');
  fields(report.summary, { scheduled_tasks: 6, completed_task_loops: 2, failed_or_blocked_tasks: 4,
    schema_valid_reports: 2, fully_observed_citation_reports: 2, semantic_quality_assessed: false,
    externally_independent_evaluations: 0, provider_write_attempts: 0,
    lanes: { sdk: { scheduled: 3, completed: 1 }, mcp: { scheduled: 3, completed: 1 } } }, 'population');
  same(report.scopes, { customer_production: false, independent_external_evaluation: false,
    new_provider_writes: false, read_tools_are_profile_authorization: false, quality_requires_separate_review: true }, 'report');

  exactKeys(review, ['version', 'id', 'review_date', 'actor', 'immutability', 'scope', 'provenance', 'methodology',
    'overall_report_grading', 'confounders', 'source_catalog', 'tasks', 'totals', 'limitations'], 'review');
  fields(review, { version: 1, id: 'review-second-field-use', review_date: '2026-10-19' }, 'review');
  check(Array.isArray(review.tasks) && review.tasks.length === POPULATION.length, 'review_population');
  fields(review.provenance, { criteria_version: 2,
    evidence: { repository: 'OndCo/Action-Effect-Bench', ref: EVIDENCE_REF },
    original_report: { repository: 'OndCo/Action-Effect-Bench', path: `reports/${REPORT_FILE}`, ref: EVIDENCE_REF,
      raw_sha256: 'e6d9fe0e27ca93932fb9102cc5d5b7f16e4c7c138cd72c79eeeaaf1cb2961999', byte_length: 390123 } }, 'review_binding');
  same(review.actor, { role: 'same-project AI-assisted source reviewer', same_project: true,
    ai_assisted: true, human_reviewer: false, independent_external_reviewer: false }, 'review_scope');
  same(review.scope, { cohort: 'second field-use run',
    population: 'exposed ordinary maintainer tasks on the same public Action-Effect sources', task_count: 6, fact_count: 30,
    held_out_novelty: false, independent_human_ground_truth: false, external_validation: false,
    actual_human_acceptance: 'unknown', actual_operator_use: 'unknown', business_utility: 'unknown',
    mapping_or_authorization_grade: false, provider_delivery_grade: false, field_preflight_reports_included: false,
    completed_task_loops: 2, failed_task_loops: 4, retained_failed_outputs_assessed: true }, 'review_scope');
  fields(review.immutability, { original_reports_or_criteria_modified: false, first_review_modified: false }, 'review_scope');
  fields(review.overall_report_grading, { dimension: GRADE_DIMENSION, format_evaluated_separately: true,
    loop_status_evaluated_separately: true, grade_does_not_reclassify_loop_outcome: true, complete_does_not_mean_human_acceptance: true,
    derived_report_grades: { T1: 'complete', T2: 'partial', T3: 'partial', T4: 'complete', T5: 'partial', T6: 'partial' },
    deterministic_rule_order: [
      { priority: 1, condition: 'At least one fact has status incorrect.', grade: 'incorrect' },
      { priority: 2, condition: 'Otherwise at least one fact is not met, or report_markdown exceeds 6000 UTF-8 bytes.', grade: 'partial' },
      { priority: 3, condition: 'Otherwise all facts are met and report_markdown is at most 6000 UTF-8 bytes.', grade: 'complete' },
    ] }, 'review_grade');
  fields(review.totals, { tasks: 6, facts: 30, fact_statuses: { met: 28, partial: 2, incorrect: 0, unknown: 0 },
    overall_report_grades: { complete: 2, partial: 4, incorrect: 0 }, completed_task_loops: 2, failed_task_loops: 4,
    failed_loop_reasons: { report_bytes_exceeded: 4 }, retained_final_outputs: 6,
    markdown_within_original_6000_byte_budget: 2, markdown_over_original_6000_byte_budget: 4,
    json_envelope_reports: 6, json_format_deviations: 0, original_delivery_compliant_reports: 2,
    markdown_within_comment_profile_8192_byte_budget: 6, observed_citation_entries: 29,
    actual_human_acceptance_unknown: 6, actual_operator_use_unknown: 6, business_utility_unknown: 6,
    recorded_provider_write_attempts: 0, automatic_retries: 0 }, 'review_totals');
}

function candidateFrom(row, reviewed, index) {
  const expected = POPULATION[index], label = `T${index + 1}`, completed = expected.status === 'completed';
  const outcome = { status: expected.status, reason: completed ? 'final_output' : 'report_bytes_exceeded' };
  exactKeys(row, ['id', 'lane', 'result', 'mechanical_checks'], 'population');
  fields(row, { id: expected.id, lane: expected.lane }, 'population');
  exactKeys(row.result, ['status', 'reason', 'finalOutput', 'rounds', 'tool_calls', 'usage', 'duration_ms', 'trace'], 'population');
  fields(row.result, outcome, 'population');
  check(Array.isArray(row.result.trace) && integer(row.result.rounds) && integer(row.result.tool_calls)
    && typeof row.result.duration_ms === 'number' && row.result.duration_ms >= 0, 'population');
  exactKeys(row.result.usage, ['input_tokens', 'output_tokens', 'total_tokens', 'reported_requests', 'missing_requests'], 'population');
  check(Object.values(row.result.usage).every(integer), 'population');
  const output = originalReport(row.result.finalOutput, row.id), bytes = Buffer.byteLength(output.report_markdown, 'utf8');
  check((bytes <= 6000) === completed && bytes <= 8192, 'population');
  exactKeys(row.mechanical_checks, ['report_schema_valid', 'citations_observed', 'successful_read_tool_results',
    'distinct_observed_sources', 'unavailable_read_tool_results', 'body_bytes', 'fits_comment_profile_bytes',
    'quality', 'utility', 'timing', 'note'], 'mechanical_checks');
  fields(row.mechanical_checks, { report_schema_valid: completed, citations_observed: completed,
    body_bytes: completed ? bytes : null, fits_comment_profile_bytes: completed,
    quality: completed ? 'not_reviewed' : 'no_result', utility: 'not_reviewed',
    note: 'Schema, byte and citation checks do not grade semantic correctness, novelty, usefulness or permission to publish.' }, 'mechanical_checks');
  check(['successful_read_tool_results', 'distinct_observed_sources', 'unavailable_read_tool_results']
    .every(key => integer(row.mechanical_checks[key])), 'mechanical_checks');
  exactKeys(row.mechanical_checks.timing, ['model_request_ms', 'tool_handling_ms', 'other_task_ms', 'total_task_ms'], 'mechanical_checks');
  check(Object.values(row.mechanical_checks.timing).every(value => typeof value === 'number' && value >= 0), 'mechanical_checks');

  exactKeys(reviewed, ['id', 'label', 'title', 'lane', 'loop_status', 'loop_reason', 'loop_outcome', 'overall_report_grade',
    'grade_dimension', 'grade_explanation', 'human_acceptance', 'actual_operator_use', 'business_utility', 'report_evidence',
    'mechanical_checks_recorded', 'lengths', 'format_deviation', 'citations', 'material_error_fact_ids', 'omission_fact_ids', 'facts'], 'review_population');
  fields(reviewed, { id: row.id, label, lane: row.lane, loop_status: row.result.status, loop_reason: row.result.reason,
    loop_outcome: { ...outcome, full_final_output_retained: true, automatic_retry: false }, grade_dimension: GRADE_DIMENSION,
    human_acceptance: 'unknown', actual_operator_use: 'unknown', business_utility: 'unknown',
    material_error_fact_ids: [], omission_fact_ids: expected.partial ? [expected.partial] : [] }, 'review_correspondence');
  fields(reviewed.report_evidence, { artifact_id: 'original_report', json_pointer: `/tasks/${index}/result/finalOutput`,
    parsed_report_member: 'report_markdown', journal_artifact_id: 'original_journal' }, 'review_binding');
  same(reviewed.mechanical_checks_recorded, row.mechanical_checks, 'review_mechanical_checks');
  same(reviewed.lengths, { encoding: 'UTF-8', report_markdown_bytes: bytes,
    final_output_text_bytes: Buffer.byteLength(row.result.finalOutput, 'utf8'), frozen_maximum_report_bytes: 6000,
    markdown_within_frozen_budget: bytes <= 6000, final_output_within_frozen_budget: null, final_output_budget_applies: false,
    comment_profile_maximum_bytes: 8192, markdown_within_comment_profile_budget: bytes <= 8192, excludes_journal_framing: true }, 'review_bytes');
  fields(reviewed.format_deviation, { contract_version: 2, original_delivery_compliance: completed ? 'met' : 'not_met',
    json_instead_of_markdown: false, markdown_exceeds_frozen_byte_budget: bytes > 6000,
    final_output_exceeds_frozen_byte_budget: null, outer_final_text_has_no_6000_byte_budget: true, confounder_id: null,
    contradictory_format_instruction: false, parsed_envelope_shape_valid: true }, 'review_format');
  check(output.citations.length === expected.citations, 'review_citations');
  fields(reviewed.citations, { count: output.citations.length, urls: output.citations, all_observed: true,
    file_citations_match_frozen_sources: true }, 'review_citations');

  check(Array.isArray(reviewed.facts) && reviewed.facts.length === expected.facts.length, 'review_facts');
  const reportText = `${output.report_markdown}\n${output.conclusion}`;
  for (const [factIndex, fact] of reviewed.facts.entries()) {
    const journalReference = (index === 0 && factIndex === 2) || (index === 3 && factIndex === 3);
    exactKeys(fact, ['id', 'status', 'evidence_quotes', 'assessment', 'frozen_criterion', 'frozen_references',
      ...(journalReference ? ['journal_references'] : [])], 'review_facts');
    fields(fact, { id: expected.facts[factIndex], status: expected.facts[factIndex] === expected.partial ? 'partial' : 'met' }, 'review_facts');
    check(text(fact.assessment) && text(fact.frozen_criterion) && Array.isArray(fact.frozen_references)
      && fact.frozen_references.length > 0, 'review_facts');
    if (journalReference) check(Array.isArray(fact.journal_references) && fact.journal_references.length > 0, 'review_facts');
    for (const reference of fact.frozen_references) {
      exactKeys(reference, ['source_id', 'start_line', 'end_line', 'quote'], 'review_facts');
      check(text(reference.source_id) && text(reference.quote) && integer(reference.start_line) && reference.start_line > 0
        && integer(reference.end_line) && reference.end_line >= reference.start_line, 'review_facts');
    }
    check(Array.isArray(fact.evidence_quotes) && fact.evidence_quotes.length > 0
      && fact.evidence_quotes.every(quote => scalar(quote) && quote.length > 0 && reportText.includes(quote)), 'review_quotes');
  }
  const grade = reviewed.facts.some(fact => fact.status === 'incorrect') ? 'incorrect'
    : reviewed.facts.some(fact => fact.status !== 'met') || bytes > 6000 ? 'partial' : 'complete';
  same(reviewed.overall_report_grade, grade, 'review_grade');
  const eligible = row.result.status === 'completed' && bytes <= 6000 && grade === 'complete';
  check(eligible === completed, 'population');
  return { output, candidate: { id: row.id, label, lane: row.lane, original_outcome: { ...outcome }, eligible,
    withheld_reason: eligible ? null : row.result.reason, report_object_sha256: sha256(JSON.stringify(output)),
    report_markdown_bytes: bytes, internal_review_grade: grade, original_mechanical_checks: structuredClone(row.mechanical_checks) } };
}

function normalBody({ output, candidate }, occurrence) {
  return `# Internal maintainer working result: ${candidate.label} (${candidate.id})\n\n`
    + 'Same-project AI-assisted source review: complete. Not independent endorsement or a whole-system pass.\n\n'
    + `${output.report_markdown}\n\n## Original conclusion\n${output.conclusion}\n\n## Original citations\n`
    + `${output.citations.map((url, index) => `${index + 1}. ${url}`).join('\n')}\n\n`
    + `Source evidence: ${SOURCE_URL}\nOriginal task: ${candidate.id}\n`
    + `Report object SHA-256: \`${candidate.report_object_sha256}\`\nOccurrence: \`${occurrence}\`\n`;
}

function syntheticBody(id, fault, occurrence) {
  return `# Synthetic control note: ${id}\n\nControlled owned-write/recovery study: ${fault}.\n`
    + 'This is a synthetic control, not a useful model task or another completed maintainer output.\n'
    + `Occurrence: \`${occurrence}\`\n`;
}

// Literal direct-effect reference, independent of either candidate mapper/consumer.
function referenceProjection(native, context) {
  const call = native.lane === 'sdk' ? native.call : native.call.arguments;
  const repository = `${call.owner}/${call.repo}`;
  return { operation: 'create_issue_comment', repository, issue_number: call.issue_number,
    endpoint: `https://api.github.com/repos/${repository}/issues/${call.issue_number}/comments`,
    body_sha256: sha256(Buffer.from(call.body, 'utf8')), body_bytes: Buffer.byteLength(call.body, 'utf8'),
    data_class: context.data_class };
}

/**
 * Pure, synchronous construction; no authorization, I/O, clock or provider calls.
 * The caller must first verify the immutable raw report/review hashes and replay,
 * including frozen-source review references. This checks population and internal
 * review correspondence, not the reviewer's semantic correctness or independence.
 * report_object_sha256 is SHA-256 of UTF-8 JSON.stringify(parsed original object),
 * preserving its member order, not a raw finalOutput hash or mapper digest.
 * runId: 1-64 ASCII [A-Za-z0-9._-], starting alphanumeric; occurrence: runId.id.
 * Returns six candidates and eight executable scenarios or throws write_plan_*.
 */
export function buildWritePlan(input) {
  jsonData(input);
  exactKeys(input, ['report', 'review', 'target', 'principal', 'runId'], 'input');
  const { report, review, target, principal, runId } = input;
  exactKeys(target, ['owner', 'repo', 'issue_number'], 'target');
  check(target.owner === 'OndCo' && target.repo === 'Action-Effect-Bench'
    && Number.isSafeInteger(target.issue_number) && target.issue_number > 1 && target.issue_number <= 2147483647, 'target');
  check(matches(principal, /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/), 'principal');
  check(matches(runId, /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/), 'run_id');
  validateStudy(report, review);
  const prepared = report.tasks.map((row, index) => candidateFrom(row, review.tasks[index], index));
  const ids = new Set(), occurrences = new Set(), bodies = new Set();
  const scenarios = SCENARIOS.map(([id, lane, strategy, fault, initial_outcome, reason, decision, recovery_outcome, new_comments, sourceIndex]) => {
    const occurrence = `${runId}.${id}`;
    check(matches(occurrence, /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/) && !ids.has(id) && !occurrences.has(occurrence), 'occurrence');
    ids.add(id);
    occurrences.add(occurrence);
    const body = fault === 'none' ? normalBody(prepared[sourceIndex], occurrence) : syntheticBody(id, fault, occurrence);
    check(scalar(body) && Buffer.byteLength(body, 'utf8') <= 8192, 'comment_bytes');
    check(!bodies.has(body), 'duplicate_body');
    bodies.add(body);
    const call = { owner: target.owner, repo: target.repo, issue_number: target.issue_number, body };
    const native = lane === 'sdk' ? { lane, call } : { lane, call: { name: 'add_issue_comment', arguments: call } };
    const context = { principal, data_class: fault === 'none' ? 'public-maintainer-draft' : 'synthetic-public',
      implementation: 'github-comment-bridge/1' };
    return { id, lane, strategy, fault, occurrence, native, context, reference_projection: referenceProjection(native, context),
      expected: { initial_outcome, reason, decision, recovery_outcome, new_comments } };
  });
  return { format: 'action-effect-owned-write-plan/1',
    target: { owner: target.owner, repo: target.repo, issue_number: target.issue_number }, principal, run_id: runId,
    candidates: prepared.map(row => row.candidate), scenarios, max_comment_calls: 12, expected_comment_objects: 5 };
}

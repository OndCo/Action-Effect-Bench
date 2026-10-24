import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { copyJSON, parseJSON } from './model-client.mjs';

export const PREFLIGHT_TOOL = 'check_report_contract';
export const REPORT_BYTES = 6000;
export const READ_TOOLS = Object.freeze(['read_repository_file', 'inspect_repository_file', 'inspect_release', 'inspect_release_asset']);
const fields = ['task_id', 'report_markdown', 'conclusion', 'citations'];
const check = (condition, reason) => { if (!condition) throw new Error(reason); };
const scalar = value => typeof value === 'string' && value.isWellFormed();

function citationBase(value) {
  if (!scalar(value) || value.length > 2048 || /[\s\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || url.search || url.href !== value) return null;
    if (url.hash) {
      const match = /^#L([1-9][0-9]*)(?:-L([1-9][0-9]*))?$/.exec(url.hash);
      if (!match || !Number.isSafeInteger(Number(match[1])) ||
        (match[2] && (!Number.isSafeInteger(Number(match[2])) || Number(match[2]) < Number(match[1])))) return null;
    }
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function assessReport(taskId, input, observedSources) {
  const assessment = { status: 'not_ready', errors: [], body_bytes: null, max_body_bytes: REPORT_BYTES,
    over_budget_bytes: 0, report_sha256: null, authority: 'not_evaluated', semantic_quality: 'not_reviewed' };
  let value;
  try {
    value = copyJSON(input, 'invalid_report');
    check(value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), 'invalid_report');
    check(value.task_id === taskId && scalar(value.task_id)
      && scalar(value.report_markdown) && value.report_markdown.trim() && value.report_markdown.length <= 65536
      && scalar(value.conclusion) && value.conclusion.trim() && Buffer.byteLength(value.conclusion) <= 4096
      && Array.isArray(value.citations) && value.citations.length <= 128 && value.citations.every(scalar), 'invalid_report');
  } catch { assessment.errors.push('invalid_report'); return assessment; }
  assessment.body_bytes = Buffer.byteLength(value.report_markdown, 'utf8');
  assessment.over_budget_bytes = Math.max(0, assessment.body_bytes - REPORT_BYTES);
  // A domain-separated, fixed-field encoding binds the complete submitted report.
  // It is not an Action Effect digest, signature, authority token or truth claim.
  assessment.report_sha256 = createHash('sha256').update(JSON.stringify([
    'field-report-contract/1', ...fields.map(key => value[key]),
  ])).digest('hex');
  if (assessment.over_budget_bytes) assessment.errors.push('report_bytes_exceeded');
  const observed = new Set(observedSources);
  if (!value.citations.length || value.citations.some(citation => {
    const base = citationBase(citation);
    return base === null || !observed.has(base);
  })) assessment.errors.push('citations_not_observed');
  assessment.status = assessment.errors.length ? 'not_ready' : 'ready';
  return assessment;
}

function observedIn(trace) {
  return trace.filter(event => event.type === 'tool_result' && READ_TOOLS.includes(event.name)
    && event.status === 'completed' && !event.journal_status && event.output?.untrusted === true
    && event.output.data?.status === 'ok' && typeof event.output.data.source_url === 'string')
    .map(event => event.output.data.source_url);
}

export function createReportPreflight({ taskId, trace }) {
  check(typeof taskId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(taskId) && Array.isArray(trace), 'invalid_preflight_configuration');
  return {
    schema: { type: 'function', name: PREFLIGHT_TOOL, strict: true,
      description: 'Local draft check only: exact 6000-byte Markdown limit, report fields, and citations observed in this task. No network, publication, permission or semantic grading. Supply the complete proposed final report. A rejected draft may be explicitly revised within the existing task budget. Return the exact accepted fields as your final answer.',
      parameters: { type: 'object', additionalProperties: false, properties: {
        task_id: { type: 'string' }, report_markdown: { type: 'string' }, conclusion: { type: 'string' },
        citations: { type: 'array', items: { type: 'string' } },
      }, required: [...fields] },
    },
    execute: async value => assessReport(taskId, value, observedIn(trace)),
  };
}

/** Recheck drafts in event order; later reads never validate an earlier draft. */
export function auditReportContract(taskId, result) {
  const trace = result.trace ?? [], observed = new Set(), pending = new Map(), seen = new Set(), drafts = [], accepted = new Set();
  check(Array.isArray(trace) && trace.length <= 10000, 'contract_trace_order');
  check(result.status === 'blocked' ? trace.length === 0 : trace.at(-1)?.type === 'task_end'
    && trace.at(-1).status === result.status && trace.at(-1).reason === result.reason, 'contract_terminal');
  let readToolCalls = 0, journalBroken = false;
  for (const [index, event] of trace.entries()) {
    check(event.sequence === index && event.task_id === taskId, 'contract_trace_order');
    if (event.journal_status) journalBroken = true;
    if (event.type === 'tool_attempt') {
      check(!seen.has(event.call_id), 'contract_trace_order');
      seen.add(event.call_id);
      if (READ_TOOLS.includes(event.name)) readToolCalls++;
      pending.set(event.call_id, event);
    }
    if (event.type !== 'tool_result') continue;
    const attempt = pending.get(event.call_id);
    check(attempt && attempt.name === event.name, 'contract_trace_order');
    pending.delete(event.call_id);
    if (event.status !== 'completed' || journalBroken) continue;
    if (READ_TOOLS.includes(event.name)) {
      if (event.output?.untrusted === true && event.output.data?.status === 'ok') {
        check(typeof event.output.data.source_url === 'string', 'contract_trace_order');
        observed.add(event.output.data.source_url);
      }
    } else if (event.name === PREFLIGHT_TOOL) {
      const assessment = assessReport(taskId, attempt.arguments, [...observed]);
      check(event.output?.untrusted === true && isDeepStrictEqual(event.output.data, assessment), 'preflight_feedback_mismatch');
      drafts.push({ call_id: event.call_id, assessment });
      if (assessment.status === 'ready') accepted.add(assessment.report_sha256);
    }
  }
  check(result.status !== 'completed' || pending.size === 0, 'contract_terminal');
  let final = null;
  try { final = parseJSON(result.finalOutput, 'invalid_report'); } catch { /* Failed final candidates remain in the trace. */ }
  const finalAssessment = assessReport(taskId, final, [...observed]);
  const matched = finalAssessment.status === 'ready' && accepted.has(finalAssessment.report_sha256);
  const ready = result.status === 'completed' && !journalBroken && matched;
  return { ready, final_assessment: finalAssessment, final_matches_accepted_preflight: matched,
    first_draft_ready: drafts.length ? drafts[0].assessment.status === 'ready' : null,
    preflight_calls: trace.filter(e => e.type === 'tool_attempt' && e.name === PREFLIGHT_TOOL).length,
    failed_drafts: drafts.filter(d => d.assessment.status !== 'ready').length, drafts,
    read_tool_calls: readToolCalls, automatic_provider_writes: 0, authority: 'not_evaluated', semantic_quality: 'not_reviewed' };
}

export function summarizeReportContracts(rows) {
  check(Array.isArray(rows) && rows.length <= 100 && new Set(rows.map(row => row.id)).size === rows.length, 'contract_task_inventory');
  const checks = rows.map(row => auditReportContract(row.id, row.result));
  return { scheduled_tasks: rows.length, tasks_ready_for_maintainer_review: checks.filter(c => c.ready).length,
    first_draft_ready_tasks: checks.filter(c => c.first_draft_ready === true).length,
    tasks_without_recorded_draft: checks.filter(c => c.first_draft_ready === null).length,
    local_preflight_calls: checks.reduce((sum, c) => sum + c.preflight_calls, 0),
    failed_drafts: checks.reduce((sum, c) => sum + c.failed_drafts, 0),
    read_tool_calls: checks.reduce((sum, c) => sum + c.read_tool_calls, 0),
    independent_external_evaluations: 0, semantic_quality: 'not_reviewed', user_acceptance: 'not_measured', provider_write_attempts: 0 };
}

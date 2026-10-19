import { parseJSON } from './model-client.mjs';

function baseCitation(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.search || url.username || url.password || url.port) return null;
    if (url.hash && !/^#L[1-9][0-9]*(?:-L[1-9][0-9]*)?$/.test(url.hash)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function inspectTask(task, result) {
  let report = null;
  try {
    const value = parseJSON(result.finalOutput, 'invalid_report');
    if (result.status !== 'completed' || !value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join(',') !== 'citations,conclusion,report_markdown,task_id'
      || value.task_id !== task.id || typeof value.report_markdown !== 'string' || !value.report_markdown.trim()
      || typeof value.conclusion !== 'string' || !Array.isArray(value.citations) || !value.citations.every(c => typeof c === 'string')) throw new Error();
    report = value;
  } catch { /* A completed model response is not necessarily a usable task report. */ }
  const trace = result.trace ?? [];
  const successful = trace.filter(e => e.type === 'tool_result' && e.status === 'completed' && e.output?.data?.status === 'ok');
  const observed = new Set(successful.map(e => e.output.data.source_url).filter(Boolean));
  const citationsObserved = Boolean(report && report.citations.length && report.citations.every(c => {
    const base = baseCitation(c);
    return base !== null && observed.has(base);
  }));
  const duration = kind => trace.filter(e => e.type === kind).reduce((sum, e) => sum + (e.duration_ms ?? 0), 0);
  const model = duration('model_result'), tooling = duration('tool_result');
  return { report_schema_valid: report !== null, citations_observed: citationsObserved,
    successful_read_tool_results: successful.length, distinct_observed_sources: observed.size,
    unavailable_read_tool_results: trace.filter(e => e.type === 'tool_result' && e.output?.data?.status === 'unavailable').length,
    body_bytes: report ? Buffer.byteLength(report.report_markdown) : null,
    fits_comment_profile_bytes: report ? Buffer.byteLength(report.report_markdown) <= 8192 : false,
    quality: report ? 'not_reviewed' : 'no_result', utility: 'not_reviewed',
    timing: { model_request_ms: model, tool_handling_ms: tooling, other_task_ms: (result.duration_ms ?? 0) - model - tooling,
      total_task_ms: result.duration_ms ?? 0 },
    note: 'Schema, byte and citation checks do not grade semantic correctness, novelty, usefulness or permission to publish.' };
}

export function summarizeStudy(tasks, rows) {
  if (tasks.length !== rows.length || new Set(rows.map(r => r.id)).size !== rows.length
    || tasks.some((task, index) => task.id !== rows[index]?.id || task.lane !== rows[index]?.lane)) throw new Error('task_inventory');
  const completed = rows.filter(r => r.result.status === 'completed').length;
  const assessed = rows.map((row, i) => inspectTask(tasks[i], row.result));
  const knownUsage = rows.every(r => r.result.usage?.missing_requests === 0);
  const tokens = key => knownUsage ? rows.reduce((sum, r) => sum + r.result.usage[key], 0) : null;
  return { scheduled_tasks: tasks.length, completed_task_loops: completed, failed_or_blocked_tasks: tasks.length - completed,
    schema_valid_reports: assessed.filter(r => r.report_schema_valid).length,
    fully_observed_citation_reports: assessed.filter(r => r.citations_observed).length,
    semantic_quality_assessed: false, externally_independent_evaluations: 0,
    model_requests: rows.reduce((sum, r) => sum + r.result.rounds, 0),
    read_tool_calls: rows.reduce((sum, r) => sum + r.result.tool_calls, 0),
    usage: { input_tokens: tokens('input_tokens'), output_tokens: tokens('output_tokens'), total_tokens: tokens('total_tokens') },
    task_wall_ms: rows.reduce((sum, r) => sum + r.result.duration_ms, 0),
    lanes: Object.fromEntries(['sdk', 'mcp'].map(lane => [lane, { scheduled: tasks.filter(t => t.lane === lane).length,
      completed: rows.filter(r => r.lane === lane && r.result.status === 'completed').length }])),
    provider_write_attempts: 0 };
}

import { isDeepStrictEqual as same } from 'node:util';
import { createHash } from 'node:crypto';
import { digestBytes } from './artifacts.mjs';
import { parseJSON, inspectModelResponse } from './model-client.mjs';
import { readCommittedBlob } from './provenance.mjs';
import { decodeFileResult } from './native-mcp.mjs';

const check = (condition, code) => { if (!condition) throw new Error(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const time = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const TOOL_NAMES = ['read_repository_file', 'inspect_repository_file', 'inspect_release', 'inspect_release_asset'];
const SCORING_V1 = '403ae830915eaed61a79e665f38f9ec7106c850419f0c10f4453602962887e2d';

function auditReferences(manifest, criteria) {
  const repositories = { 'OndCo/Action-Effect-Bench': 'bench', 'OndCo/Action-Effect-Spec': 'spec' }, references = new Set();
  check(Array.isArray(criteria.assets), 'frozen_source_inventory');
  for (const source of [...criteria.sources, ...criteria.assets]) {
    check(object(source) && Object.hasOwn(repositories, source.repository) && /^[a-f0-9]{40}$/.test(source.ref)
      && source.ref === criteria.source_refs?.[source.repository] && count(source.byte_length) && source.byte_length <= 2 * 1024 * 1024
      && typeof source.path === 'string' && /^[A-Za-z0-9_./-]+$/.test(source.path)
      && source.path.split('/').every(part => part && part !== '.' && part !== '..')
      && /^[a-f0-9]{64}$/.test(source.raw_sha256), 'frozen_source_inventory');
    const bytes = readCommittedBlob(repositories[source.repository], source.ref, source.path);
    check(bytes.length === source.byte_length && digestBytes(bytes) === source.raw_sha256, 'frozen_source_bytes');
    if (criteria.sources.includes(source)) {
      const key = JSON.stringify([source.repository, source.ref, source.path]);
      check(!references.has(key), 'frozen_source_inventory');
      references.add(key);
    }
  }
  for (const task of manifest.tasks) {
    check(['sdk', 'mcp'].includes(task.lane) && typeof task.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(task.id)
      && Array.isArray(task.sources) && task.sources.length > 0 && task.sources.every(source =>
        same(Object.keys(source).sort(), ['path', 'ref', 'repository']) && references.has(JSON.stringify([source.repository, source.ref, source.path])))
      && new Set(task.sources.map(source => JSON.stringify([source.repository, source.path]))).size === task.sources.length, 'frozen_source_inventory');
  }
}

/** Only the two disclosed study contracts are supported; historical code is data. */
export function auditFrozenInputs(report, frozen, read) {
  const taskBytes = read('bench/field-study/tasks.json'), criteriaBytes = read('bench/field-study/criteria.json');
  const manifest = parseJSON(taskBytes.toString('utf8'), 'tasks_json');
  const criteria = parseJSON(criteriaBytes.toString('utf8'), 'criteria_json');
  const config = parseJSON(read('bench/field-study/tools.json').toString('utf8'), 'configuration_json');
  const schema = parseJSON(read('bench/field-study/report-format.json').toString('utf8'), 'report_schema_json');
  check([1, 2].includes(manifest.version) && manifest.version === criteria.version, 'study_version');
  check(digestBytes(taskBytes) === frozen.tasks_sha256 && digestBytes(criteriaBytes) === frozen.criteria_sha256
    && same(frozen.task_inputs, manifest), 'task_or_criteria_drift');
  check(same(config, report.configuration) && same(config.azure_model, frozen.model_configuration), 'configuration_binding');
  check(digestBytes(read('bench/field-study/scoring.mjs')) === SCORING_V1 && schema.type === 'object'
    && schema.additionalProperties === false && same(schema.required, ['task_id', 'report_markdown', 'conclusion', 'citations'])
    && same(schema.properties, { task_id: { type: 'string' }, report_markdown: { type: 'string' }, conclusion: { type: 'string' },
      citations: { type: 'array', items: { type: 'string' } } }), 'unsupported_scoring_contract');
  check(Array.isArray(manifest.tasks) && manifest.tasks.length > 0 && manifest.tasks.length <= 100
    && new Set(manifest.tasks.map(task => task.id)).size === manifest.tasks.length, 'task_inventory');
  check(Array.isArray(criteria.sources) && criteria.sources.every(source => count(source.byte_length)
    && /^[a-f0-9]{64}$/.test(source.raw_sha256)), 'frozen_source_inventory');
  auditReferences(manifest, criteria);
  const limits = { rounds: config.azure_model.max_rounds_per_task, toolCalls: config.azure_model.max_tool_calls_per_task };
  check(count(limits.rounds) && limits.rounds <= 100 && count(limits.toolCalls) && limits.toolCalls <= 1000, 'configuration_binding');
  let amendment = null;
  if (manifest.version === 1) check(!Object.hasOwn(frozen, 'amendment'), 'amendment_binding');
  else {
    const bytes = read('bench/field-study/amendment-2.json');
    amendment = parseJSON(bytes.toString('utf8'), 'amendment_json');
    check(same(frozen.amendment, { file: 'field-study/amendment-2.json', sha256: digestBytes(bytes), value: amendment })
      && amendment.format === 'field-study-amendment/1' && amendment.study_version === 2 && amendment.holdout === false
      && amendment.automatic_model_retries === false && amendment.response_contract?.report_max_utf8_bytes === 6000
      && amendment.frozen_fact_records_sha256 === digestBytes(JSON.stringify(criteria.tasks)), 'amendment_binding');
    const prior = amendment.prior_report;
    check(object(prior) && /^field-study-use-[A-Za-z0-9._-]+\.json$/.test(prior.file), 'amendment_binding');
    const priorBytes = readCommittedBlob('bench', prior.evidence_commit, `reports/${prior.file}`);
    const priorReport = parseJSON(priorBytes.toString('utf8'), 'amendment_prior_json');
    check(digestBytes(priorBytes) === prior.sha256 && priorReport.format === 'field-study-use/1'
      && priorReport.provenance?.environment?.repositories?.bench?.head === prior.runtime_commit, 'amendment_binding');
    const priorCriteria = parseJSON(readCommittedBlob('bench', prior.runtime_commit, 'field-study/criteria.json').toString('utf8'), 'amendment_prior_json');
    const priorTasks = parseJSON(readCommittedBlob('bench', prior.runtime_commit, 'field-study/tasks.json').toString('utf8'), 'amendment_prior_json');
    const identity = tasks => tasks.map(task => ({ id: task.id, lane: task.lane, sources: task.sources }));
    check(priorCriteria.version === 1 && digestBytes(JSON.stringify(priorCriteria.tasks)) === amendment.frozen_fact_records_sha256
      && same(identity(priorTasks.tasks), identity(manifest.tasks)), 'amendment_binding');
    limits.reportBytes = amendment.response_contract.report_max_utf8_bytes;
  }
  return { version: manifest.version, manifest, criteria, config, limits, amendment };
}

export function expectedPrompt(task, context, setup) {
  const parts = [
    `Task ID: ${task.id}\n${task.title}\n\n${task.prompt}`,
    `Required deliverables:\n${task.mandatory_deliverables.map(item => `- ${item}`).join('\n')}`,
    `Allowed public source files at immutable commits:\n${JSON.stringify(task.sources, null, 2)}`,
    'Use read_repository_file for ordinary text and inspect_repository_file for raw-byte hashes of large files. The latter returns metadata, not the file contents. inspect_release inspects the pinned release; inspect_release_asset is available only where explicitly allowed. Do not change source refs or assume unavailable tools exist.',
  ];
  if (context.version === 1) return [...parts,
    'Return JSON with task_id, report_markdown, conclusion and citations. Write a concise but complete Markdown maintainer report, aiming below 7000 UTF-8 bytes for report_markdown. Cite exact observed source_url values (optional line anchors for source files). Describe unavailable evidence explicitly. Do not claim you ran shell tests, submitted comments, certified conformance or checked customer deployments. A report requires maintainer review before publication.',
  ].join('\n\n');
  parts.push(`Return exactly one JSON object, not raw Markdown or fenced JSON, with exactly the fields task_id, report_markdown, conclusion and citations. task_id must equal ${JSON.stringify(task.id)}. Any request above for a final Markdown report means the report_markdown string inside this JSON object, never the outer answer format.`,
    'report_markdown must be nonempty Markdown containing at most 6000 UTF-8 bytes; aim for 4500-5000 bytes. conclusion must be a nonempty string and citations an array of strings. Cite exact observed source_url values (optional line anchors for source files). Describe unavailable evidence explicitly. Do not claim you ran shell tests, submitted comments, certified conformance, obtained protocol authorization or checked customer deployments. A report requires maintainer review before publication.');
  const channel = task.lane === 'mcp' ? { lane: 'mcp', transport: setup.inventory.transport,
    server: { name: setup.inventory.server.name, version: setup.inventory.server.version, executable_sha256: setup.inventory.executable_sha256 },
    negotiated_protocol: setup.inventory.protocol_version, startup_observed: setup.status === 'ready' }
    : { lane: 'sdk', transport: 'GitHub REST over HTTPS', client: '@octokit/rest 22.0.1', startup_observed: false };
  return `${parts.join('\n\n')}\n\nCurrent execution-channel metadata recorded by this runner:\n${JSON.stringify(channel)}\nThese tools make real public GitHub reads when a tool result reports success. The MCP server is a local stdio process, not a hosted MCP authentication experiment. Reading historical source code or documentation does not mean that code's tests or mutation endpoints ran. No write tool is available. Distinguish current observed reads from the historical pilot described in the pinned files.`;
}

function argumentShape(task, name, args) {
  const names = ['read_repository_file', 'inspect_repository_file'].includes(name) ? ['repository', 'path']
    : name === 'inspect_release_asset' ? ['repository', 'asset_name'] : ['repository'];
  return object(args) && Object.keys(args).length === names.length && names.every(key => typeof args[key] === 'string')
    && task.sources.some(source => source.repository === args.repository)
    && (name !== 'inspect_release_asset' || args.asset_name === 'manuscript.pdf');
}

function usageTotal(usages) {
  const missing = usages.filter(value => value === null).length;
  for (const usage of usages.filter(Boolean)) check(['input_tokens', 'output_tokens', 'total_tokens'].every(key => count(usage[key]))
    && usage.total_tokens === usage.input_tokens + usage.output_tokens, 'model_usage');
  const sum = key => missing ? null : usages.reduce((n, value) => n + value[key], 0);
  return { input_tokens: sum('input_tokens'), output_tokens: sum('output_tokens'), total_tokens: sum('total_tokens'),
    reported_requests: usages.length - missing, missing_requests: missing };
}

/** Reconstruct control flow and counters, not stochastic generation or provider truth. */
export function reconstructTask(task, trace, context, prompt, responseIds = new Set()) {
  check(Array.isArray(trace) && trace.length >= 2 && trace.every((event, i) => event.sequence === i
    && event.task_id === task.id && !Object.hasOwn(event, 'journal_status')), 'task_event_order');
  let cursor = 0, rounds = 0, toolCalls = 0, measured = 0;
  const usages = [], seenCalls = new Set(), pairs = [];
  const take = type => { const event = trace[cursor++]; check(event?.type === type, 'task_event_order'); return event; };
  const start = take('task_start');
  check(start.prompt === prompt && same(start.limits, context.limits), 'task_prompt_binding');
  const finish = (status, reason, finalOutput = null) => {
    if (status === 'failed') check(take('task_error').reason === reason, 'task_terminal');
    const terminal = take('task_end'), usage = usageTotal(usages);
    check(terminal.status === status && terminal.reason === reason && terminal.rounds === rounds
      && terminal.tool_calls === toolCalls && same(terminal.usage, usage) && cursor === trace.length, 'task_terminal');
    check(time(terminal.duration_ms) && terminal.duration_ms + 0.001 >= measured, 'task_timing');
    return { status, reason, finalOutput, rounds, tool_calls: toolCalls, usage, terminal_duration_ms: terminal.duration_ms, measured_ms: measured, pairs };
  };
  while (rounds < context.limits.rounds) {
    const request = take('model_request');
    check(request.round === ++rounds && same(request.tool_names, TOOL_NAMES), 'model_event');
    const response = take('model_result');
    check(response.round === rounds && time(response.duration_ms) && Array.isArray(response.output), 'model_event');
    measured += response.duration_ms;
    if (response.response_id !== null) {
      check(typeof response.response_id === 'string' && response.response_id.length > 0 && !responseIds.has(response.response_id), 'model_event');
      responseIds.add(response.response_id);
    }
    usages.push(response.usage);
    usageTotal(usages);
    if (response.reason !== undefined) {
      check(response.status === 'failed' && /^(model_[a-z_]+|invalid_model_input|safety_stop|misalignment_enforcement)$/.test(response.reason), 'model_event');
      return finish('failed', response.reason);
    }
    let observed;
    try { observed = inspectModelResponse(response); } catch { throw new Error('model_event'); }
    check(same(response.output, observed.output) && response.stop_reason === observed.stop_reason, 'model_event');
    if (observed.stop_reason) return finish('failed', observed.stop_reason);
    const calls = response.output.filter(item => item.type === 'function_call');
    if (!calls.length) {
      const final = response.output.flatMap(item => item.type === 'message' ? item.content.map(part => part.text) : []).join('');
      if (!final.trim()) return finish('failed', 'missing_final_output');
      let report;
      try { report = parseJSON(final, 'invalid_final_output'); }
      catch { return finish('failed', 'invalid_final_output'); }
      if (context.version === 2) {
        if (!object(report) || Object.keys(report).sort().join(',') !== 'citations,conclusion,report_markdown,task_id'
          || report.task_id !== task.id || !['report_markdown', 'conclusion'].every(key => typeof report[key] === 'string' && report[key].trim())
          || !Array.isArray(report.citations) || !report.citations.every(value => typeof value === 'string')) return finish('failed', 'invalid_final_output');
        if (Buffer.byteLength(report.report_markdown) > context.limits.reportBytes) return finish('failed', 'report_bytes_exceeded', final);
      }
      return finish('completed', 'final_output', final);
    }
    const prepared = [], batch = new Set();
    let rejected;
    for (const call of calls) {
      let reason, args;
      if (!TOOL_NAMES.includes(call.name)) reason = 'unsupported_tool';
      else if (seenCalls.has(call.call_id) || batch.has(call.call_id)) reason = 'duplicate_call_id';
      else {
        try { args = parseJSON(call.arguments, 'invalid_tool_arguments'); check(argumentShape(task, call.name, args), 'invalid_tool_arguments'); }
        catch { reason = 'invalid_tool_arguments'; }
      }
      if (reason) { rejected = { call, reason }; break; }
      batch.add(call.call_id);
      prepared.push({ call, args });
    }
    if (!rejected && calls.length > context.limits.toolCalls - toolCalls) rejected = { call: calls[0], reason: 'tool_budget_exhausted' };
    if (rejected) {
      const event = take('tool_rejected');
      check(event.round === rounds && event.call_id === rejected.call.call_id && event.name === rejected.call.name && event.reason === rejected.reason, 'tool_event');
      return finish('failed', rejected.reason);
    }
    for (const { call, args } of prepared) {
      const attempt = take('tool_attempt');
      check(attempt.round === rounds && attempt.call_id === call.call_id && attempt.name === call.name && same(attempt.arguments, args), 'tool_event');
      seenCalls.add(call.call_id); toolCalls++;
      const result = take('tool_result');
      check(result.round === rounds && result.call_id === call.call_id && result.name === call.name && time(result.duration_ms), 'tool_event');
      measured += result.duration_ms;
      pairs.push({ attempt, result });
      if (result.status === 'failed') {
        check(['tool_error', 'invalid_tool_output', 'journal_error'].includes(result.reason), 'tool_event');
        return finish('failed', result.reason);
      }
      check(result.status === 'completed' && result.output?.untrusted === true && object(result.output.data), 'tool_event');
    }
  }
  return finish('failed', 'round_budget_exhausted');
}

export function reconstructStudy(report, records, context) {
  const events = records.map(record => record.event), rows = [], groups = [], responseIds = new Set();
  const dates = records.map(record => Date.parse(record.recorded_at));
  check(dates.every((value, i) => Number.isFinite(value) && (!i || value >= dates[i - 1])), 'study_timing');
  check(events[1]?.type === 'native_setup' && report.native_setup.duration_ms <= dates[1] - dates[0] + 1, 'study_timing');
  check(Array.isArray(report.tasks) && report.tasks.length === context.manifest.tasks.length, 'task_inventory');
  let cursor = 2, stop;
  for (const [index, task] of context.manifest.tasks.entries()) {
    const row = report.tasks[index];
    check(row?.id === task.id && row.lane === task.lane && object(row.result), 'task_inventory');
    let result;
    if (events[cursor]?.type === 'scheduled_task_start' && events[cursor].task_id === task.id) {
      check(!stop && !(task.lane === 'mcp' && report.native_setup.status === 'blocked'), 'study_event_order');
      const startIndex = cursor++, start = events[startIndex], prompt = expectedPrompt(task, context, report.native_setup);
      check(start.lane === task.lane && start.prompt === prompt && start.prompt_sha256 === digestBytes(prompt), 'task_prompt_binding');
      const inner = [];
      while (cursor < events.length && events[cursor].type !== 'scheduled_task_end') {
        const event = events[cursor++];
        check(['agent_event', 'read_call_start', 'read_call_result', 'read_tool_result'].includes(event.type)
          && event.task_id === task.id, 'study_event_order');
        inner.push(event);
      }
      const endIndex = cursor++, end = events[endIndex];
      check(end?.type === 'scheduled_task_end' && end.task_id === task.id, 'study_event_order');
      const trace = inner.filter(event => event.type === 'agent_event').map(event => event.event);
      check(same(row.result.trace, trace), 'task_trace_binding');
      const reconstructed = reconstructTask(task, trace, context, prompt, responseIds);
      check(time(row.result.duration_ms) && row.result.duration_ms >= reconstructed.terminal_duration_ms
        && row.result.duration_ms <= dates[endIndex] - dates[startIndex] + 1, 'task_timing');
      const { status, reason, finalOutput, rounds, tool_calls, usage } = reconstructed;
      result = { status, reason, finalOutput, rounds, tool_calls, usage, duration_ms: row.result.duration_ms, trace };
      check(same(result, row.result), 'task_result_reconstruction');
      check(end.status === status && end.reason === reason && end.result_sha256 === digestBytes(JSON.stringify(row.result)), 'task_result_binding');
      groups.push({ task, events: inner, pairs: reconstructed.pairs });
    } else {
      if (!stop && row.result.reason === 'source_drift') stop = 'source_drift';
      const reason = stop ?? (task.lane === 'mcp' && report.native_setup.status === 'blocked' ? 'lane_setup_blocked' : null);
      check(reason !== null, 'study_event_order');
      result = { status: 'blocked', reason, finalOutput: null, rounds: 0, tool_calls: 0, duration_ms: 0, trace: [],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, reported_requests: 0, missing_requests: 0 } };
      check(same(result, row.result), 'task_result_reconstruction');
    }
    if (['safety_stop', 'misalignment_enforcement'].includes(result.reason)) stop = 'study_stopped_after_safety_signal';
    if (result.reason === 'journal_error') stop = 'study_stopped_after_journal_error';
    const checks = mechanicalChecks(task, result);
    check(same(checks, row.mechanical_checks), 'task_check_mismatch');
    rows.push({ id: task.id, lane: task.lane, result });
  }
  if (events[cursor]?.type === 'native_close_failed') {
    check(same(events[cursor], { type: 'native_close_failed' }) && report.native_setup.status === 'ready', 'study_event_order');
    cursor++;
  }
  check(cursor === events.length - 1 && events[cursor].type === 'end', 'study_event_order');
  const summary = studySummary(context.manifest.tasks, rows);
  check(same(summary, report.summary), 'summary_mismatch');
  check(report.duration_ms + 0.001 >= summary.task_wall_ms + report.native_setup.duration_ms
    && report.duration_ms <= dates.at(-1) - dates[0] + 1, 'study_timing');
  return { summary, groups };
}

const TAG = 'v0.2.0-draft.1', ASSET = 'manuscript.pdf', MAX_BYTES = 2 * 1024 * 1024;
const releaseURL = repository => `https://github.com/${repository}/releases/tag/${TAG}`;
const assetURL = repository => `https://github.com/${repository}/releases/download/${TAG}/${ASSET}`;
const sourceURL = source => `https://github.com/${source.repository}/blob/${source.ref}/${source.path.split('/').map(encodeURIComponent).join('/')}`;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const advertisedDigest = value => value === null || (typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value));
const NATIVE_FAILURES = new Set(['provider_read_failure', ...[401, 403, 404, 429, 500, 502, 503, 504].map(n => `provider_read_failure_${n}`),
  'mcp_tool_error', 'mcp_timeout', 'mcp_transport_error', 'mcp_invalid_file_result', 'release_binding']);
const READ_FAILURES = new Set(['invalid_arguments', 'repository_not_allowed', 'source_not_allowed', 'invalid_file_result',
  'file_binding_mismatch', 'invalid_file_utf8', 'file_too_large', 'invalid_release', 'asset_not_allowed', 'asset_not_found',
  'asset_too_large', 'invalid_asset_result', 'asset_size_mismatch', 'asset_digest_mismatch', 'reader_unavailable',
  'invalid_reader_metadata', 'reader_metadata_not_public', 'reader_metadata_too_large']);

function nativeFileBytes(metadata, source, lane) {
  check(object(metadata) && object(metadata.native_response), 'read_native_file');
  const [owner, repo] = source.repository.split('/'), { path, ref } = source;
  if (lane === 'mcp') {
    const uri = `repo://${owner}/${repo}/sha/${ref}/contents/${path}`;
    check(metadata.transport === 'official-github-mcp-stdio' && metadata.resource_uri === uri
      && same(metadata.native_request, { name: 'get_file_contents', arguments: { owner, repo, path, sha: ref } })
      && metadata.native_response_sha256 === digestBytes(JSON.stringify(metadata.native_response)), 'read_native_file');
    try { return Buffer.from(decodeFileResult(metadata.native_response, { uri }).text); }
    catch { throw new Error('read_native_file'); }
  }
  check(lane === 'sdk' && metadata.sdk === '@octokit/rest@22.0.1'
    && same(metadata.native_request, { route: 'GET /repos/{owner}/{repo}/contents/{path}', owner, repo, path, ref }), 'read_native_file');
  const data = metadata.native_response;
  check(data.type === 'file' && data.path === path && data.encoding === 'base64' && typeof data.content === 'string', 'read_native_file');
  const encoded = data.content.replace(/[\r\n]/g, ''), bytes = Buffer.from(encoded, 'base64');
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  check(bytes.toString('base64') === encoded && bytes.length <= MAX_BYTES && data.size === bytes.length
    && data.sha === blob && metadata.git_blob_sha === blob, 'read_native_file');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  check(data.url === `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${ref}`
    && data.html_url === sourceURL(source) && data.download_url === `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${encodedPath}`
    && data.git_url === `https://api.github.com/repos/${owner}/${repo}/git/blobs/${blob}`, 'read_native_file');
  for (const [key, value] of Object.entries({ self: data.url, git: data.git_url, html: data.html_url })) {
    if (data._links !== undefined) check(data._links?.[key] === value, 'read_native_file');
  }
  return bytes;
}

function checkFile(source, criteria, lane, name, normalized, native, visible, counters) {
  const reference = criteria.sources.find(value => sourceURL(value) === sourceURL(source));
  check(reference && digest(reference.raw_sha256) && count(reference.byte_length), 'read_evidence_reference');
  const bytes = nativeFileBytes(native.reader_metadata, source, lane);
  check(bytes.length === reference.byte_length && digestBytes(bytes) === reference.raw_sha256, 'read_evidence_bytes');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('read_evidence_bytes'); }
  const includeText = name === 'read_repository_file';
  check(Buffer.from(text).equals(bytes) && bytes.length <= (includeText ? 180000 : MAX_BYTES), 'read_evidence_bytes');
  const expected = { status: 'ok', lane, repository: source.repository, path: source.path, ref: source.ref,
    source_url: sourceURL(source), sha256: reference.raw_sha256, bytes: bytes.length };
  check(same(normalized.result, expected) && normalized.source_url === expected.source_url
    && same(visible, { ...expected, ...(includeText ? { text } : {}) }), 'read_projection');
  check(includeText ? normalized.content_base64 === bytes.toString('base64') : !Object.hasOwn(normalized, 'content_base64'), 'read_evidence_bytes');
  counters.file_observations++;
  counters.native_file_observations++;
  if (includeText) counters.retained_text_observations++;
}

function checkRelease(result, repository, lane) {
  check(object(result) && count(result.id) && result.id > 0 && result.draft === false && typeof result.prerelease === 'boolean'
    && Array.isArray(result.assets) && result.assets.length <= 1, 'read_release_projection');
  for (const asset of result.assets) check(same(Object.keys(asset).sort(), ['digest', 'name', 'size', 'url'])
    && asset.name === ASSET && count(asset.size) && asset.url === assetURL(repository) && advertisedDigest(asset.digest), 'read_release_projection');
  check(same(result, { status: 'ok', lane, repository, id: result.id, tag: TAG, html_url: releaseURL(repository),
    source_url: releaseURL(repository), draft: false, prerelease: result.prerelease, assets: result.assets }), 'read_release_projection');
}

function checkAsset(result, repository, lane, criteria, counters) {
  check(object(result) && count(result.release_id) && result.release_id > 0 && count(result.bytes) && result.bytes <= MAX_BYTES
    && digest(result.sha256) && advertisedDigest(result.advertised_digest)
    && (result.advertised_digest === null || result.advertised_digest === `sha256:${result.sha256}`), 'read_asset_projection');
  check(same(result, { status: 'ok', lane, repository, release_id: result.release_id, tag: TAG, asset_name: ASSET,
    source_url: assetURL(repository), bytes: result.bytes, sha256: result.sha256, advertised_digest: result.advertised_digest,
    digest_matches_release: result.advertised_digest === null ? null : true }), 'read_asset_projection');
  const reference = criteria.assets.find(asset => asset.repository === repository && asset.release_tag === TAG && asset.asset_name === ASSET);
  check(reference && digest(reference.raw_sha256) && count(reference.byte_length), 'read_asset_reference');
  counters.asset_comparisons.push({ source_url: result.source_url,
    matches_frozen_git_asset: result.sha256 === reference.raw_sha256 && result.bytes === reference.byte_length });
}

/** Native envelopes and model-visible projections are separate evidence layers. */
export function auditSourceObservations(groups, context) {
  const counters = { file_observations: 0, retained_text_observations: 0, native_file_observations: 0,
    release_observations: 0, native_release_observations: 0, asset_observations: 0, retained_asset_observations: 0,
    unavailable_read_tool_results: 0, native_read_calls: 0, asset_comparisons: [] };
  const gaps = new Set();
  for (const { task, events, pairs } of groups) {
    let toolIndex = 0, nativeIndex = 0;
    const accounted = new Set();
    for (const { attempt, result } of pairs) {
      const startIndex = events.findIndex(event => event.type === 'agent_event' && event.event.sequence === attempt.sequence);
      const endIndex = events.findIndex(event => event.type === 'agent_event' && event.event.sequence === result.sequence);
      check(startIndex >= 0 && endIndex > startIndex, 'read_event_order');
      const slice = events.slice(startIndex + 1, endIndex);
      slice.forEach(event => { check(event.type !== 'agent_event', 'read_event_order'); accounted.add(event); });
      const common = { tool: attempt.name, tool_call_index: ++toolIndex, lane: task.lane };
      const args = attempt.arguments, repository = args.repository, [owner, repo] = repository.split('/');
      const source = task.sources.find(source => source.repository === repository && source.path === args.path);
      const file = ['read_repository_file', 'inspect_repository_file'].includes(attempt.name);
      const asset = attempt.name === 'inspect_release_asset';
      const scopedFailure = file && !source ? 'source_not_allowed' : asset && (!task.allow_release_assets || args.asset_name !== ASSET) ? 'asset_not_allowed' : null;
      const plan = scopedFailure ? [] : file
        ? [{ method: 'readFile', arguments: { owner, repo, path: source.path, ref: source.ref }, source_url: sourceURL(source) }]
        : [{ method: 'readRelease', arguments: { owner, repo, tag: TAG }, source_url: releaseURL(repository) },
          ...(asset ? [{ method: 'readAsset', arguments: { url: assetURL(repository) }, source_url: assetURL(repository) }] : [])];
      const counts = { readFile: 0, readRelease: 0, readAsset: 0 }, native = [], metadata = [];
      let cursor = 0, nativeReason = null;
      while (slice[cursor]?.type === 'read_call_start') {
        const call = plan[native.length];
        check(call && (!native.length || native.at(-1).status === 'ok'), 'read_call_binding');
        const identity = { ...common, native_call_index: ++nativeIndex, ...call, task_id: task.id };
        check(same(slice[cursor++], { type: 'read_call_start', ...identity, status: 'started' }), 'read_call_binding');
        const observed = slice[cursor++];
        check(observed?.type === 'read_call_result' && ['ok', 'unavailable'].includes(observed.status)
          && time(observed.duration_ms) && (observed.native_reason === null || NATIVE_FAILURES.has(observed.native_reason)), 'read_call_binding');
        const expected = { type: 'read_call_result', ...identity, duration_ms: observed.duration_ms, status: observed.status,
          native_reason: observed.native_reason, ...(observed.reader_metadata === undefined ? {} : { reader_metadata: observed.reader_metadata }),
          ...(observed.status === 'unavailable' ? { reason: observed.reason } : {}) };
        check(same(observed, expected) && (observed.status === 'ok' ? observed.native_reason === null
          : ['reader_unavailable', 'invalid_reader_metadata', 'reader_metadata_not_public', 'reader_metadata_too_large'].includes(observed.reason)), 'read_call_binding');
        nativeReason = observed.native_reason;
        if (observed.reader_metadata !== undefined) metadata.push({ native_call_index: nativeIndex, method: call.method, metadata: observed.reader_metadata });
        counts[call.method]++; native.push(observed); counters.native_read_calls++;
      }
      // A throwing or incomplete journal cannot establish a complete tool result.
      check(result.status === 'completed' && slice[cursor]?.type === 'read_tool_result' && cursor === slice.length - 1, 'read_event_order');
      const normalized = slice[cursor], visible = result.output.data;
      check(normalized.task_id === task.id && Object.entries(common).every(([key, value]) => normalized[key] === value)
        && same(normalized.call_counts, counts) && normalized.native_calls === native.length
        && same(normalized.reader_metadata, metadata.length ? metadata : undefined) && normalized.native_reason === nativeReason
        && time(normalized.duration_ms) && normalized.duration_ms + 0.001 >= native.reduce((n, call) => n + call.duration_ms, 0)
        && result.duration_ms + 0.001 >= normalized.duration_ms, 'read_accounting');
      if (normalized.status === 'unavailable') {
        check(READ_FAILURES.has(normalized.reason) && same(visible, { status: 'unavailable', reason: normalized.reason })
          && !Object.hasOwn(normalized, 'result') && !Object.hasOwn(normalized, 'source_url') && !Object.hasOwn(normalized, 'content_base64')
          && same(normalized.arguments, native.length ? args : undefined), 'read_projection');
        if (scopedFailure) check(!native.length && normalized.reason === scopedFailure, 'read_call_binding');
        else check(native.length > 0 && (native.at(-1).status === 'ok' || native.at(-1).reason === normalized.reason), 'read_call_binding');
        counters.unavailable_read_tool_results++;
        continue;
      }
      check(normalized.status === 'ok' && !scopedFailure && native.length === plan.length && native.every(call => call.status === 'ok')
        && same(normalized.arguments, args) && object(normalized.result) && !Object.hasOwn(normalized, 'reason'), 'read_projection');
      if (file) checkFile(source, context.criteria, task.lane, attempt.name, normalized, native[0], visible, counters);
      else {
        check(!Object.hasOwn(normalized, 'content_base64') && same(normalized.result, visible)
          && normalized.source_url === (asset ? assetURL(repository) : releaseURL(repository)), 'read_projection');
        // Both disclosed reader versions omit raw release envelopes and asset bytes.
        // Never upgrade those normalized observations to native-byte verification.
        check(native.every(call => call.reader_metadata === undefined), 'read_unsupported_native_evidence');
        gaps.add('release_native_envelope_not_retained');
        counters.release_observations++;
        if (asset) {
          check(task.lane === 'sdk', 'read_asset_projection');
          checkAsset(visible, repository, task.lane, context.criteria, counters);
          counters.asset_observations++; gaps.add('asset_bytes_and_release_projection_not_retained');
        } else checkRelease(visible, repository, task.lane);
      }
    }
    check(events.filter(event => event.type !== 'agent_event').every(event => accounted.has(event)), 'read_event_order');
  }
  return { ...counters, coverage_gaps: [...gaps].sort() };
}

// The frozen v1 scoring shape is shared by studies 1 and 2. Do not apply a new
// rubric to old evidence; auditFrozenInputs verifies the supported source hash.
function baseCitation(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.search || url.username || url.password || url.port) return null;
    if (url.hash && !/^#L[1-9][0-9]*(?:-L[1-9][0-9]*)?$/.test(url.hash)) return null;
    url.hash = ''; return url.href;
  } catch { return null; }
}

export function mechanicalChecks(task, result) {
  let report = null;
  try {
    const value = parseJSON(result.finalOutput, 'invalid_report');
    if (result.status !== 'completed' || !object(value) || Object.keys(value).sort().join(',') !== 'citations,conclusion,report_markdown,task_id'
      || value.task_id !== task.id || typeof value.report_markdown !== 'string' || !value.report_markdown.trim()
      || typeof value.conclusion !== 'string' || !Array.isArray(value.citations) || !value.citations.every(c => typeof c === 'string')) throw new Error();
    report = value;
  } catch { /* Schema validity remains separate from loop completion. */ }
  const trace = result.trace ?? [];
  const successful = trace.filter(e => e.type === 'tool_result' && e.status === 'completed' && e.output?.data?.status === 'ok');
  const observed = new Set(successful.map(e => e.output.data.source_url).filter(Boolean));
  const citationsObserved = Boolean(report && report.citations.length && report.citations.every(c => {
    const base = baseCitation(c); return base !== null && observed.has(base);
  }));
  const duration = kind => trace.filter(e => e.type === kind).reduce((sum, e) => sum + (e.duration_ms ?? 0), 0);
  const model = duration('model_result'), tooling = duration('tool_result');
  return { report_schema_valid: report !== null, citations_observed: citationsObserved,
    successful_read_tool_results: successful.length, distinct_observed_sources: observed.size,
    unavailable_read_tool_results: trace.filter(e => e.type === 'tool_result' && e.output?.data?.status === 'unavailable').length,
    body_bytes: report ? Buffer.byteLength(report.report_markdown) : null,
    fits_comment_profile_bytes: report ? Buffer.byteLength(report.report_markdown) <= 8192 : false,
    quality: report ? 'not_reviewed' : 'no_result', utility: 'not_reviewed',
    timing: { model_request_ms: model, tool_handling_ms: tooling, other_task_ms: (result.duration_ms ?? 0) - model - tooling, total_task_ms: result.duration_ms ?? 0 },
    note: 'Schema, byte and citation checks do not grade semantic correctness, novelty, usefulness or permission to publish.' };
}

export function studySummary(tasks, rows) {
  check(tasks.length === rows.length && new Set(rows.map(r => r.id)).size === rows.length
    && tasks.every((task, index) => task.id === rows[index]?.id && task.lane === rows[index]?.lane), 'task_inventory');
  const completed = rows.filter(r => r.result.status === 'completed').length;
  const assessed = rows.map((row, i) => mechanicalChecks(tasks[i], row.result));
  const knownUsage = rows.every(r => r.result.usage?.missing_requests === 0);
  const tokens = key => knownUsage ? rows.reduce((sum, r) => sum + r.result.usage[key], 0) : null;
  return { scheduled_tasks: tasks.length, completed_task_loops: completed, failed_or_blocked_tasks: tasks.length - completed,
    schema_valid_reports: assessed.filter(r => r.report_schema_valid).length,
    fully_observed_citation_reports: assessed.filter(r => r.citations_observed).length,
    semantic_quality_assessed: false, externally_independent_evaluations: 0,
    model_requests: rows.reduce((sum, r) => sum + r.result.rounds, 0), read_tool_calls: rows.reduce((sum, r) => sum + r.result.tool_calls, 0),
    usage: { input_tokens: tokens('input_tokens'), output_tokens: tokens('output_tokens'), total_tokens: tokens('total_tokens') },
    task_wall_ms: rows.reduce((sum, r) => sum + r.result.duration_ms, 0),
    lanes: Object.fromEntries(['sdk', 'mcp'].map(lane => [lane, { scheduled: tasks.filter(t => t.lane === lane).length,
      completed: rows.filter(r => r.lane === lane && r.result.status === 'completed').length }])), provider_write_attempts: 0 };
}

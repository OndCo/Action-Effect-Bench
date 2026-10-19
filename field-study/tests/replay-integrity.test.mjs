import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestBytes } from '../artifacts.mjs';
import { inspectTask, summarizeStudy } from '../scoring.mjs';
import * as replay from '../replay.mjs';
import { loadRecordedSources } from '../provenance.mjs';
import * as checks from '../replay-checks.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const evidenceCommit = 'eff7bf6bee237162a7f321bbb131008f880346fb';
const sourceCommit = 'bc1d389a474c37a9c38b2b5acedbd7bb65650225';
const reportName = 'field-study-use-2026-10-19T06-33-57.736Z-0e238334.json';
const git = path => execFileSync('git', ['cat-file', 'blob', `${evidenceCommit}:reports/${path}`], {
  cwd: root, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1' },
});
const report = JSON.parse(git(reportName));
const frozen = JSON.parse(git(report.freeze.file));
const records = git(report.journal.file).toString('utf8').trimEnd().split('\n').map(JSON.parse);
const original = { report, frozen, records };

function syncClaims(bundle) {
  for (const [i, row] of bundle.report.tasks.entries()) {
    row.result.trace = bundle.records.filter(record => record.event.type === 'agent_event' && record.event.task_id === row.id).map(record => record.event.event);
    row.mechanical_checks = inspectTask(bundle.frozen.task_inputs.tasks[i], row.result);
    const end = bundle.records.find(record => record.event.type === 'scheduled_task_end' && record.event.task_id === row.id);
    if (end) Object.assign(end.event, { status: row.result.status, reason: row.result.reason, result_sha256: digestBytes(JSON.stringify(row.result)) });
  }
  bundle.report.summary = summarizeStudy(bundle.frozen.task_inputs.tasks, bundle.report.tasks);
  bundle.records.at(-1).event.outcome.summary = structuredClone(bundle.report.summary);
}

function fixture(t, change = () => {}) {
  const directory = mkdtempSync(join(tmpdir(), 'field-replay-integrity-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bundle = structuredClone(original);
  change(bundle);
  const freezeRaw = `${JSON.stringify(bundle.frozen, null, 2)}\n`;
  bundle.report.freeze.sha256 = digestBytes(freezeRaw);
  bundle.records[0].event.metadata.freeze = structuredClone(bundle.report.freeze);
  let previous = null;
  const journalRaw = bundle.records.map((old, sequence) => {
    const record = { sequence, previous_sha256: previous, recorded_at: old.recorded_at, event: old.event };
    const line = `${JSON.stringify({ ...record, sha256: digestBytes(JSON.stringify(record)) })}\n`;
    previous = digestBytes(line);
    return line;
  }).join('');
  bundle.report.journal.sha256 = digestBytes(journalRaw);
  const reportRaw = `${JSON.stringify(bundle.report, null, 2)}\n`;
  for (const [name, raw] of [[reportName, reportRaw], [bundle.report.freeze.file, freezeRaw]]) {
    writeFileSync(join(directory, name), raw);
    writeFileSync(join(directory, `${name}.sha256`), `${digestBytes(raw)}  ${name}\n`);
  }
  writeFileSync(join(directory, bundle.report.journal.file), journalRaw);
  return { path: join(directory, reportName), bundle };
}

test('replays the preserved first run from its committed inputs after round-two edits', t => {
  const copy = fixture(t);
  const result = replay.replayStudy(copy.path);
  assert.equal(result.valid, true);
  assert.deepEqual(result.summary, original.report.summary);
  assert.equal(result.source_revisions.bench, sourceCommit);
  assert.equal(result.study_version, 1);
  assert.equal(copy.bundle.report.tasks[1].mechanical_checks.body_bytes, 7270);
});

test('unknown metadata-only source without a digest is not a verified observation', () => {
  assert.throws(() => replay.auditReadEvidence([{ type: 'read_tool_result', status: 'ok', tool: 'inspect_repository_file',
    source_url: 'https://github.com/unknown/unknown/blob/unknown/file', result: {} }], { sources: [] }), /read_evidence/);
});

test('metadata-only file size must agree with the frozen byte count', () => {
  const source = { repository: 'OndCo/Action-Effect-Bench', path: 'README.md', ref: 'a'.repeat(40), raw_sha256: digestBytes('body'), byte_length: 4 };
  assert.throws(() => replay.auditReadEvidence([{ type: 'read_tool_result', status: 'ok', tool: 'inspect_repository_file',
    source_url: `https://github.com/${source.repository}/blob/${source.ref}/${source.path}`, result: { sha256: source.raw_sha256, bytes: 999 } }], { sources: [source] }), /read_evidence/);
});

for (const [label, change, reason] of [
  ['model configuration', b => { b.report.configuration.azure_model.deployment = 'different-model'; }, /configuration_binding/],
  ['reported native binary', b => { b.report.native_setup.inventory.executable_sha256 = '0'.repeat(64); }, /native_setup_binding/],
  ['reported native protocol', b => { b.report.native_setup.inventory.protocol_version = '2099-01-01'; }, /native_setup_binding/],
  ['matched but unpinned native binary', b => {
    b.report.native_setup.inventory.executable_sha256 = '0'.repeat(64);
    b.records.find(r => r.event.type === 'native_setup').event.inventory.executable_sha256 = '0'.repeat(64);
  }, /native_inventory/],
  ['matched but altered tool schema', b => {
    b.report.native_setup.inventory.tools[0].inputSchema.properties.owner.type = 'number';
    b.records.find(r => r.event.type === 'native_setup').event.inventory = structuredClone(b.report.native_setup.inventory);
  }, /native_inventory/],
  ['publication scope', b => { b.report.scopes.new_provider_writes = true; }, /study_scope/],
  ['external population', b => { b.report.population = 'independent-evaluation'; }, /study_scope/],
  ['run duration', b => { b.report.duration_ms += 1; }, /final_outcome_binding/],
  ['sealed invalidation', b => { b.records.at(-1).event.outcome.status = 'invalidated'; }, /final_outcome_binding/],
  ['sealed source drift', b => { b.records.at(-1).event.outcome.source_inventory_unchanged = false; }, /final_outcome_binding/],
  ['freeze model configuration', b => { b.frozen.model_configuration.max_output_tokens += 1; }, /configuration_binding/],
  ['freeze order', b => { b.frozen.selected_task_order.reverse(); }, /freeze_metadata/],
  ['freeze population', b => { b.frozen.population = 'external'; }, /freeze_metadata/],
  ['freeze write flag', b => { b.frozen.new_provider_writes_enabled = true; }, /freeze_metadata/],
  ['freeze chronology claim', b => { b.frozen.created_before_scored_model_requests = false; }, /freeze_metadata/],
  ['journal task inventory', b => { b.records[0].event.metadata.tasks.pop(); }, /journal_metadata/],
  ['journal population', b => { b.records[0].event.metadata.population = 'external'; }, /journal_metadata/],
  ['journal run identity', b => { b.records[0].event.run_id = 'different-run'; }, /journal_metadata/],
  ['duplicate native setup', b => { b.records.splice(2, 0, structuredClone(b.records[1])); }, /native_setup_binding/],
  ['undisclosed native close failure', b => { b.records.splice(-1, 0, { recorded_at: b.records.at(-1).recorded_at, event: { type: 'native_close_failed' } }); }, /final_outcome_binding/],
]) {
  test(`rehashed artifacts cannot change ${label}`, t => {
    const copy = fixture(t, change);
    assert.throws(() => replay.replayStudy(copy.path), reason);
  });
}

test('a faithfully recorded close failure is valid evidence, not a successful run', t => {
  const copy = fixture(t, b => {
    b.report.status = b.records.at(-1).event.outcome.status = 'invalidated';
    b.records.splice(-1, 0, { recorded_at: b.records.at(-1).recorded_at, event: { type: 'native_close_failed' } });
  });
  const result = replay.replayStudy(copy.path);
  assert.equal(result.valid, true);
  assert.equal(result.study_recorded, false);
  assert.equal(result.status, 'invalidated');
});

for (const [label, change, reason] of [
  ['final text', b => { const value = JSON.parse(b.report.tasks[0].result.finalOutput); value.conclusion += ' changed'; b.report.tasks[0].result.finalOutput = JSON.stringify(value); }, /task_result_reconstruction/],
  ['model count', b => { b.report.tasks[0].result.rounds += 100; }, /task_result_reconstruction/],
  ['tool count', b => { b.report.tasks[0].result.tool_calls += 100; }, /task_result_reconstruction/],
  ['usage totals', b => { b.report.tasks[0].result.usage.input_tokens++; b.report.tasks[0].result.usage.total_tokens++; }, /task_result_reconstruction/],
  ['failed status', b => { Object.assign(b.report.tasks[0].result, { status: 'failed', reason: 'model_timeout', finalOutput: null }); }, /task_result_reconstruction/],
  ['blocked status with actual events', b => { Object.assign(b.report.tasks[0].result, { status: 'blocked', reason: 'lane_setup_blocked', finalOutput: null }); }, /task_result_reconstruction/],
  ['impossible task duration', b => { b.report.tasks[0].result.duration_ms = 0; }, /task_timing/],
  ['terminal event counters', b => { b.records.find(r => r.event.type === 'agent_event' && r.event.event.type === 'task_end').event.event.rounds++; }, /task_terminal/],
  ['trace sequence', b => { b.records.find(r => r.event.type === 'agent_event').event.event.sequence = 100; }, /task_event_order/],
  ['reused model response', b => {
    const results = b.records.filter(r => r.event.type === 'agent_event' && r.event.event.type === 'model_result');
    results[1].event.event.response_id = results[0].event.event.response_id;
  }, /model_event/],
  ['model call versus dispatched arguments', b => {
    const event = b.records.find(r => r.event.type === 'agent_event' && r.event.event.type === 'model_result').event.event;
    const call = event.output.find(item => item.type === 'function_call');
    call.arguments = JSON.stringify({ repository: 'OndCo/Action-Effect-Bench', path: 'spec-lock.json' });
  }, /tool_event/],
  ['prompt despite a matching duplicated trace', b => {
    const start = b.records.find(r => r.event.type === 'scheduled_task_start').event;
    start.prompt = 'A different task'; start.prompt_sha256 = digestBytes(start.prompt);
    b.records.find(r => r.event.type === 'agent_event' && r.event.event.type === 'task_start').event.event.prompt = start.prompt;
  }, /task_prompt_binding/],
  ['an extra unaccounted event', b => { b.records.splice(-1, 0, { recorded_at: b.records.at(-1).recorded_at, event: { type: 'extra_operation' } }); }, /study_event_order/],
]) {
  test(`reconstruction rejects ${label} even after all duplicate claims are rehashed`, t => {
    const copy = fixture(t, b => { change(b); syncClaims(b); });
    assert.throws(() => replay.replayStudy(copy.path), reason);
  });
}

test('CLI through a symlink actually emits a replay result', t => {
  const copy = fixture(t), executable = join(copy.path, '..', 'replay-link.mjs');
  symlinkSync(fileURLToPath(new URL('../replay.mjs', import.meta.url)), executable);
  const process = spawnSync(globalThis.process.execPath, [executable, copy.path], { encoding: 'utf8', timeout: 10000 });
  assert.equal(process.status, 0, process.stderr);
  assert.ok(process.stdout.trim(), 'symlink invocation must not silently do nothing');
  assert.equal(JSON.parse(process.stdout).valid, true);
});

function versionTwoInputs() {
  const historical = loadRecordedSources(original.report.provenance);
  const replacements = new Map(['tasks.json', 'criteria.json', 'amendment-2.json'].map(name => [
    `bench/field-study/${name}`, readFileSync(new URL(`../${name}`, import.meta.url)),
  ]));
  const read = path => Buffer.from(replacements.get(path) ?? historical.read(path));
  const frozen = structuredClone(original.frozen), report = structuredClone(original.report);
  frozen.task_inputs = JSON.parse(read('bench/field-study/tasks.json'));
  frozen.tasks_sha256 = digestBytes(read('bench/field-study/tasks.json'));
  frozen.criteria_sha256 = digestBytes(read('bench/field-study/criteria.json'));
  const amendment = read('bench/field-study/amendment-2.json');
  frozen.amendment = { file: 'field-study/amendment-2.json', sha256: digestBytes(amendment), value: JSON.parse(amendment) };
  return { report, frozen, read };
}

test('version two binds the disclosed amendment without regrading first-run scores', () => {
  assert.equal(typeof replay.auditFrozenInputs, 'function');
  const { report, frozen, read } = versionTwoInputs();
  const context = replay.auditFrozenInputs(report, frozen, read);
  assert.equal(context.version, 2);
  assert.equal(context.limits.reportBytes, 6000);
  assert.equal(context.amendment.prior_report.runtime_commit, sourceCommit);
});

for (const [label, change] of [
  ['missing amendment', frozen => { delete frozen.amendment; }],
  ['amendment path', frozen => { frozen.amendment.file = '../outside.json'; }],
  ['amendment digest', frozen => { frozen.amendment.sha256 = '0'.repeat(64); }],
  ['amendment copied value', frozen => { frozen.amendment.value.response_contract.report_max_utf8_bytes++; }],
]) {
  test(`version two rejects ${label}`, () => {
    assert.equal(typeof replay.auditFrozenInputs, 'function');
    const { report, frozen, read } = versionTwoInputs();
    change(frozen);
    assert.throws(() => replay.auditFrozenInputs(report, frozen, read), /amendment_binding/);
  });
}

function readEvents(bundle, lane = 'sdk', tool = 'inspect_repository_file') {
  const native = bundle.records.find(r => r.event.type === 'read_call_result' && r.event.lane === lane && r.event.tool === tool).event;
  const match = e => e.task_id === native.task_id && e.tool_call_index === native.tool_call_index;
  return { native,
    start: bundle.records.find(r => r.event.type === 'read_call_start' && match(r.event)).event,
    normalized: bundle.records.find(r => r.event.type === 'read_tool_result' && match(r.event)).event };
}

function editMetadata(bundle, lane, edit) {
  const { native, normalized } = readEvents(bundle, lane, lane === 'mcp' ? 'read_repository_file' : 'inspect_repository_file');
  edit(native.reader_metadata);
  if (lane === 'mcp') native.reader_metadata.native_response_sha256 = digestBytes(JSON.stringify(native.reader_metadata.native_response));
  normalized.reader_metadata[0].metadata = structuredClone(native.reader_metadata);
}

test('coverage separates native-bound files, normalized release metadata and unobserved downloads', t => {
  const result = replay.replayStudy(fixture(t).path);
  assert.equal(result.file_observations, 28);
  assert.equal(result.retained_text_observations, 27);
  assert.equal(result.native_file_observations, 28);
  assert.equal(result.release_observations, 1);
  assert.equal(result.native_release_observations, 0);
  assert.equal(result.asset_observations, 0);
  assert.equal(result.native_read_calls, 29);
  assert.ok(result.coverage_gaps.includes('release_native_envelope_not_retained'));
});

for (const [label, change] of [
  ...['read_call_start', 'read_call_result', 'read_tool_result'].map(type => [`missing ${type}`, b => {
    b.records.splice(b.records.findIndex(r => r.event.type === type), 1);
  }]),
  ['an orphan native call', b => { b.records.splice(-1, 0, structuredClone(b.records.find(r => r.event.type === 'read_call_start'))); b.records.at(-2).recorded_at = b.records.at(-1).recorded_at; }],
  ['wrong native accounting', b => { readEvents(b).normalized.call_counts.readFile = 999; }],
  ['wrong native index', b => { readEvents(b).native.native_call_index = 999; }],
  ['wrong lane', b => { const e = readEvents(b); e.start.lane = e.native.lane = e.normalized.lane = 'mcp'; }],
  ['wrong dispatch ref', b => { const e = readEvents(b); e.start.arguments.ref = e.native.arguments.ref = 'f'.repeat(40); }],
  ['wrong native request ref', b => editMetadata(b, 'sdk', m => { m.native_request.ref = 'f'.repeat(40); })],
  ['wrong SDK body', b => editMetadata(b, 'sdk', m => { m.native_response.content = Buffer.from('different bytes').toString('base64'); })],
  ['wrong SDK path', b => editMetadata(b, 'sdk', m => { m.native_response.path = 'different.json'; })],
  ['wrong SDK API URL', b => editMetadata(b, 'sdk', m => { m.native_response.url += '&other=1'; })],
  ['wrong Git blob identity', b => editMetadata(b, 'sdk', m => { m.git_blob_sha = m.native_response.sha = 'f'.repeat(40); })],
  ['wrong MCP resource despite rehashing it', b => editMetadata(b, 'mcp', m => {
    m.native_response.content.find(block => block.type === 'resource').resource.uri = m.resource_uri.replace('/sha/', '/ref/');
  })],
  ['MCP isError mislabeled as success', b => editMetadata(b, 'mcp', m => { m.native_response.isError = true; })],
  ['missing file native metadata', b => {
    const e = readEvents(b); delete e.native.reader_metadata; delete e.normalized.reader_metadata;
  }],
  ['divergent duplicated reader metadata', b => { readEvents(b).normalized.reader_metadata[0].metadata.git_blob_sha = 'f'.repeat(40); }],
  ['native text versus model-visible text', b => {
    b.records.find(r => r.event.type === 'agent_event' && r.event.event.type === 'tool_result'
      && r.event.event.output?.data?.text).event.event.output.data.text += '\nchanged';
  }],
  ['metadata-only byte length in both projections', b => {
    const e = readEvents(b); e.normalized.result.bytes++;
    b.records.find(r => r.event.type === 'agent_event' && r.event.event.type === 'tool_result').event.event.output.data.bytes++;
  }],
  ['release target in both projections', b => {
    const e = readEvents(b, 'sdk', 'inspect_release'); e.normalized.result.repository = 'different/repository';
    b.records.find(r => r.event.type === 'agent_event' && r.event.event.type === 'tool_result'
      && r.event.event.name === 'inspect_release').event.event.output.data.repository = 'different/repository';
  }],
  ['release digest syntax in both projections', b => {
    readEvents(b, 'sdk', 'inspect_release').normalized.result.assets[0].digest = 'not-a-digest';
    b.records.find(r => r.event.type === 'agent_event' && r.event.event.type === 'tool_result'
      && r.event.event.name === 'inspect_release').event.event.output.data.assets[0].digest = 'not-a-digest';
  }],
]) {
  test(`native/source binding rejects ${label} after rehashing all copies`, t => {
    const copy = fixture(t, b => { change(b); syncClaims(b); });
    assert.throws(() => replay.replayStudy(copy.path), /read_|source_observation|study_event_order/);
  });
}

test('version-two prompts bind actual MCP channel metadata and declared SDK context', () => {
  const input = versionTwoInputs(), context = replay.auditFrozenInputs(input.report, input.frozen, input.read);
  const task = context.manifest.tasks.find(task => task.lane === 'mcp');
  const prompt = checks.expectedPrompt(task, context, input.report.native_setup);
  assert.ok(prompt.includes('"negotiated_protocol":"2025-11-25"'));
  assert.ok(prompt.includes('"startup_observed":true'));
  assert.ok(prompt.includes('exactly one JSON object'));
  const sdk = checks.expectedPrompt(context.manifest.tasks.find(task => task.lane === 'sdk'), context, input.report.native_setup);
  assert.ok(sdk.includes('"client":"@octokit/rest 22.0.1","startup_observed":false'));
});

function finalTrace(context, task, { text, failure = null, usage = { input_tokens: 1, output_tokens: 2, total_tokens: 3 } }) {
  const prompt = checks.expectedPrompt(task, context, original.report.native_setup);
  const status = failure ? 'failed' : 'completed', reason = failure ?? 'final_output';
  const totals = usage === null ? { input_tokens: null, output_tokens: null, total_tokens: null, reported_requests: 0, missing_requests: 1 }
    : { ...usage, reported_requests: 1, missing_requests: 0 };
  const events = [
    { type: 'task_start', prompt, limits: context.limits },
    { type: 'model_request', round: 1, tool_names: ['read_repository_file', 'inspect_repository_file', 'inspect_release', 'inspect_release_asset'] },
    { type: 'model_result', round: 1, response_id: failure ? null : 'fixture_response', model: failure ? null : 'fixture_model',
      status, usage, duration_ms: 5, output: text === undefined ? [] : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }],
      ...(failure ? { reason: failure } : { stop_reason: null }) },
    ...(failure ? [{ type: 'task_error', reason }] : []),
    { type: 'task_end', status, reason, rounds: 1, tool_calls: 0, usage: totals, duration_ms: 6 },
  ];
  return events.map((event, sequence) => ({ sequence, task_id: task.id, ...event }));
}

function legacyContext() {
  return replay.auditFrozenInputs(original.report, original.frozen, loadRecordedSources(original.report.provenance).read);
}

test('a captured model timeout remains valid failed evidence with unknown usage, not a deny or task win', t => {
  const context = legacyContext(), task = context.manifest.tasks[0];
  const trace = finalTrace(context, task, { failure: 'model_timeout', usage: null });
  const copy = fixture(t, b => {
    const start = b.records.findIndex(r => r.event.type === 'scheduled_task_start' && r.event.task_id === task.id);
    const end = b.records.findIndex(r => r.event.type === 'scheduled_task_end' && r.event.task_id === task.id);
    const at = b.records[start].recorded_at;
    b.records.splice(start + 1, end - start - 1, ...trace.map(event => ({ recorded_at: at, event: { type: 'agent_event', task_id: task.id, event } })));
    const row = b.report.tasks[0];
    Object.assign(row.result, { status: 'failed', reason: 'model_timeout', finalOutput: null, rounds: 1, tool_calls: 0,
      usage: trace.at(-1).usage, duration_ms: 7, trace });
    syncClaims(b);
  });
  const result = replay.replayStudy(copy.path);
  assert.equal(result.valid, true);
  assert.equal(result.study_recorded, true);
  assert.equal(result.summary.failed_or_blocked_tasks, 1);
  assert.equal(result.summary.completed_task_loops, 5);
  assert.equal(result.summary.usage.total_tokens, null);
});

for (const [label, body, expected] of [
  ['at budget', 'a'.repeat(6000), 'completed'],
  ['over UTF-8 budget', '\u00e9'.repeat(3001), 'failed'],
]) {
  test(`amended final output ${label} is reconstructed without truncation`, () => {
    const input = versionTwoInputs(), context = replay.auditFrozenInputs(input.report, input.frozen, input.read);
    const task = context.manifest.tasks[0], text = JSON.stringify({ task_id: task.id, report_markdown: body, conclusion: 'A finding', citations: [] });
    const trace = finalTrace(context, task, { text });
    if (expected === 'failed') {
      const terminal = trace.at(-1);
      Object.assign(terminal, { status: 'failed', reason: 'report_bytes_exceeded', sequence: terminal.sequence + 1 });
      trace.splice(-1, 0, { sequence: terminal.sequence - 1, task_id: task.id, type: 'task_error', reason: 'report_bytes_exceeded' });
    }
    const result = checks.reconstructTask(task, trace, context, checks.expectedPrompt(task, context, input.report.native_setup));
    assert.equal(result.status, expected);
    assert.equal(result.finalOutput, text);
    assert.equal(result.rounds, 1);
  });
}

for (const [label, edit] of [
  ['raw digest', source => { source.raw_sha256 = '0'.repeat(64); }],
  ['byte length', source => { source.byte_length++; }],
  ['unknown repository', source => { source.repository = 'unknown/repository'; }],
  ['mutable ref', source => { source.ref = 'main'; }],
]) {
  test(`frozen source ${label} must agree with local immutable Git bytes`, () => {
    const input = versionTwoInputs(), criteria = JSON.parse(input.read('bench/field-study/criteria.json'));
    edit(criteria.sources[0]);
    const bytes = Buffer.from(JSON.stringify(criteria));
    input.frozen.criteria_sha256 = digestBytes(bytes);
    const read = path => path === 'bench/field-study/criteria.json' ? bytes : input.read(path);
    assert.throws(() => replay.auditFrozenInputs(input.report, input.frozen, read), /frozen_source|source_revision/);
  });
}

function assetObservation({ unavailable = false, sha256 = digestBytes('current asset'), advertised = true } = {}) {
  const task = legacyContext().manifest.tasks[0], repository = 'OndCo/Action-Effect-Bench';
  const url = `https://github.com/${repository}/releases/download/v0.2.0-draft.1/manuscript.pdf`;
  const attempt = { sequence: 3, task_id: task.id, type: 'tool_attempt', round: 1, call_id: 'asset_call', name: 'inspect_release_asset',
    arguments: { repository, asset_name: 'manuscript.pdf' } };
  const projected = unavailable ? { status: 'unavailable', reason: 'asset_digest_mismatch' }
    : { status: 'ok', lane: 'sdk', repository, release_id: 123, tag: 'v0.2.0-draft.1', asset_name: 'manuscript.pdf', source_url: url,
      bytes: 13, sha256, advertised_digest: advertised ? `sha256:${sha256}` : null, digest_matches_release: advertised ? true : null };
  const result = { sequence: 4, task_id: task.id, type: 'tool_result', round: 1, call_id: 'asset_call', name: 'inspect_release_asset',
    status: 'completed', duration_ms: 3, output: { untrusted: true, data: projected } };
  const common = { tool: attempt.name, tool_call_index: 1, lane: 'sdk', task_id: task.id };
  const native = [
    { method: 'readRelease', arguments: { owner: 'OndCo', repo: 'Action-Effect-Bench', tag: 'v0.2.0-draft.1' },
      source_url: `https://github.com/${repository}/releases/tag/v0.2.0-draft.1` },
    { method: 'readAsset', arguments: { url }, source_url: url },
  ].flatMap((call, index) => [
    { type: 'read_call_start', ...common, native_call_index: index + 1, ...call, status: 'started' },
    { type: 'read_call_result', ...common, native_call_index: index + 1, ...call, status: 'ok', duration_ms: 0.5, native_reason: null },
  ]);
  const normalized = { type: 'read_tool_result', ...common, arguments: attempt.arguments, status: projected.status,
    call_counts: { readFile: 0, readRelease: 1, readAsset: 1 }, native_calls: 2, duration_ms: 2, native_reason: null,
    ...(unavailable ? { reason: projected.reason } : { source_url: url, result: structuredClone(projected) }) };
  return { task, pairs: [{ attempt, result }], events: [{ type: 'agent_event', task_id: task.id, event: attempt }, ...native,
    normalized, { type: 'agent_event', task_id: task.id, event: result }] };
}

test('observed asset drift is a comparison, not corrupt evidence or a prior HTTP observation', () => {
  const result = checks.auditSourceObservations([assetObservation()], legacyContext());
  assert.equal(result.asset_observations, 1);
  assert.equal(result.retained_asset_observations, 0);
  assert.equal(result.asset_comparisons[0].matches_frozen_git_asset, false);
  assert.ok(result.coverage_gaps.includes('asset_bytes_and_release_projection_not_retained'));
});

test('a release without an advertised digest cannot acquire a positive digest-match claim', () => {
  const group = assetObservation({ advertised: false });
  assert.equal(checks.auditSourceObservations([group], legacyContext()).asset_observations, 1);
  group.events.find(event => event.type === 'read_tool_result').result.digest_matches_release = true;
  group.pairs[0].result.output.data.digest_matches_release = true;
  assert.throws(() => checks.auditSourceObservations([group], legacyContext()), /read_asset_projection/);
});

test('observed asset verification failure stays unavailable and counts the native attempts', () => {
  const result = checks.auditSourceObservations([assetObservation({ unavailable: true })], legacyContext());
  assert.equal(result.unavailable_read_tool_results, 1);
  assert.equal(result.native_read_calls, 2);
  assert.equal(result.asset_observations, 0);
});

test('asset source URL and advertised digest must match both normalized projections', () => {
  const group = assetObservation();
  group.events.find(event => event.type === 'read_tool_result').result.advertised_digest = `sha256:${'f'.repeat(64)}`;
  group.pairs[0].result.output.data.advertised_digest = `sha256:${'f'.repeat(64)}`;
  assert.throws(() => checks.auditSourceObservations([group], legacyContext()), /read_asset_projection/);
});

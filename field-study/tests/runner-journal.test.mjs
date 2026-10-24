import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertPublicValue, digestBytes } from '../artifacts.mjs';
import { runAgent } from '../agent-loop.mjs';
import { createReadTools, FieldStudyJournalError } from '../read-tools.mjs';
import { runScheduledTasks, taskPrompt } from '../study.mjs';
import { inspectTask, summarizeStudy } from '../scoring.mjs';
import { createReportPreflight, auditReportContract, summarizeReportContracts } from '../report-contract.mjs';

const runnerUrl = new URL('../run.mjs', import.meta.url);
const source = readFileSync(runnerUrl, 'utf8');
// Execute the actual CLI body, not a copied orchestration path. Every imported
// side-effect boundary is injected; no provider, credentials or disk writes run.
const body = source.replace(/^import\s+[\s\S]*?\sfrom\s+['"][^'"]+['"];\r?\n/gm, '')
  .replaceAll('import.meta.url', JSON.stringify(runnerUrl.href));
assert.doesNotMatch(body, /\bimport\s*(?:\(|\{|['"]|[A-Za-z_$])/);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const REPOSITORY = 'OndCo/Action-Effect-Bench';
const REF = 'a'.repeat(40);
const SOURCE_URL = `https://github.com/${REPOSITORY}/blob/${REF}/README.md`;
const SECRET = 'fixture-private-journal-failure';

async function runFixture({ cut, persistedBeforeThrow = false, networkFailure = false, externalFailure, closeFailure = false, reportPreflight = false } = {}) {
  const state = { modelRequests: 0, nativeReads: 0, sessionsOpened: 0, sessionCloses: 0,
    journalFailed: false, sealed: false, attemptsAfterFailure: [], persisted: [], artifacts: [], logs: [] };
  const tasks = ['sdk', 'mcp'].map((lane, index) => ({ id: `fixture-${index}`, title: 'Fixture maintenance',
    prompt: 'Read the supplied public fixture and report its availability.', lane,
    mandatory_deliverables: ['State whether the fixture read was available.'],
    sources: [{ repository: REPOSITORY, path: 'README.md', ref: REF }] }));
  const config = { github_mcp: { source_commit: REF, archive_sha256: 'b'.repeat(64), executable_sha256: 'c'.repeat(64) },
    azure_model: { endpoint: 'https://example.invalid/responses', deployment: 'fixture-model',
      timeout_ms: 100, max_output_tokens: 100, max_rounds_per_task: reportPreflight ? 3 : 2, max_tool_calls_per_task: reportPreflight ? 2 : 1 } };
  const inputs = { 'tasks.json': { version: 2, tasks }, 'tools.json': config, 'criteria.json': {},
    'report-format.json': {}, 'amendment-2.json': { study_version: 2, response_contract: { report_max_utf8_bytes: 6000 } },
    'amendment-3.json': { study_version: 3, response_contract: { report_max_utf8_bytes: 6000 },
      prompt_addition: 'Check the final report locally before handing it off.' } };

  function markJournalFailure() {
    state.journalFailed = true;
    state.atFailure = { modelRequests: state.modelRequests, nativeReads: state.nativeReads,
      persisted: structuredClone(state.persisted) };
  }
  function externalJournalFailure(point) {
    if (externalFailure !== point) return;
    markJournalFailure();
    throw new FieldStudyJournalError();
  }
  function persist(event, method = 'append') {
    if (state.journalFailed) state.attemptsAfterFailure.push({ method, type: event.type });
    const fails = !state.journalFailed && cut?.matches(event);
    if (!fails || persistedBeforeThrow) state.persisted.push(structuredClone(event));
    if (fails) {
      markJournalFailure();
      throw new Error(SECRET);
    }
  }
  const journal = { path: '/fixture/attempt.jsonl', append: event => persist(event), seal(outcome) {
    persist({ type: 'end', outcome }, 'seal');
    state.sealed = true;
    return { path: this.path, sha256: digestBytes(JSON.stringify(state.persisted)), records: state.persisted.length };
  } };
  const reader = { async readFile() {
    state.nativeReads++;
    if (networkFailure) throw new Error('provider_read_failure_503');
    return { text: 'Public fixture only.' };
  }, async readRelease() { assert.fail('Unexpected fixture release request'); },
  async readAsset() { assert.fail('Unexpected fixture asset request'); } };
  const model = { async respond(history) {
    state.modelRequests++;
    const taskId = history[1].content.match(/^Task ID: ([^\n]+)/)[1];
    const observed = history.find(item => item.type === 'function_call_output');
    const proposed = { task_id: taskId, report_markdown: '# Fixture\nNo real API was called.',
        conclusion: networkFailure ? 'The fixture read was unavailable.' : 'The fixture read succeeded.',
        citations: networkFailure ? [] : [SOURCE_URL] };
    const checked = history.some(item => item.type === 'function_call' && item.name === 'check_report_contract');
    const output = observed && reportPreflight && !checked ? [{ type: 'function_call', name: 'check_report_contract',
      call_id: `fixture_check_${state.modelRequests}`, arguments: JSON.stringify(proposed), status: 'completed' }]
      : observed ? [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text',
      text: JSON.stringify(proposed) }] }] : [{ type: 'function_call', status: 'completed',
      name: 'read_repository_file', call_id: `fixture_call_${state.modelRequests}`,
      arguments: JSON.stringify({ repository: REPOSITORY, path: 'README.md' }) }];
    return { response_id: `fixture_response_${state.modelRequests}`, model: 'fixture-model', status: 'completed',
      duration_ms: 1, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, output };
  } };
  const processFixture = { argv: ['node', fileURLToPath(runnerUrl), '--real-readonly', ...(reportPreflight ? ['--report-preflight'] : [])],
    exit(code) { this.exitCode = code; throw new Error('fixture_process_exit'); } };
  const dependencies = {
    readFileSync(url, encoding) {
      const name = basename(fileURLToPath(url));
      assert.ok(Object.hasOwn(inputs, name), `Unstubbed file read: ${name}`);
      const bytes = Buffer.from(JSON.stringify(inputs[name]));
      return encoding ? bytes.toString(encoding) : bytes;
    },
    basename, randomBytes, fileURLToPath, digestBytes, assertPublicValue, FieldStudyJournalError,
    createJournal() { persist({ type: 'begin' }, 'create'); return journal; },
    saveArtifact(_root, prefix, value) {
      state.artifacts.push({ prefix, value: structuredClone(value) });
      return { path: `/fixture/${prefix}.json`, sha256: digestBytes(JSON.stringify(value)) };
    },
    captureProvenance: () => ({}), verifyProvenance: () => true,
    credentialReaders: () => ({ github: () => 'fixture-only', azure: () => 'fixture-only' }),
    createAzureModel: () => model,
    async runAgent(options) {
      if (externalFailure === 'agent-result') {
        markJournalFailure();
        return { status: 'failed', reason: 'journal_error', finalOutput: null, rounds: 0, tool_calls: 0,
          duration_ms: 0, trace: [], usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, reported_requests: 0, missing_requests: 0 } };
      }
      return runAgent(options);
    },
    async openNativeMcp() {
      externalJournalFailure('mcp-open');
      state.sessionsOpened++;
      return { inventory: { transport: 'fixture-stdio', server: { name: 'fixture', version: 'fixture' },
        executable_sha256: 'c'.repeat(64), protocol_version: '2025-11-25' },
      async close() { state.sessionCloses++; if (cut?.closeFails || closeFailure) throw new Error('fixture_close_error'); } };
    },
    NativeMcpError: class extends Error {},
    createNativeReader() { externalJournalFailure('reader-init'); return reader; }, createGithubReader: () => reader,
    createReadTools(options) { externalJournalFailure('read-tools-init'); return createReadTools(options); },
    runScheduledTasks, taskPrompt, inspectTask, summarizeStudy, createReportPreflight, auditReportContract, summarizeReportContracts,
    process: processFixture, console: { log: (...args) => state.logs.push(args), error: (...args) => state.logs.push(args) },
    fetch: () => assert.fail('Real network access is forbidden in runner journal fixtures'),
  };
  try { await new AsyncFunction(...Object.keys(dependencies), `'use strict';\n${body}`)(...Object.values(dependencies)); }
  catch (error) { state.error = error; }
  state.exitCode = processFixture.exitCode;
  return state;
}

function assertFailStop(state) {
  assert.equal(state.journalFailed, true, 'The injected failure point must actually execute');
  assert.equal(state.sessionCloses, state.sessionsOpened, 'An opened session must close even when setup journaling fails');
  assert.equal(state.modelRequests, state.atFailure.modelRequests, 'No new model request after journal failure');
  assert.equal(state.nativeReads, state.atFailure.nativeReads, 'No new native read after journal failure');
  assert.deepEqual(state.attemptsAfterFailure, [], 'Never append or seal after possible persistence followed by failure');
  assert.deepEqual(state.persisted, state.atFailure.persisted, 'Preserve the incomplete journal without replacement or retry');
  assert.equal(state.sealed, false, 'A throwing journal must not be declared complete');
  assert.equal(state.artifacts.some(({ value }) => value.status === 'recorded'), false);
  assert.equal(state.exitCode, 1);
  assert.equal(state.error?.code, 'FIELD_STUDY_JOURNAL_ERROR');
  assert.equal(state.error.message, 'journal_error');
  assert.equal(Object.hasOwn(state.error, 'cause'), false);
  assert.equal(String(state.error.stack).includes(SECRET), false);
  assert.equal(JSON.stringify({ logs: state.logs, artifacts: state.artifacts }).includes(SECRET), false);
}

const cuts = [
  { name: 'journal creation', matches: event => event.type === 'begin' },
  { name: 'native setup record', matches: event => event.type === 'native_setup' },
  { name: 'scheduled task start', matches: event => event.type === 'scheduled_task_start' },
  { name: 'agent task start', matches: event => event.type === 'agent_event' && event.event.type === 'task_start' },
  { name: 'model result', matches: event => event.type === 'agent_event' && event.event.type === 'model_result' },
  { name: 'native call start', matches: event => event.type === 'read_call_start' },
  { name: 'native call result', matches: event => event.type === 'read_call_result' },
  { name: 'successful read tool result', matches: event => event.type === 'read_tool_result' && event.status === 'ok' },
  { name: 'unavailable read tool result', networkFailure: true,
    matches: event => event.type === 'read_tool_result' && event.status === 'unavailable' },
  { name: 'agent task end', matches: event => event.type === 'agent_event' && event.event.type === 'task_end' },
  { name: 'scheduled task end', matches: event => event.type === 'scheduled_task_end' },
  { name: 'session-close failure record', closeFails: true, matches: event => event.type === 'native_close_failed' },
  { name: 'journal seal', matches: event => event.type === 'end' },
];

for (const cut of cuts) {
  for (const persistedBeforeThrow of [false, true]) {
    test(`runner fail-stops at ${cut.name}: ${persistedBeforeThrow ? 'possibly persisted' : 'not persisted'}`, async () => {
      const state = await runFixture({ cut, persistedBeforeThrow, networkFailure: cut.networkFailure });
      assertFailStop(state);
    });
  }
}

for (const externalFailure of ['mcp-open', 'reader-init', 'read-tools-init', 'agent-result']) {
  for (const closeFailure of [false, true]) {
    test(`external ${externalFailure} journal signal stops the runner${closeFailure ? ' even when cleanup fails' : ''}`, async () => {
      assertFailStop(await runFixture({ externalFailure, closeFailure }));
    });
  }
}

test('cleanup failure cannot append after a possibly persisted read-result journal failure', async () => {
  assertFailStop(await runFixture({ cut: cuts.find(cut => cut.name === 'native call result'),
    persistedBeforeThrow: true, closeFailure: true }));
});

for (const networkFailure of [false, true]) {
  test(`healthy runner journal completes with ${networkFailure ? 'ordinary native unavailability' : 'successful fixture reads'}`, async () => {
    const state = await runFixture({ networkFailure });
    assert.equal(state.error, undefined);
    assert.ok(state.exitCode === undefined || state.exitCode === 0);
    assert.equal(state.journalFailed, false);
    assert.equal(state.sealed, true);
    assert.equal(state.sessionsOpened, 1);
    assert.equal(state.sessionCloses, 1);
    assert.equal(state.modelRequests, 4);
    assert.equal(state.nativeReads, 2);
    const report = state.artifacts.find(({ value }) => value.format === 'field-study-use/1').value;
    assert.equal(report.status, 'recorded');
    assert.equal(report.summary.scheduled_tasks, 2);
    assert.equal(report.summary.completed_task_loops, 2);
    assert.equal(report.summary.provider_write_attempts, 0);
  });
}

test('opt-in preflight edition separates local checks, read calls and handoff readiness', async () => {
  const state = await runFixture({ reportPreflight: true });
  assert.equal(state.error, undefined);
  const report = state.artifacts.find(({ value }) => value.format === 'field-study-use/2').value;
  assert.equal(report.contract_summary.tasks_ready_for_maintainer_review, 2);
  assert.equal(report.summary.read_tool_calls, 2);
  assert.equal(report.summary.local_preflight_calls, 2);
  assert.equal(report.summary.model_tool_calls, 4);
  assert.equal(state.nativeReads, 2);
  assert.equal(state.modelRequests, 6);
  assert(report.tasks.every(row => row.contract_checks.ready));
});

test('opt-in edition does not label unavailable sources ready', async () => {
  const state = await runFixture({ reportPreflight: true, networkFailure: true });
  assert.equal(state.error, undefined);
  const report = state.artifacts.find(({ value }) => value.format === 'field-study-use/2').value;
  assert.equal(report.summary.completed_task_loops, 2);
  assert.equal(report.contract_summary.tasks_ready_for_maintainer_review, 0);
  assert.equal(state.exitCode, 1);
});

for (const persistedBeforeThrow of [false, true]) {
  test(`preflight feedback persistence failure stops the whole study (${persistedBeforeThrow})`, async () => {
    assertFailStop(await runFixture({ reportPreflight: true, persistedBeforeThrow,
      cut: { matches: event => event.type === 'agent_event' && event.event.type === 'tool_result' && event.event.name === 'check_report_contract' } }));
  });
}

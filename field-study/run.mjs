import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createJournal, saveArtifact, digestBytes, assertPublicValue } from './artifacts.mjs';
import { captureProvenance, verifyProvenance } from './provenance.mjs';
import { credentialReaders } from './credentials.mjs';
import { createAzureModel } from './model-client.mjs';
import { runAgent } from './agent-loop.mjs';
import { openNativeMcp, NativeMcpError } from './native-mcp.mjs';
import { createNativeReader } from './native-reader.mjs';
import { createGithubReader } from './github-reader.mjs';
import { createReadTools, FieldStudyJournalError } from './read-tools.mjs';
import { runScheduledTasks, taskPrompt } from './study.mjs';
import { inspectTask, summarizeStudy } from './scoring.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--real-readonly') {
  throw new Error('Use --real-readonly for paid model and live public reads. Replay is a separate offline command.');
}
const readJSON = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const manifest = readJSON('./tasks.json'), config = readJSON('./tools.json'), reportSchema = readJSON('./report-format.json');
const amendmentBytes = readFileSync(new URL('./amendment-2.json', import.meta.url));
const amendment = JSON.parse(amendmentBytes);
const criteriaBytes = readFileSync(new URL('./criteria.json', import.meta.url));
const output = fileURLToPath(new URL('../reports/', import.meta.url));
const runId = `field-use-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(3).toString('hex')}`;
const provenance = captureProvenance();
const freeze = saveArtifact(output, 'field-study-freeze', {
  format: 'field-study-freeze/1', created_before_scored_model_requests: true,
  tasks_sha256: digestBytes(readFileSync(new URL('./tasks.json', import.meta.url))),
  criteria_sha256: digestBytes(criteriaBytes), model_configuration: config.azure_model,
  amendment: { file: 'field-study/amendment-2.json', sha256: digestBytes(amendmentBytes), value: amendment },
  task_inputs: manifest, provenance, population: 'exposed-internal-maintainer-use',
  selected_task_order: manifest.tasks.map(t => t.id), new_provider_writes_enabled: false,
});
let journalFailed = false;
const isJournalFailure = error => error !== null && typeof error === 'object'
  && Object.getOwnPropertyDescriptor(error, 'code')?.value === 'FIELD_STUDY_JOURNAL_ERROR';
function failJournal() {
  journalFailed = true;
  process.exitCode = 1;
  throw new FieldStudyJournalError();
}
function journalOperation(operation) {
  if (journalFailed) failJournal();
  try { return operation(); }
  catch { failJournal(); }
}
const journal = journalOperation(() => createJournal(output, runId, { freeze: { file: basename(freeze.path), sha256: freeze.sha256 },
  population: 'real-model-readonly-maintainer-use', tasks: manifest.tasks.map(t => ({ id: t.id, lane: t.lane })) }));
const append = event => journalOperation(() => journal.append(event));
const started = performance.now(), credentials = credentialReaders();
let githubToken, azureCredential, session, setup, closeFailure = false;
const github = () => githubToken ??= credentials.github();
const sdk = createGithubReader({ tokenProvider: github });
const modelConfig = config.azure_model;
const model = createAzureModel({ endpoint: modelConfig.endpoint, deployment: modelConfig.deployment,
  authProvider: () => azureCredential ??= credentials.azure(), timeoutMs: modelConfig.timeout_ms,
  maxOutputTokens: modelConfig.max_output_tokens, reportSchema });
let rows;
try {
  const setupStarted = performance.now();
  try {
    const pin = config.github_mcp;
    session = await openNativeMcp({ binary: fileURLToPath(new URL('./.tools/github-mcp-server', import.meta.url)),
      tokenProvider: github, timeoutMs: 60000, pins: { source_commit: pin.source_commit,
        archive_sha256: pin.archive_sha256, executable_sha256: pin.executable_sha256 } });
    setup = { status: 'ready', duration_ms: performance.now() - setupStarted, inventory: session.inventory };
  } catch (error) {
    if (isJournalFailure(error)) failJournal();
    setup = { status: 'blocked', duration_ms: performance.now() - setupStarted,
      reason: error instanceof NativeMcpError ? error.code : 'setup_failed' };
  }
  append({ type: 'native_setup', ...setup });
  const mcp = session ? createNativeReader({ session }) : null;
  rows = await runScheduledTasks({ tasks: manifest.tasks, blockedLanes: session ? [] : ['mcp'],
    sourceCheck: () => verifyProvenance(provenance), runOne: async task => {
      const channel = task.lane === 'mcp' ? {
        lane: 'mcp', transport: setup.inventory.transport, server: {
          name: setup.inventory.server.name, version: setup.inventory.server.version,
          executable_sha256: setup.inventory.executable_sha256,
        }, negotiated_protocol: setup.inventory.protocol_version, startup_observed: setup.status === 'ready',
      } : { lane: 'sdk', transport: 'GitHub REST over HTTPS', client: '@octokit/rest 22.0.1', startup_observed: false };
      const prompt = `${taskPrompt(task)}\n\nCurrent execution-channel metadata recorded by this runner:\n${JSON.stringify(channel)}\nThese tools make real public GitHub reads when a tool result reports success. The MCP server is a local stdio process, not a hosted MCP authentication experiment. Reading historical source code or documentation does not mean that code's tests or mutation endpoints ran. No write tool is available. Distinguish current observed reads from the historical pilot described in the pinned files.`;
      append({ type: 'scheduled_task_start', task_id: task.id, lane: task.lane, prompt, prompt_sha256: digestBytes(prompt) });
      console.log(JSON.stringify({ task: task.id, lane: task.lane, status: 'started' }));
      const tools = createReadTools({ task, sdk, mcp, journal: { append: event => append({ ...event, task_id: task.id }) } });
      const result = await runAgent({ task: { id: task.id, prompt }, model, tools,
        journal: event => append({ type: 'agent_event', task_id: task.id, event }),
        limits: { rounds: modelConfig.max_rounds_per_task, toolCalls: modelConfig.max_tool_calls_per_task,
          reportBytes: amendment.response_contract.report_max_utf8_bytes } });
      if (result.reason === 'journal_error') failJournal();
      assertPublicValue(result);
      append({ type: 'scheduled_task_end', task_id: task.id, status: result.status, reason: result.reason,
        result_sha256: digestBytes(JSON.stringify(result)) });
      console.log(JSON.stringify({ task: task.id, lane: task.lane, status: result.status,
        reason: result.reason, rounds: result.rounds, calls: result.tool_calls, duration_ms: result.duration_ms }));
      return result;
    } });
} catch (error) {
  if (isJournalFailure(error)) failJournal();
  throw error;
} finally {
  try {
    if (session) {
      try { await session.close(); }
      catch (error) {
        closeFailure = true;
        if (isJournalFailure(error)) failJournal();
        // A failed append may have persisted; cleanup must not resume that journal.
        if (!journalFailed) append({ type: 'native_close_failed' });
      }
    }
  } finally {
    githubToken = undefined;
    azureCredential = undefined;
  }
}
const summary = summarizeStudy(manifest.tasks, rows);
const sourceUnchanged = verifyProvenance(provenance);
const status = sourceUnchanged && !closeFailure ? 'recorded' : 'invalidated';
const duration_ms = performance.now() - started;
const sealed = journalOperation(() => journal.seal({ status, duration_ms, summary, source_inventory_unchanged: sourceUnchanged }));
const artifact = saveArtifact(output, 'field-study-use', { format: 'field-study-use/1',
  population: 'same-project-real-model-maintainer-use', status, duration_ms,
  freeze: { file: basename(freeze.path), sha256: freeze.sha256 },
  journal: { file: basename(sealed.path), sha256: sealed.sha256 }, provenance,
  configuration: config, native_setup: setup, source_inventory_unchanged: sourceUnchanged,
  summary, tasks: rows.map((row, i) => ({ ...row, mechanical_checks: inspectTask(manifest.tasks[i], row.result) })),
  scopes: { customer_production: false, independent_external_evaluation: false, new_provider_writes: false,
    read_tools_are_profile_authorization: false, quality_requires_separate_review: true },
});
console.log(JSON.stringify({ status, report: artifact.path, sha256: artifact.sha256, summary }));
if (status !== 'recorded' || summary.failed_or_blocked_tasks) process.exitCode = 1;

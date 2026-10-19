import { execFileSync } from 'node:child_process';
import { constants, copyFileSync, mkdirSync, readFileSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createJournal, digestBytes, saveArtifact, verifyJournal, assertPublicValue } from './artifacts.mjs';
import { readState, writeState, replaceState, scenarioPolicy, readWritePermits } from './write-artifacts.mjs';
import { captureProvenance, verifyProvenance, loadRecordedSources } from './provenance.mjs';
import { frozenWriteInputs, validateWriteManifest } from './write-config.mjs';
import { buildWritePlan } from './write-plan.mjs';
import { openNativeMcp } from './native-mcp.mjs';
import { credentialReaders } from './credentials.mjs';
import { superviseWorker } from './write-supervisor.mjs';
import { githubProvider, receiptFrom } from '../runtime-pilot/provider.mjs';
import { load } from '../runtime-pilot/ledger.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const reportsRoot = fileURLToPath(new URL('../reports/', import.meta.url));
const baseTarget = { owner: 'OndCo', repo: 'Action-Effect-Bench' };

export function assertUnstartedAttempt(previous, journalBytes) {
  const verified = verifyJournal(journalBytes);
  const rows = verified.valid ? journalBytes.toString('utf8').trimEnd().split('\n').map(JSON.parse) : [];
  if (previous?.format !== 'action-effect-owned-write-study/1' || previous.status !== 'stopped'
    || previous.failure !== 'worker_missing_output' || previous.phases.length || previous.cases.length
    || previous.write_permits.length || !verified.valid || verified.complete || rows.length !== 3
    || rows.map(row => row.event.type).join(',') !== 'begin,ledger_before,worker_failure'
    || rows[1].event.state !== null || rows[0].event.metadata.manifest_sha256 !== previous.manifest_sha256
    || rows[0].event.metadata.scenario_id !== previous.manifest.plan.scenarios[0].id
    || rows[0].event.metadata.mode !== 'execute') throw new Error('cannot_adopt_started_attempt');
  return true;
}

export async function adoptUnstartedStudy(previousManifestPath, runId) {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(runId)) throw new Error('write_run_id');
  const oldRoot = realpathSync(dirname(previousManifestPath)), old = readState(previousManifestPath);
  const index = readState(join(oldRoot, 'public-output.json')).value;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(index.file)) throw new Error('cannot_adopt_started_attempt');
  const previousRecord = readState(join(reportsRoot, index.file), index.sha256, 30_000_000), previous = previousRecord.value;
  if (old.sha256 !== previous.manifest_sha256) throw new Error('cannot_adopt_started_attempt');
  const firstJournalPath = join(oldRoot, 'journals', `${old.value.plan.scenarios[0].id}.execute.jsonl`);
  const firstJournal = readFileSync(firstJournalPath);
  assertUnstartedAttempt(previous, firstJournal);
  for (const dir of ['ledger', 'permits']) if (existsSync(join(oldRoot, dir)) && readdirSync(join(oldRoot, dir)).length) {
    throw new Error('cannot_adopt_started_attempt');
  }
  if (readdirSync(join(oldRoot, 'journals')).length !== 1) throw new Error('cannot_adopt_started_attempt');
  validateWriteManifest(old.value);
  loadRecordedSources(old.value.provenance);
  const root = join(here, '.runtime-private', 'owned-write', runId);
  if (existsSync(root)) throw new Error('write_setup_exists_do_not_repeat');
  const provenance = captureProvenance();
  if (!verifyProvenance(provenance) || Object.values(provenance.environment.repositories).some(repo => repo.dirty)
    || !provenance.environment.opa_binary.matches_release_pin) throw new Error('commit_sources_before_owned_write');
  const sdk = githubProvider(), principal = await sdk.principal(), target = old.value.target;
  if (principal !== old.value.principal) throw new Error('adoption_principal');
  const current = await sdk.listComments(target), issue = await sdk.readIssue(target);
  if (current.length !== 0 || issue.body !== old.value.setup.issue.body || issue.user?.login !== principal
    || issue.html_url !== old.value.setup.issue.html_url) throw new Error('cannot_adopt_nonempty_or_changed_issue');
  const inputs = frozenWriteInputs();
  const manifest = { ...old.value, run_id: runId, created_at: new Date().toISOString(), provenance,
    plan: buildWritePlan({ report: inputs.report, review: inputs.review, target, principal, runId }),
    reuse_of_unstarted_setup: { previous_run_id: old.value.run_id, previous_study_file: index.file,
      previous_study_sha256: previousRecord.sha256, previous_manifest_sha256: old.sha256,
      failed_worker_journal: `${old.value.run_id}.${basename(firstJournalPath)}`,
      failed_worker_journal_sha256: digestBytes(firstJournal), previous_native_comment_calls: 0,
      fresh_comments_before_adoption: current, observation_time: new Date().toISOString(),
      reason: 'Pre-reservation wire-value comparison failed on JavaScript object prototypes. No occurrence or write permit existed.' } };
  validateWriteManifest(manifest);
  for (const scenario of manifest.plan.scenarios) writeState(join(root, 'policies'), `${scenario.id}.json`, scenarioPolicy(scenario, 'initial'));
  return writeState(root, 'manifest.json', manifest);
}

export function assessPhase(phase, scenario, mode) {
  if (phase?.journal?.valid !== true || !Number.isSafeInteger(phase.process?.pid) || phase.process.pid < 1) return false;
  const crash = mode === 'execute' && scenario.expected.initial_outcome === 'process-killed';
  if (crash) return phase.process.signal === 'SIGKILL' && phase.process.exit_code === null
    && phase.process.planned_kill === true && phase.result === null && phase.journal.complete === false
    && phase.ledger_after?.state === 'inflight';
  if (phase.process.exit_code !== 0 || phase.process.signal !== null || phase.process.planned_kill
    || phase.journal.complete !== true) return false;
  if (mode === 'probe') return phase.result?.outcome === 'duplicate_suppressed'
    && phase.result.authority?.decision === 'not_evaluated';
  const expected = mode === 'execute' ? scenario.expected.initial_outcome : scenario.expected.recovery_outcome;
  if (phase.result?.outcome !== expected) return false;
  if (mode === 'reconcile' && phase.result.automatic_resend !== false) return false;
  if (mode === 'execute' && (phase.result.authority?.decision !== scenario.expected.decision
    || (scenario.expected.reason !== null && phase.result.reason !== scenario.expected.reason))) return false;
  if (expected === 'confirmed') return phase.result.receipt?.content_matches === true && phase.ledger_after?.state === 'confirmed';
  if (expected === 'withheld') return phase.ledger_after?.state === 'withheld';
  if (expected === 'unknown') return ['unknown', 'inflight'].includes(phase.ledger_after?.state);
  return false;
}

function ghJson(args, input) {
  let bytes;
  try { bytes = execFileSync('gh', ['api', ...args], { input: input === undefined ? undefined : JSON.stringify(input),
    maxBuffer: 2_000_000, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch { throw new Error('github_setup_outcome_unavailable_do_not_retry_mutation'); }
  const value = JSON.parse(bytes);
  assertPublicValue(value);
  return value;
}

export async function setupOwnedStudy(runId) {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(runId)) throw new Error('write_run_id');
  const root = join(here, '.runtime-private', 'owned-write', runId);
  if (existsSync(root)) throw new Error('write_setup_exists_do_not_repeat');
  const provenance = captureProvenance();
  if (provenance.environment.opa_binary.matches_release_pin !== true || !verifyProvenance(provenance)) throw new Error('write_setup_sources');
  for (const repo of ['bench', 'spec']) {
    if (provenance.environment.repositories[repo].dirty) throw new Error('commit_sources_before_owned_write');
  }
  const inputs = frozenWriteInputs(), tools = JSON.parse(readFileSync(join(here, 'tools.json')));
  const repository = ghJson(['repos/OndCo/Action-Effect-Bench']);
  if (repository.full_name !== 'OndCo/Action-Effect-Bench' || repository.private !== false || repository.archived) throw new Error('setup_repository');
  const sdk = githubProvider(), principal = await sdk.principal();
  const pin = tools.github_mcp;
  const session = await openNativeMcp({ binary: join(here, '.tools/github-mcp-server'), tokenProvider: credentialReaders().github,
    selectedTools: ['issue_read'], writable: false,
    pins: { source_commit: pin.source_commit, archive_sha256: pin.archive_sha256, executable_sha256: pin.executable_sha256 } });
  let preflight;
  try { preflight = { inventory: session.inventory,
    existing_public_issue_read: await session.call('issue_read', { ...baseTarget, issue_number: 1, method: 'get' }) }; }
  finally { await session.close(); }
  // Persist intent before the single setup POST; an uncertain setup is never retried automatically.
  writeState(root, 'setup-intent.json', { format: 'owned-issue-setup/1', run_id: runId, principal,
    requested_at: new Date().toISOString(), provenance, preflight });
  const body = `# Owned real-use and recovery study\n\nRun: ${runId}\n\n`
    + 'This dedicated public issue holds two eligible, unmodified outputs from the already recorded real-model maintainer run, '
    + 'plus explicitly synthetic recovery controls. Four over-budget model outputs stay withheld.\n\n'
    + 'Authorized ceiling: 12 new comment calls; five comment objects are expected, not pre-asserted. '
    + 'SDK and the pinned official GitHub MCP server are used. Controlled process kills, acknowledgment loss, '
    + 'revocation and narrowed authority are evaluated separately from task quality. No automatic resend after an unknown outcome.\n\n'
    + 'This is same-project, owned-resource testing, not external validation or customer-production evidence. '
    + 'No customer data, Studio/Hook changes, or collaboration invitations are involved.\n\n'
    + `Frozen implementation: https://github.com/OndCo/Action-Effect-Bench/tree/${provenance.environment.repositories.bench.head}\n`
    + 'Protocol and report: https://github.com/OndCo/Action-Effect-Bench/blob/main/docs/implementation-plan-2026-10-19-owned-write-recovery.md\n';
  const issue = ghJson(['repos/OndCo/Action-Effect-Bench/issues', '--method', 'POST', '--input', '-'],
    { title: `Owned real-use acceptance and recovery: ${runId}`, body });
  writeState(root, 'setup-response.json', issue);
  if (!Number.isSafeInteger(issue.number) || issue.number <= 1 || issue.body !== body || issue.user?.login !== principal
    || issue.html_url !== `https://github.com/OndCo/Action-Effect-Bench/issues/${issue.number}`) throw new Error('setup_receipt_unknown');
  const target = { ...baseTarget, issue_number: issue.number };
  const initialComments = await sdk.listComments(target);
  if (initialComments.length !== 0) throw new Error('setup_issue_not_empty');
  const plan = buildWritePlan({ report: inputs.report, review: inputs.review, target, principal, runId });
  const manifest = { format: 'action-effect-owned-write-manifest/1', run_id: runId,
    created_at: new Date().toISOString(), principal, target, inputs: inputs.references, tools, provenance, plan,
    setup: { issue, initial_comments: initialComments, native_readonly_preflight: preflight, separate_from_comment_profile: true } };
  validateWriteManifest(manifest);
  if (!verifyProvenance(provenance)) throw new Error('setup_source_drift');
  for (const scenario of plan.scenarios) writeState(join(root, 'policies'), `${scenario.id}.json`, scenarioPolicy(scenario, 'initial'));
  return writeState(root, 'manifest.json', manifest);
}

function archiveJournal(path, prefix) {
  const bytes = readFileSync(path), verified = verifyJournal(bytes);
  if (!verified.valid) throw new Error('invalid_durable_journal');
  const filename = `${prefix}.${basename(path)}`;
  copyFileSync(path, join(reportsRoot, filename), constants.COPYFILE_EXCL);
  return { ...verified, file: filename };
}

export async function executeOwnedStudy(manifestPath) {
  const root = realpathSync(dirname(manifestPath)), loaded = readState(manifestPath), manifest = loaded.value;
  validateWriteManifest(manifest);
  if (!verifyProvenance(manifest.provenance)) throw new Error('write_run_source_drift');
  writeState(root, 'execution-started.json', { manifest_sha256: loaded.sha256, started_at: new Date().toISOString() });
  const supervisorJournal = createJournal(root, 'supervisor', { run_id: manifest.run_id, manifest_sha256: loaded.sha256 });
  let journalFailed = false;
  const record = event => {
    if (journalFailed) throw new Error('supervisor_journal_failed');
    try { supervisorJournal.append(event); } catch { journalFailed = true; throw new Error('supervisor_journal_failed'); }
  };
  const phases = [], cases = [], started = performance.now();
  let complete = false, failure = null, finalComments = [];
  const sdk = githubProvider();
  async function phase(scenario, mode) {
    const name = `${scenario.id}.${mode}`, ledgerDir = join(root, 'ledger');
    const processResult = await superviseWorker({ workerPath: join(here, 'write-worker.mjs'),
      args: [manifestPath, loaded.sha256, scenario.id, mode], record: event => record({ ...event, phase: name }),
      checkpoint: async stage => {
        if (mode !== 'execute') throw new Error('unexpected_checkpoint');
        const fault = scenario.fault;
        if (stage === 'after-preflight' && ['revoke-after-preflight', 'narrow-after-preflight'].includes(fault)) {
          const variant = fault === 'revoke-after-preflight' ? 'revoked' : 'narrowed';
          const policy = scenarioPolicy(scenario, variant);
          replaceState(join(root, 'policies'), `${scenario.id}.json`, policy);
          record({ type: 'current_policy_changed', phase: name, policy });
          return 'continue';
        }
        if ((stage === 'before-native-send' && fault === 'crash-before-send')
          || (stage === 'after-native-reply' && fault === 'crash-after-reply')) return 'kill';
        throw new Error('unexpected_checkpoint');
      } });
    const journal = archiveJournal(join(root, 'journals', `${name}.jsonl`), manifest.run_id);
    let stored = null;
    if (processResult.finished) {
      if (processResult.finished.result_file !== `${name}.json`) throw new Error('worker_result_file');
      stored = readState(join(root, 'phases', `${name}.json`)).value;
      if (stored.manifest_sha256 !== loaded.sha256 || stored.pid !== processResult.pid
        || stored.journal.sha256 !== journal.sha256 || stored.scenario_id !== scenario.id || stored.mode !== mode) throw new Error('worker_result_binding');
    }
    const row = { id: name, scenario_id: scenario.id, mode, process: processResult,
      result: stored?.result ?? null, ledger_after: load(ledgerDir, scenario.occurrence),
      policy_after: readState(join(root, 'policies', `${scenario.id}.json`)).value, journal, stored };
    phases.push(row);
    record({ type: 'phase_recorded', phase: name, qualified: assessPhase(row, scenario, mode) });
    process.stdout.write(`${name}: ${row.result?.outcome ?? processResult.signal}\n`);
    if (!assessPhase(row, scenario, mode)) throw new Error('phase_expectation_not_met');
    return row;
  }
  try {
    if ((await sdk.listComments(manifest.target)).length !== 0) throw new Error('pre_run_issue_not_empty');
    for (const scenario of manifest.plan.scenarios) {
      if (!verifyProvenance(manifest.provenance)) throw new Error('write_run_source_drift');
      const first = await phase(scenario, 'execute');
      const recovery = scenario.expected.recovery_outcome === null ? null : await phase(scenario, 'reconcile');
      const probe = await phase(scenario, 'probe');
      cases.push({ scenario_id: scenario.id, initial_phase: first.id, recovery_phase: recovery?.id ?? null,
        duplicate_phase: probe.id });
      const current = await sdk.listComments(manifest.target);
      record({ type: 'case_current_comments', scenario_id: scenario.id, response: current });
      const expectedCount = cases.reduce((total, row) => total + manifest.plan.scenarios.find(item => item.id === row.scenario_id).expected.new_comments, 0);
      if (current.length !== expectedCount || current.length > 12) throw new Error('unexpected_comment_count');
    }
    finalComments = await sdk.listComments(manifest.target);
    record({ type: 'final_current_comments', response: finalComments });
    for (const scenario of manifest.plan.scenarios) {
      const params = scenario.lane === 'sdk' ? scenario.native.call : scenario.native.call.arguments;
      const matches = finalComments.filter(comment => receiptFrom(comment, params, manifest.principal).content_matches);
      if (matches.length !== scenario.expected.new_comments) throw new Error('final_content_mismatch');
    }
    if (!verifyProvenance(manifest.provenance)) throw new Error('write_run_source_drift');
    complete = true;
  } catch (error) {
    failure = /^[a-z_]{1,100}$/.test(error.message) ? error.message : 'owned_write_run_failed';
    if (!journalFailed) record({ type: 'study_stopped', reason: failure });
  }
  if (!journalFailed) supervisorJournal.seal(complete ? 'recorded' : 'stopped');
  const supervisor = archiveJournal(supervisorJournal.path, manifest.run_id);
  const permits = existsSync(join(root, 'permits')) ? readWritePermits(join(root, 'permits')) : [];
  const output = { format: 'action-effect-owned-write-study/1', status: complete ? 'recorded' : 'stopped', failure,
    run_id: manifest.run_id, manifest, manifest_sha256: loaded.sha256, manifest_bytes: loaded.raw.toString('utf8'),
    cases, phases, supervisor_journal: supervisor, write_permits: permits, current_comments: finalComments,
    total_duration_ms: performance.now() - started, source_inventory_unchanged: verifyProvenance(manifest.provenance),
    scopes: { live_owned_github: true, new_model_requests: 0, independent_human_evaluation: false,
      synthetic_faults_separate: true, provider_wire_attempt_count: 'not_measured',
      remote_atomic_revoke_or_exactly_once: false, customer_production: false, automatic_resend: false } };
  const saved = saveArtifact(reportsRoot, 'owned-write-study', output);
  writeState(root, 'public-output.json', { file: basename(saved.path), sha256: saved.sha256, status: output.status });
  return { ...saved, status: output.status };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, argument, ...extra] = process.argv.slice(2);
    if (!argument || !['--setup', '--execute', '--adopt-unstarted'].includes(command)
      || (command === '--adopt-unstarted' ? extra.length !== 1 : extra.length !== 0)) throw new Error('usage_setup_runid_or_execute_manifest');
    const output = command === '--setup' ? { manifest: await setupOwnedStudy(argument) }
      : command === '--adopt-unstarted' ? { manifest: await adoptUnstartedStudy(realpathSync(argument), extra[0]) }
        : await executeOwnedStudy(realpathSync(argument));
    process.stdout.write(`${JSON.stringify(output)}\n`);
    if (output.status === 'stopped') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${/^[a-z_]{1,100}$/.test(error.message) ? error.message : 'owned_write_cli_failed'}\n`);
    process.exitCode = 1;
  }
}

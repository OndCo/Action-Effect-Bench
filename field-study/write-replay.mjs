import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { assertPublicValue, digestBytes, verifyJournal, saveArtifact } from './artifacts.mjs';
import { validateWriteManifest } from './write-config.mjs';
import { loadRecordedSources } from './provenance.mjs';
import { readState } from './write-artifacts.mjs';
import { assessPhase, assertUnstartedAttempt } from './write-run.mjs';
import { authorize } from '../runtime-pilot/authorization.mjs';
import { jsonHash } from '../runtime-pilot/mapping.mjs';
import { receiptFrom } from '../runtime-pilot/provider.mjs';
import { decodeCommentResult } from './native-mcp.mjs';

const check = (condition, code) => { if (!condition) throw new Error(`replay_${code}`); };
const same = (left, right, code) => check(isDeepStrictEqual(left, right), code);
const select = (rows, type) => rows.filter(row => row.event.type === type);

export function readEvidenceJournal(bytes, expected) {
  const result = verifyJournal(bytes);
  check(result.valid && result.sha256 === expected.sha256 && result.records === expected.records
    && result.complete === expected.complete && expected.valid === true, 'journal');
  return Buffer.from(bytes).toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
}

export function checkResponseHashes(records) {
  for (const { event } of records) {
    if (Object.hasOwn(event, 'response_sha256')) same(digestBytes(JSON.stringify(event.response)), event.response_sha256, 'response_hash');
    if (Object.hasOwn(event, 'args_sha256')) same(digestBytes(JSON.stringify(event.args)), event.args_sha256, 'args_hash');
  }
  return true;
}

export function replayOwnedStudy(study, { readJournal } = {}) {
  check(study?.format === 'action-effect-owned-write-study/1' && study.status === 'recorded'
    && study.failure === null && study.source_inventory_unchanged === true, 'study');
  assertPublicValue(study);
  check(typeof readJournal === 'function', 'journal_reader');
  const manifest = study.manifest;
  check(typeof study.manifest_bytes === 'string' && digestBytes(study.manifest_bytes) === study.manifest_sha256, 'manifest_bytes');
  same(JSON.parse(study.manifest_bytes), manifest, 'manifest_binding');
  validateWriteManifest(manifest);
  if (manifest.reuse_of_unstarted_setup) {
    const prior = manifest.reuse_of_unstarted_setup;
    const bytes = readJournal(prior.previous_study_file), journal = readJournal(prior.failed_worker_journal);
    same(digestBytes(bytes), prior.previous_study_sha256, 'previous_study_hash');
    same(digestBytes(journal), prior.failed_worker_journal_sha256, 'previous_journal_hash');
    const previous = JSON.parse(bytes);
    assertUnstartedAttempt(previous, journal);
    same(previous.manifest_sha256, prior.previous_manifest_sha256, 'previous_manifest');
    same(previous.manifest.target, manifest.target, 'reused_issue');
    same(prior.previous_native_comment_calls, 0, 'previous_calls');
    same(prior.fresh_comments_before_adoption, [], 'previous_current_comments');
    loadRecordedSources(previous.manifest.provenance);
  }
  const source = loadRecordedSources(manifest.provenance);
  for (const item of [...manifest.provenance.field_sources, ...manifest.provenance.preserved_runtime_sources]) {
    same(digestBytes(source.read(item.path)), item.sha256, 'source_hash');
  }
  same(study.run_id, manifest.run_id, 'run_id');
  same(study.scopes, { live_owned_github: true, new_model_requests: 0, independent_human_evaluation: false,
    synthetic_faults_separate: true, provider_wire_attempt_count: 'not_measured',
    remote_atomic_revoke_or_exactly_once: false, customer_production: false, automatic_resend: false }, 'scope');
  const supervisor = readEvidenceJournal(readJournal(study.supervisor_journal.file), study.supervisor_journal);
  same(supervisor[0].event.metadata, { run_id: study.run_id, manifest_sha256: study.manifest_sha256 }, 'supervisor_binding');
  same(supervisor.at(-1).event, { type: 'end', outcome: 'recorded' }, 'supervisor_end');
  const scenarios = manifest.plan.scenarios;
  same(study.cases.map(row => row.scenario_id), scenarios.map(row => row.id), 'cases');
  const expectedPhases = scenarios.flatMap(scenario => [
    `${scenario.id}.execute`, ...(scenario.expected.recovery_outcome === null ? [] : [`${scenario.id}.reconcile`]), `${scenario.id}.probe`,
  ]);
  same(study.phases.map(phase => phase.id), expectedPhases, 'phases');
  check(new Set(study.phases.map(phase => phase.process.pid)).size === expectedPhases.length, 'distinct_worker_pids');
  check(study.current_comments.length === 5 && new Set(study.current_comments.map(row => row.id)).size === 5, 'current_comments');
  same(select(supervisor, 'final_current_comments').map(row => row.event.response), [study.current_comments], 'final_snapshot');
  const allPermits = [], nativeCalls = [], phaseSummaries = [], previousLedgers = new Map();
  let protocolMatches = 0, structuredMatches = 0;
  for (const phase of study.phases) {
    const scenario = scenarios.find(item => item.id === phase.scenario_id);
    check(Boolean(scenario) && phase.id === `${scenario.id}.${phase.mode}` && assessPhase(phase, scenario, phase.mode), 'phase_outcome');
    const records = readEvidenceJournal(readJournal(phase.journal.file), phase.journal), events = records.map(row => row.event);
    same(records[0].event.metadata, { run_id: study.run_id, manifest_sha256: study.manifest_sha256,
      scenario_id: scenario.id, mode: phase.mode, pid: phase.process.pid }, 'worker_binding');
    checkResponseHashes(records);
    same(select(supervisor, 'worker_spawn').filter(row => row.event.phase === phase.id).map(row => row.event.pid), [phase.process.pid], 'worker_spawn');
    const exits = select(supervisor, 'worker_exit').filter(row => row.event.phase === phase.id);
    check(exits.length === 1, 'worker_exit');
    const { type: exitType, phase: exitPhase, ...observedExit } = exits[0].event;
    same(observedExit, phase.process, 'worker_exit_binding');
    const before = select(records, 'ledger_before');
    check(before.length === 1, 'ledger_before');
    same(before[0].event.state, previousLedgers.get(scenario.id) ?? null, 'ledger_continuity');
    same(phase.ledger_after.binding, jsonHash({ native: scenario.native, context: scenario.context }), 'ledger_binding');
    same(phase.ledger_after.occurrence, scenario.occurrence, 'ledger_occurrence');
    previousLedgers.set(scenario.id, phase.ledger_after);
    const paired = select(records, 'paired_preparation');
    check(paired.length === 1, 'paired_preparation');
    same(paired[0].event.preparations.map(row => row.strategy), ['protocol', 'structured'], 'preparation_strategies');
    for (const row of paired[0].event.preparations) {
      same(row.prepared.projection, scenario.reference_projection, 'reference_projection');
      same(row.prepared.status, 'accepted_partial', 'preparation_status');
      const decision = authorize(scenario.reference_projection, scenario.context, paired[0].event.policy);
      check(decision.decision !== 'evaluation_failure', 'offline_policy_evaluation');
      same({ decision: row.authority.decision, reason: row.authority.reason },
        { decision: decision.decision, reason: decision.reason }, 'shadow_authority');
      if (phase.mode === 'execute') {
        if (row.strategy === 'protocol') protocolMatches++; else structuredMatches++;
      }
    }
    same(select(records, 'gate_start').map(row => row.event), [{ type: 'gate_start', mode: phase.mode,
      scenario_id: scenario.id, occurrence: scenario.occurrence }], 'gate_start');
    const attempts = select(records, 'native_write_attempt'), permits = select(records, 'write_permit');
    check(attempts.length <= 1 && permits.length === attempts.length && (phase.mode === 'execute' || attempts.length === 0), 'native_call_count');
    const params = scenario.lane === 'sdk' ? scenario.native.call : scenario.native.call.arguments;
    for (let index = 0; index < attempts.length; index++) {
      const attempt = attempts[index], permit = permits[index];
      same(attempt.event.args, params, 'native_arguments');
      same(attempt.event.lane, scenario.lane, 'native_lane');
      same(attempt.event.method, scenario.lane === 'sdk' ? 'createComment' : 'add_issue_comment', 'native_method');
      same(attempt.event.body_sha256, digestBytes(params.body), 'native_body_hash');
      check(permit.sequence < attempt.sequence && permit.event.permit.occurrence === scenario.occurrence, 'permit_order');
      allPermits.push(permit.event.permit);
      nativeCalls.push({ scenario_id: scenario.id, lane: scenario.lane });
    }
    const results = select(records, 'gate_result');
    if (phase.process.planned_kill) {
      check(results.length === 0 && phase.stored === null, 'killed_result');
      const stage = scenario.fault === 'crash-before-send' ? 'before-native-send' : 'after-native-reply';
      same(select(records, 'checkpoint').map(row => row.event.stage), [stage], 'crash_cut');
      const kills = select(supervisor, 'worker_kill_requested').filter(row => row.event.phase === phase.id);
      check(kills.length === 1 && kills[0].event.stage === stage && kills[0].event.pid === phase.process.pid, 'kill_record');
      if (scenario.fault === 'crash-before-send') check(attempts.length === 0, 'pre_send_no_call');
      else check(select(records, 'native_write_response').length === 1 && attempts.length === 1, 'post_reply_call');
    } else {
      same(results.map(row => row.event.result), [phase.result], 'gate_result');
      same(phase.stored?.result, phase.result, 'phase_result');
      same(phase.stored?.ledger_after, phase.ledger_after, 'phase_ledger');
      same(phase.stored?.policy_after, phase.policy_after, 'phase_policy');
      same(phase.stored?.journal.sha256, phase.journal.sha256, 'phase_journal');
      if (phase.mode === 'execute') {
        const current = authorize(scenario.reference_projection, scenario.context, phase.policy_after);
        same({ decision: current.decision, reason: current.reason },
          { decision: phase.result.authority.decision, reason: phase.result.authority.reason }, 'current_authority');
      }
      if (phase.result.outcome === 'confirmed') {
        const readRows = select(records, 'native_read_response').filter(row => ['readComment', 'listComments'].includes(row.event.method));
        const observed = readRows.flatMap(row => Array.isArray(row.event.response) ? row.event.response : [row.event.response]);
        check(observed.some(row => receiptFrom(row, params, manifest.principal, phase.result.receipt.comment_id).content_matches), 'confirmation_readback');
        const current = study.current_comments.find(row => row.id === phase.result.receipt.comment_id);
        same(receiptFrom(current, params, manifest.principal, current?.id), phase.result.receipt, 'current_receipt');
      }
    }
    if (phase.mode === 'execute') {
      if (['revoke-after-preflight', 'narrow-after-preflight'].includes(scenario.fault)) {
        check(attempts.length === 0 && select(records, 'checkpoint').length === 1, 'denial_no_send');
        const changes = select(supervisor, 'current_policy_changed').filter(row => row.event.phase === phase.id);
        same(changes.map(row => row.event.policy), [phase.policy_after], 'policy_change');
        check(changes[0].sequence < exits[0].sequence, 'policy_change_order');
      }
      if (scenario.fault === 'timeout-after-reply') {
        const deadline = select(records, 'fault_ack_deadline');
        check(deadline.length === 1 && deadline[0].event.elapsed_ms >= deadline[0].event.deadline_ms - 1,
          'actual_ack_deadline');
      }
      if (scenario.fault === 'disconnect-after-reply') {
        const drops = select(records, 'fault_mcp_reply_discarded');
        check(drops.length === 1 && drops[0].event.response.jsonrpc === '2.0', 'mcp_reply_drop');
        const id = Number(decodeCommentResult(drops[0].event.response.result));
        check(study.current_comments.some(row => receiptFrom(row, params, manifest.principal, id).content_matches), 'mcp_drop_readback');
      }
      const count = study.current_comments.filter(row => receiptFrom(row, params, manifest.principal).content_matches).length;
      same(count, scenario.expected.new_comments, 'scenario_object_count');
    }
    phaseSummaries.push({ id: phase.id, mode: phase.mode, outcome: phase.result?.outcome ?? 'process-killed',
      native_comment_calls: attempts.length, process_ms: phase.process.elapsed_ms });
  }
  same(allPermits, study.write_permits, 'durable_permits');
  check(allPermits.length === 5 && allPermits.every((permit, index) => permit.slot === index && permit.maximum === 12
    && permit.run_id === study.run_id) && new Set(allPermits.map(permit => permit.occurrence)).size === 5, 'permit_ceiling');
  return { format: 'action-effect-owned-write-replay/1', valid: true, run_id: study.run_id,
    issue: manifest.setup.issue.html_url, source_mode: source.mode, raw_journals: study.phases.length + 1,
    source_files: manifest.provenance.field_sources.length + manifest.provenance.preserved_runtime_sources.length,
    real_model_candidate_tasks: 6, eligible_ordinary_deliveries: 2, task_layer_withheld: 4,
    fault_scenarios: 6, worker_processes: study.phases.length, comment_calls: nativeCalls.length,
    current_comment_objects: study.current_comments.length, duplicate_probes_without_send: 8,
    recovered_confirmed: 3, retained_unknown: 1, protocol_reference_matches: protocolMatches,
    structured_reference_matches: structuredMatches, phases: phaseSummaries,
    limits: ['Same-project owned resource, not independent evaluation.',
      'Hash chains detect changes relative to a trusted manifest, not an untrusted operator rewriting all evidence.',
      'Current content is not complete provider provenance or proof of atomic remote revocation.',
      'Controlled crash/acknowledgment cuts are not naturally observed outages.',
      'Replaying stored observations is not rerunning the model or making another provider mutation.'] };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('replay_usage');
    const path = realpathSync(process.argv[2]), loaded = readState(path, undefined, 30_000_000);
    const result = replayOwnedStudy(loaded.value, { readJournal: name => {
      check(typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(name), 'journal_path');
      return readFileSync(join(dirname(path), name));
    } });
    const saved = saveArtifact(dirname(path), 'owned-write-replay', { ...result, study_sha256: loaded.sha256 });
    process.stdout.write(`${JSON.stringify({ ...saved, ...result }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${/^[a-z_]{1,100}$/.test(error.message) ? error.message : 'owned_write_replay_failed'}\n`);
    process.exitCode = 1;
  }
}

import { performance } from 'node:perf_hooks';
import { mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { executeAction, reconcileAction, prepareAction } from '../runtime-pilot/gate.mjs';
import { authorize } from '../runtime-pilot/authorization.mjs';
import { load } from '../runtime-pilot/ledger.mjs';
import { githubProvider } from '../runtime-pilot/provider.mjs';
import { assertPublicValue, createJournal } from './artifacts.mjs';
import { readState, writeState, claimWritePermit } from './write-artifacts.mjs';
import { validateWriteManifest } from './write-config.mjs';
import { verifyProvenance } from './provenance.mjs';
import { openNativeMcp } from './native-mcp.mjs';
import { createFieldWriteProvider } from './native-writer.mjs';
import { disconnectAfterMutationReply } from './fault-transport.mjs';
import { credentialReaders } from './credentials.mjs';

const FAULTS = new Set(['none', 'revoke-after-preflight', 'narrow-after-preflight',
  'crash-before-send', 'crash-after-reply', 'timeout-after-reply', 'disconnect-after-reply']);

export function publicGateResult(result) {
  const { authorization, ...rest } = result;
  const output = { ...rest, ...(authorization === undefined ? {} : { authority: authorization }) };
  assertPublicValue(output);
  return output;
}

export async function runScenario({ scenario, mode, policyFile, ledgerDir, provider, record,
  checkpoint, deadlineMs = 500 }) {
  if (!['execute', 'reconcile', 'probe'].includes(mode) || !FAULTS.has(scenario?.fault)
    || !Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 60000
    || typeof record !== 'function' || typeof checkpoint !== 'function') throw new Error('worker_configuration');
  const fault = mode === 'execute' ? scenario.fault : 'none';
  const at = async stage => {
    record({ type: 'checkpoint', stage });
    await checkpoint(stage);
  };
  const wrapped = {
    principal: (...args) => provider.principal(...args),
    readComment: (...args) => provider.readComment(...args),
    async listComments(...args) {
      const rows = await provider.listComments(...args);
      if (['revoke-after-preflight', 'narrow-after-preflight'].includes(fault)) await at('after-preflight');
      return rows;
    },
    async createComment(...args) {
      if (mode === 'reconcile') throw new Error('recovery_is_read_only');
      if (fault === 'crash-before-send') await at('before-native-send');
      const reply = await provider.createComment(...args);
      if (fault === 'crash-after-reply') await at('after-native-reply');
      if (fault === 'timeout-after-reply') {
        const started = performance.now();
        record({ type: 'fault_ack_withheld', comment_id: reply.id, deadline_ms: deadlineMs });
        await new Promise(resolve => setTimeout(resolve, deadlineMs));
        record({ type: 'fault_ack_deadline', elapsed_ms: performance.now() - started, deadline_ms: deadlineMs });
        throw new Error('controlled_acknowledgment_delivery_timeout');
      }
      return reply;
    },
  };
  record({ type: 'gate_start', mode, scenario_id: scenario.id, occurrence: scenario.occurrence });
  const options = { native: scenario.native, context: scenario.context, strategy: scenario.strategy,
    policyFile, ledgerDir, occurrence: scenario.occurrence, provider: wrapped };
  const result = publicGateResult(await (mode === 'reconcile' ? reconcileAction(options) : executeAction(options)));
  record({ type: 'gate_result', mode, result });
  return result;
}

function ledgerSnapshot(root, occurrence) {
  try { return load(root, occurrence); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function ipcCheckpoint(stage) {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); process.off('message', listener); process.off('disconnect', disconnected); };
    const disconnected = () => { cleanup(); reject(new Error('checkpoint_disconnected')); };
    const listener = message => {
      cleanup();
      if (message?.type === 'continue' && message.stage === stage && Object.keys(message).length === 2) resolve();
      else reject(new Error('checkpoint_ipc'));
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('checkpoint_timeout')); }, 30000);
    process.once('message', listener);
    process.once('disconnect', disconnected);
    process.send({ type: 'checkpoint', stage }, error => { if (error) { cleanup(); reject(new Error('checkpoint_ipc')); } });
  });
}

export async function runOwnedWorker(args) {
  if (!Array.isArray(args) || args.length !== 4 || !isAbsolute(args[0]) || !/^[a-f0-9]{64}$/.test(args[1])
    || !/^[a-z][a-z-]{0,63}$/.test(args[2]) || !['execute', 'reconcile', 'probe'].includes(args[3])
    || typeof process.send !== 'function') throw new Error('worker_arguments');
  const [manifestPath, manifestSha, id, mode] = args;
  const root = realpathSync(dirname(manifestPath)), manifest = readState(manifestPath, manifestSha).value;
  validateWriteManifest(manifest);
  if (basename(root) !== manifest.run_id || !verifyProvenance(manifest.provenance)) throw new Error('worker_source_drift');
  const scenario = manifest.plan.scenarios.find(row => row.id === id);
  if (!scenario) throw new Error('worker_scenario');
  const phaseId = `${id}.${mode}`, journalRoot = join(root, 'journals'), resultRoot = join(root, 'phases');
  mkdirSync(journalRoot, { recursive: true, mode: 0o700 });
  mkdirSync(resultRoot, { recursive: true, mode: 0o700 });
  const journal = createJournal(journalRoot, phaseId, { run_id: manifest.run_id, manifest_sha256: manifestSha,
    scenario_id: id, mode, pid: process.pid });
  let journalFailed = false, session;
  const record = event => {
    if (journalFailed) throw new Error('worker_journal_failed');
    try {
      if (event.type === 'native_write_attempt') {
        const permit = claimWritePermit(join(root, 'permits'), manifest.run_id, scenario.occurrence);
        journal.append({ type: 'write_permit', permit });
      }
      journal.append(event);
    } catch { journalFailed = true; throw new Error('worker_journal_failed'); }
  };
  const policyFile = join(root, 'policies', `${id}.json`), ledgerDir = join(root, 'ledger');
  try {
    const initialLedger = ledgerSnapshot(ledgerDir, scenario.occurrence);
    record({ type: 'ledger_before', state: initialLedger });
    const policyBefore = readState(policyFile).value;
    const preparations = [];
    for (const strategy of ['protocol', 'structured']) {
      const prepared = prepareAction(scenario.native, scenario.context, strategy);
      if (prepared.status !== 'accepted_partial' || !isDeepStrictEqual(prepared.projection, scenario.reference_projection)) {
        throw new Error('preparation_reference_mismatch');
      }
      preparations.push({ strategy, prepared, authority: authorize(prepared.projection, scenario.context, policyBefore) });
    }
    record({ type: 'paired_preparation', policy: policyBefore, preparations });
    const sdk = githubProvider();
    // Recovery and duplicate probes have no MCP mutation transport at all.
    const nativeLane = mode === 'execute' ? scenario.lane : 'sdk';
    if (nativeLane === 'mcp') {
      const pins = manifest.tools.github_mcp;
      session = await openNativeMcp({ binary: fileURLToPath(new URL('./.tools/github-mcp-server', import.meta.url)),
        tokenProvider: credentialReaders().github, writable: true, selectedTools: ['add_issue_comment'],
        pins: { source_commit: pins.source_commit, archive_sha256: pins.archive_sha256, executable_sha256: pins.executable_sha256 },
        ...(scenario.fault === 'disconnect-after-reply'
          ? { transportFactory: disconnectAfterMutationReply({ record }) } : {}) });
      record({ type: 'native_mcp_inventory', inventory: session.inventory });
    }
    const observedSdk = mode === 'execute' ? sdk : { ...sdk, createComment: async () => { throw new Error('read_only_phase'); } };
    const provider = createFieldWriteProvider({ lane: nativeLane, target: manifest.target, sdkProvider: observedSdk,
      ...(session ? { session } : {}), record });
    const result = await runScenario({ scenario, mode, policyFile, ledgerDir, provider, record,
      checkpoint: ipcCheckpoint, deadlineMs: 500 });
    if (session) await session.close();
    session = undefined;
    if (journalFailed || !verifyProvenance(manifest.provenance)) throw new Error('worker_postcheck');
    const ledgerAfter = ledgerSnapshot(ledgerDir, scenario.occurrence), policyAfter = readState(policyFile).value;
    record({ type: 'ledger_after', state: ledgerAfter, policy: policyAfter });
    const sealed = journal.seal(result.outcome);
    const name = `${phaseId}.json`;
    writeState(resultRoot, name, { format: 'action-effect-owned-write-phase/1', run_id: manifest.run_id,
      manifest_sha256: manifestSha, scenario_id: id, mode, pid: process.pid, result, ledger_before: initialLedger,
      ledger_after: ledgerAfter, policy_before: policyBefore, policy_after: policyAfter, preparations,
      journal: { file: basename(sealed.path), sha256: sealed.sha256, records: sealed.records } });
    return name;
  } catch (error) {
    if (!journalFailed) {
      try { record({ type: 'worker_failure', code: 'worker_stage_failed' }); } catch { /* Preserve partial evidence. */ }
    }
    throw error;
  } finally { if (session) await session.close(); }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const name = await runOwnedWorker(process.argv.slice(2));
    process.send({ type: 'finished', result_file: name }, () => process.disconnect());
  } catch {
    process.stderr.write('owned_write_worker_failed; inspect its retained journal\n');
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  }
}

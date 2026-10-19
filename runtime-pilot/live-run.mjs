import { readFileSync, writeFileSync, mkdirSync, realpathSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { benchRoot, digestBytes, environment, saveReport, sourceSnapshot, sourceInventoryUnchanged } from './artifacts.mjs';
import { executeAction, reconcileAction } from './gate.mjs';
import { runMcpAction } from './mcp-client.mjs';
import { githubProvider, receiptFrom } from './provider.mjs';
import { durationSummary } from './scoring.mjs';

const planBytes = readFileSync(new URL('./live-plan.json', import.meta.url));
export const plan = JSON.parse(planBytes);

export function validateLivePreflight(issue, comments) {
  if (issue.title !== plan.required_issue_title || issue.pull_request || issue.state !== 'open') throw new Error('dedicated_issue_required');
  if (comments.some(comment => typeof comment.body === 'string' && comment.body.includes('action-effect-run:'))) {
    throw new Error('issue_already_used_reconcile_or_replay_do_not_rerun');
  }
}

export function matchesPlannedOutcome(actual, expected, recovery) {
  return actual?.outcome === expected.expected_outcome && actual.authorization?.decision === expected.expected_decision
    && (!expected.expected_authorization_reason || actual.authorization?.reason === expected.expected_authorization_reason)
    && (!expected.expected_reason || actual.reason === expected.expected_reason)
    && (!expected.expected_fault || actual.fault?.[expected.expected_fault] === true)
    && (!expected.expected_reconciled_outcome || recovery?.outcome === expected.expected_reconciled_outcome);
}

export async function recoverAfterUnknown(actual, options, reconcile = reconcileAction) {
  if (actual.outcome !== 'unknown') return undefined;
  try { return await reconcile(options); }
  catch { return { outcome: 'unknown', reason: 'reconciliation_failure', automatic_resend: false }; }
}

export async function runLive(issueNumber, confirmRepository) {
  if (confirmRepository !== plan.repository || !Number.isSafeInteger(issueNumber) || issueNumber < 1) throw new Error('explicit_owned_scope_required');
  const runEnvironment = environment();
  if (!runEnvironment.opa_binary.matches_release_pin) throw new Error('verified_opa_required');
  const [owner, repo] = plan.repository.split('/'), target = { owner, repo, issue_number: issueNumber };
  const provider = githubProvider();
  const issue = await provider.readIssue(target);
  const initial = await provider.listComments(target);
  validateLivePreflight(issue, initial);
  const principal = await provider.principal();
  const context = { principal, data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' };
  const runId = randomUUID(), startedAt = new Date().toISOString(), started = performance.now();
  const source = sourceSnapshot(), rows = [];
  const privateRoot = join(benchRoot, 'runtime-pilot/.runtime-private', runId);
  mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  const baseline = { revision: 'live-v1', principal, revoked: false, allow_partial_direct: true, max_body_bytes: 8192,
    grants: [{ repository: plan.repository, issue_number: issueNumber, data_class: 'synthetic-public' }] };
  const reportDir = join(benchRoot, 'reports');
  mkdirSync(reportDir, { recursive: true });
  const journalPath = join(reportDir, `runtime-pilot-live-attempt-${runId}.jsonl`);
  const journalFd = openSync(journalPath, 'wx', 0o600);
  closeSync(journalFd);
  const journal = entry => {
    const fd = openSync(journalPath, 'a');
    try { writeFileSync(fd, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`); fsyncSync(fd); }
    finally { closeSync(fd); }
  };
  journal({ event: 'begin', run_id: runId, target, plan_sha256: digestBytes(planBytes), sources: source });
  let stop = false;
  for (const scenario of plan.scenarios) {
    // Alternate ordering to avoid assigning every first request to one strategy.
    const strategies = plan.scenarios.indexOf(scenario) % 2 ? [...plan.strategies].reverse() : plan.strategies;
    for (const strategy of strategies) for (const lane of plan.lanes) {
      const rowStarted = performance.now(), key = `${strategy}-${lane}`;
      const selectedId = scenario.reuses ?? scenario.id;
      const occurrence = `${runId}-${key}-${selectedId}`;
      const marker = `action-effect-run:${runId}/${key}/${selectedId}`;
      const body = `Synthetic interoperability test. ${marker}${selectedId === 'unicode' ? '\nUnicode: \u{1F3AB} e\u0301.' : ''}`;
      const params = { ...target, body };
      const native = lane === 'sdk' ? { lane, call: params } : { lane, call: { name: 'add_issue_comment', arguments: params } };
      let policy = structuredClone(baseline);
      if (scenario.id === 'revoked') policy = { ...policy, revision: 'live-v2-revoked', revoked: true };
      if (scenario.id === 'narrowed') policy = { ...policy, revision: 'live-v2-narrowed', max_body_bytes: 1 };
      if (scenario.id === 'partial-review') policy = { ...policy, revision: 'live-v2-unknown', allow_partial_direct: false };
      if (scenario.id === 'invalid-policy') policy = {};
      const policyFile = join(privateRoot, `${key}-${scenario.id}-policy.json`);
      const ledgerDir = join(privateRoot, key, 'ledger');
      writeFileSync(policyFile, JSON.stringify(policy), { mode: 0o600 });
      const options = { native, context, policyFile, ledgerDir, occurrence, strategy, provider };
      journal({ event: 'scheduled', scenario: scenario.id, strategy, lane, occurrence, native, context, policy });
      let actual, transport, recovery;
      try {
        if (stop) {
          actual = { outcome: 'not_started', reason: 'prior_row_failed', authorization: { decision: 'not_evaluated' } };
        } else if (lane === 'mcp') {
          const configFile = join(privateRoot, `${key}-${scenario.id}-mcp.json`);
          writeFileSync(configFile, JSON.stringify({ mode: 'live', strategy, context, policy_file: policyFile,
            ledger_dir: ledgerDir, occurrence, inject_lost_ack: scenario.id === 'lost-ack' }), { mode: 0o600 });
          transport = await runMcpAction(configFile, params);
          actual = transport.result;
        } else {
          let discarded = false;
          const activeProvider = scenario.id === 'lost-ack' ? { ...provider,
            async createComment(p) { await provider.createComment(p); discarded = true; throw new Error('controlled_lost_ack'); } } : provider;
          actual = await executeAction({ ...options, provider: activeProvider });
          if (scenario.id === 'lost-ack') actual.fault = { successful_post_ack_discarded: discarded };
        }
      } catch {
        actual = { outcome: 'unknown', reason: 'harness_or_transport_failure', authorization: { decision: 'evaluation_failure' } };
      }
      if (scenario.id === 'lost-ack') recovery = await recoverAfterUnknown(actual, options);
      const row = { scenario: scenario.id, strategy, lane, occurrence, native, context, policy,
        expected: scenario, actual, ...(transport ? { transport } : {}), ...(recovery ? { recovery } : {}),
        total_ms: performance.now() - rowStarted };
      rows.push(row);
      journal({ event: 'result', ...row });
      if (!matchesPlannedOutcome(actual, scenario, recovery)) stop = true;
      if (!stop) await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  let comments, finalReadError = false;
  try { comments = await provider.listComments(target); } catch { comments = []; finalReadError = true; }
  const scoped = comments.filter(comment => typeof comment.body === 'string' && comment.body.includes(`action-effect-run:${runId}/`));
  for (const row of rows) {
    const params = row.native.lane === 'sdk' ? row.native.call : row.native.call.arguments;
    row.observed_receipts = scoped.filter(comment => comment.body === params.body).map(comment => receiptFrom(comment, params, principal));
    const expectedCount = ['ascii', 'unicode', 'lost-ack', 'duplicate'].includes(row.scenario) ? 1 : 0;
    row.passed = matchesPlannedOutcome(row.actual, row.expected, row.recovery)
      && row.observed_receipts.length === expectedCount
      && row.observed_receipts.every(receipt => receipt.content_matches);
  }
  const stable = sourceInventoryUnchanged(source), passed = !finalReadError && stable && rows.every(row => row.passed)
    && scoped.length === plan.maximum_new_comments;
  journal({ event: 'end', passed, final_read_error: finalReadError, run_scoped_comment_count: scoped.length });
  const journalHash = digestBytes(readFileSync(journalPath));
  writeFileSync(`${journalPath}.sha256`, `${journalHash}  ${basename(journalPath)}\n`, { flag: 'wx' });
  const summary = Object.fromEntries(plan.strategies.map(strategy => {
    const selected = rows.filter(row => row.strategy === strategy);
    return [strategy, { scheduled_rows: selected.length, rows_passed: selected.filter(row => row.passed).length,
      immediate_confirmed: selected.filter(row => row.actual.outcome === 'confirmed').length,
      unknown_before_reconciliation: selected.filter(row => row.actual.outcome === 'unknown').length,
      reconciled_confirmed: selected.filter(row => row.recovery?.outcome === 'confirmed').length,
      duplicate_suppressed: selected.filter(row => row.actual.outcome === 'duplicate_suppressed').length,
      withheld: selected.filter(row => row.actual.outcome === 'withheld').length,
      normal_completion_cost: durationSummary(selected.filter(row => ['ascii', 'unicode'].includes(row.scenario)).map(row => row.total_ms)) }];
  }));
  const report = { kind: 'runtime-pilot-live', version: 1, run_id: runId, started_at: startedAt, finished_at: new Date().toISOString(),
    environment: runEnvironment, target: { repository: plan.repository, issue_number: issueNumber, issue_url: issue.html_url },
    provenance: { plan_sha256: digestBytes(planBytes), sources: source, external_validation: false, case_authorship: 'same-project-ai-assisted' },
    passed, sources_stable: stable, final_read_error: finalReadError, summary, rows,
    attempt_journal: { file: basename(journalPath), sha256: journalHash },
    observations: { before_comment_count: initial.length, run_scoped_comment_count: scoped.length,
      expected_new_comments: plan.maximum_new_comments }, duration_ms: performance.now() - started,
    limitations: [plan.claim_scope, plan.fault_injection, 'Readback establishes current content, not complete provider execution provenance.',
      'Eight scripted scenarios and two related lanes/strategies; not 32 independent production incidents.',
      'Live cost is a small sequential sample with cold subprocesses; no tail SLA or speed ranking.',
      'Local policy and GitHub mutation are not one atomic transaction.'] };
  const path = saveReport('runtime-pilot-live', report);
  return { passed, report: path, target: report.target, summary, observations: report.observations, sources_stable: stable };
}

function isMain() {
  try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (isMain()) {
  const [, , flag, issue, confirm, repository] = process.argv;
  if (process.argv.length !== 6 || flag !== '--issue' || confirm !== '--confirm-owned-repo') {
    console.error('usage: live-run.mjs --issue NUMBER --confirm-owned-repo OndCo/Action-Effect-Bench'); process.exitCode = 2;
  } else runLive(Number(issue), repository).then(result => {
    console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1;
  }).catch(() => { console.error('live_preflight_failed_no_automatic_retry'); process.exitCode = 1; });
}

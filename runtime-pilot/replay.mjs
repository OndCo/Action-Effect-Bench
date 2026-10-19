import { readFileSync, statSync, realpathSync, lstatSync, openSync, closeSync, fstatSync, readSync, constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { prepareAction } from './gate.mjs';
import { authorize } from './authorization.mjs';
import { digestBytes, sourceSnapshot, sourcesMatch, saveReport } from './artifacts.mjs';
import { frozenCases } from './offline-run.mjs';
import { mappingMatches } from './scoring.mjs';
import { receiptFrom } from './provider.mjs';
import { upstreamContractCheck } from './upstream/check.mjs';
import { validateOfflineReport, validateLiveReport, validateAttemptJournal, authorizationMatches, validRunId,
  REPLAY_TRUST_BOUNDARY } from './replay-integrity.mjs';

export { validateOfflineReport, validateLiveReport, validateAttemptJournal, authorizationMatches, REPLAY_TRUST_BOUNDARY };

const livePlanBytes = readFileSync(new URL('./live-plan.json', import.meta.url));
const livePlan = JSON.parse(livePlanBytes);

function journalBytes(path, limit) {
  let fd;
  try {
    if (!lstatSync(path).isFile()) throw new Error('attempt_journal_path_mismatch');
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error('attempt_journal_path_mismatch');
    if (stat.size > limit) throw new Error('attempt_journal_too_large');
    const buffer = Buffer.alloc(stat.size + 1);
    let size = 0, count;
    while (size < buffer.length && (count = readSync(fd, buffer, size, buffer.length - size, null)) > 0) size += count;
    if (size !== stat.size) throw new Error('attempt_journal_changed_during_read');
    return buffer.subarray(0, size);
  } catch (error) {
    if (error.message.startsWith('attempt_journal_')) throw error;
    throw new Error('attempt_journal_read_failure');
  } finally { if (fd !== undefined) closeSync(fd); }
}

export function loadAttemptJournal(reportPath, report) {
  const filename = `runtime-pilot-live-attempt-${report.run_id}.jsonl`;
  if (!validRunId(report.run_id) || report.attempt_journal?.file !== filename) throw new Error('attempt_journal_path_mismatch');
  const directory = dirname(realpathSync(reportPath)), path = join(directory, filename);
  const raw = journalBytes(path, 32 * 1024 * 1024);
  const checksum = journalBytes(`${path}.sha256`, 1024).toString('utf8');
  const hash = digestBytes(raw);
  if (report.attempt_journal.sha256 !== hash || checksum !== `${hash}  ${filename}\n`) throw new Error('attempt_journal_checksum_mismatch');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    if (!text.endsWith('\n')) throw new Error();
    const entries = [], maximum = livePlan.scenarios.length * livePlan.strategies.length * livePlan.lanes.length * 2 + 2;
    let start = 0;
    while (start < text.length) {
      const end = text.indexOf('\n', start);
      if (end <= start || entries.length === maximum) throw new Error();
      entries.push(JSON.parse(text.slice(start, end)));
      start = end + 1;
    }
    return entries;
  } catch { throw new Error('attempt_journal_jsonl_mismatch'); }
}

export function reproduceOfflineReferences(report, corpus, evaluate = authorize) {
  const accepted = corpus.cases.filter(item => item.expected.mapping.status === 'accepted_partial');
  const checks = [];
  for (const [index, item] of accepted.entries()) {
    const fresh = evaluate(item.expected.mapping.projection, item.context, item.policy);
    const reproduced = authorizationMatches(report.pure_authorization[index].actual, fresh);
    checks.push({ key: `pure-authorization/${item.id}`, decision_matches_expected: fresh.decision === item.expected.decision,
      authorization_matches_recorded: reproduced, reproduced });
  }
  for (const [index, item] of accepted.entries()) {
    const projection = { ...item.expected.mapping.projection, body_sha256: '0'.repeat(64) };
    const fresh = evaluate(projection, item.context, item.policy);
    const reproduced = authorizationMatches(report.diagnostic_lossy_projection.rows[index].authorization, fresh);
    checks.push({ key: `lossy-diagnostic/${item.id}`, decision_matches_expected: fresh.decision === item.expected.decision,
      authorization_matches_recorded: reproduced, reproduced });
  }
  return checks;
}

export async function replayReport(path, options = {}) {
  if (statSync(path).size > 32 * 1024 * 1024) throw new Error('report_too_large');
  const raw = readFileSync(path), checksum = readFileSync(`${path}.sha256`, 'utf8').trim().split(/\s+/)[0];
  if (digestBytes(raw) !== checksum) throw new Error('report_checksum_mismatch');
  const report = JSON.parse(raw);
  if (!['runtime-pilot-offline', 'runtime-pilot-live'].includes(report.kind) || !Array.isArray(report.rows)) throw new Error('invalid_report');
  if (!isDeepStrictEqual(sourceSnapshot(), report.provenance?.sources) || !sourcesMatch(report.provenance.sources)) {
    throw new Error('source_snapshot_mismatch_use_recorded_source_revision');
  }
  const checks = [], observed = [];
  let integrity;
  if (report.kind === 'runtime-pilot-offline') {
    const frozen = frozenCases(), { corpus } = frozen;
    integrity = validateOfflineReport(report, frozen, upstreamContractCheck());
    const cases = new Map(corpus.cases.map(row => [row.id, row]));
    for (const row of report.rows) {
      const key = `${row.id}/${row.lane}/${row.strategy}`, item = cases.get(row.id);
      let mapping, authorization;
      try {
        mapping = prepareAction(item.native[row.lane], item.context, row.strategy);
        authorization = mapping.status === 'accepted_partial' ? authorize(mapping.projection, item.context, item.policy) : { decision: 'not_evaluated' };
      } catch {
        mapping = { status: 'evaluation_failure', reason: 'adapter_failure', authority: 'not_evaluated' };
        authorization = { decision: 'not_evaluated' };
      }
      const mappingReproduced = mappingMatches(mapping, row.mapping), authorizationReproduced = authorizationMatches(row.authorization, authorization);
      checks.push({ key, mapping_matches_expected: mappingMatches(mapping, item.expected.mapping),
        decision_matches_expected: authorization.decision === item.expected.decision,
        mapping_matches_recorded: mappingReproduced, authorization_matches_recorded: authorizationReproduced,
        reproduced: mappingReproduced && authorizationReproduced });
    }
    checks.push(...reproduceOfflineReferences(report, corpus));
  } else {
    integrity = validateLiveReport(report, livePlan, digestBytes(livePlanBytes));
    validateAttemptJournal(report, loadAttemptJournal(path, report));
    for (const row of report.rows) {
      const key = `${row.scenario}/${row.lane}/${row.strategy}`, actual = row.actual;
      const mapping = actual.mapping ? prepareAction(row.native, row.context, row.strategy) : undefined;
      const auth = actual.authorization;
      const evaluated = ['allow', 'deny', 'review'].includes(auth?.decision) || typeof auth?.reason === 'string';
      const authorization = evaluated ? authorize(mapping?.projection, row.context, row.policy) : undefined;
      // Pre-evaluation outages and not-started rows are operator observations, not OPA denials.
      const mappingReproduced = actual.mapping ? mappingMatches(mapping, actual.mapping) : !evaluated;
      const authorizationReproduced = !evaluated || authorizationMatches(auth, authorization);
      checks.push({ key, mapping_matches_recorded: mappingReproduced, authorization_replayed: evaluated,
        authorization_matches_recorded: authorizationReproduced, row_matches_plan: row.passed,
        reproduced: mappingReproduced && authorizationReproduced });
    }
    if (options.github && checks.every(check => check.reproduced)) {
      const seen = new Set();
      for (const row of report.rows) for (const receipt of row.observed_receipts ?? []) {
        if (seen.has(receipt.comment_id)) continue;
        seen.add(receipt.comment_id);
        const params = row.native.lane === 'sdk' ? row.native.call : row.native.call.arguments;
        const url = `https://api.github.com/repos/${livePlan.repository}/issues/comments/${receipt.comment_id}`;
        let matches = false, error = null;
        try {
          const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000),
            headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
          if (!response.ok) throw new Error('github_readback_unavailable');
          const current = receiptFrom(await response.json(), params, row.context.principal);
          matches = ['comment_id', 'api_url', 'issue_url', 'actor', 'body_sha256', 'body_bytes', 'content_matches']
            .every(key => current[key] === receipt[key]);
        } catch { error = 'github_readback_unavailable_or_changed'; }
        observed.push({ comment_id: receipt.comment_id, matches, error });
      }
    }
  }
  if (!isDeepStrictEqual(sourceSnapshot(), report.provenance.sources) || !sourcesMatch(report.provenance.sources)) {
    throw new Error('source_changed_during_replay');
  }
  const valid = checks.every(check => check.reproduced)
    && (!options.github || report.kind !== 'runtime-pilot-live' || (observed.length === integrity.unique_receipts && observed.every(row => row.matches)));
  return { kind: 'runtime-pilot-replay', report_sha256: checksum, original_kind: report.kind, valid,
    benchmark_passed: valid ? integrity.benchmark_passed : null,
    checked_at: new Date().toISOString(), checked_rows: report.rows.length, checked_reference_records: checks.length - report.rows.length, checks,
    public_github_readback: options.github === true, observations: observed,
    reproduced: 'bytes, inputs, derived counts/timing summaries, journal consistency, current implementation mapping and OPA decisions; not original wall-clock latency or full provenance',
    trust_boundary: REPLAY_TRUST_BOUNDARY };
}

function isMain() {
  try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (isMain()) {
  const args = process.argv.slice(2);
  if (!args[0] || args.length > 2 || (args[1] && args[1] !== '--github')) {
    console.error('usage: replay.mjs REPORT.json [--github]'); process.exitCode = 2;
  } else replayReport(args[0], { github: args[1] === '--github' }).then(result => {
    const path = saveReport('runtime-pilot-replay', result);
    console.log(JSON.stringify({ valid: result.valid, benchmark_passed: result.benchmark_passed,
      checked_rows: result.checked_rows, public_readbacks: result.observations.length, report: path }));
    if (!result.valid) process.exitCode = 1;
  }).catch(() => { console.error('replay_failed_integrity_or_source_check'); process.exitCode = 1; });
}

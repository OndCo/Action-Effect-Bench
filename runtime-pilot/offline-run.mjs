import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { prepareAction } from './gate.mjs';
import { authorize } from './authorization.mjs';
import { benchRoot, digestBytes, environment, saveReport, sourceSnapshot, sourceInventoryUnchanged } from './artifacts.mjs';
import { scoreRows, mappingMatches, durationSummary } from './scoring.mjs';
import { upstreamContractCheck } from './upstream/check.mjs';

export function frozenCases() {
  const manifestPath = join(benchRoot, 'runtime-pilot/cases/freeze-manifest.json');
  const bytes = readFileSync(manifestPath);
  const checksum = readFileSync(join(benchRoot, 'runtime-pilot/cases/freeze-manifest.sha256'), 'utf8').trim().split(/\s+/)[0];
  if (digestBytes(bytes) !== checksum) throw new Error('case_manifest_mismatch');
  const manifest = JSON.parse(bytes);
  for (const item of manifest.artifacts) {
    if (item.path.includes('..') || !/^(runtime-pilot\/cases\/|docs\/runtime-case-custody\.md$)/.test(item.path)) throw new Error('invalid_case_path');
    if (digestBytes(readFileSync(join(benchRoot, item.path))) !== item.sha256) throw new Error('case_artifact_mismatch');
  }
  const corpus = JSON.parse(readFileSync(join(benchRoot, 'runtime-pilot/cases/github-issue-comment.v1.json')));
  if (!Array.isArray(corpus.cases) || corpus.cases.length !== manifest.counts.cases) throw new Error('invalid_case_corpus');
  return { corpus, manifest, manifest_sha256: checksum };
}

export function runOffline(options = {}) {
  const runEnvironment = environment();
  if (!runEnvironment.opa_binary.matches_release_pin) throw new Error('verified_opa_required');
  const startedAt = new Date().toISOString(), started = performance.now();
  const sources = sourceSnapshot();
  const { corpus, manifest, manifest_sha256 } = frozenCases();
  const rows = [], pureAuthorization = [], diagnostics = [];
  for (const item of corpus.cases) {
    if (item.expected.mapping.status === 'accepted_partial') {
      const actual = authorize(item.expected.mapping.projection, item.context, item.policy);
      pureAuthorization.push({ id: item.id, base_intent: item.base_intent, expected: item.expected.decision, actual,
        matches: actual.decision === item.expected.decision });
    }
    for (const [lane, native] of Object.entries(item.native)) {
      for (const strategy of ['protocol', 'structured']) {
        const t0 = performance.now();
        let mapping, authorization;
        try {
          mapping = prepareAction(native, item.context, strategy);
          authorization = mapping.status === 'accepted_partial'
            ? authorize(mapping.projection, item.context, item.policy) : { decision: 'not_evaluated' };
        } catch {
          mapping = { status: 'evaluation_failure', reason: 'adapter_failure', authority: 'not_evaluated' };
          authorization = { decision: 'not_evaluated' };
        }
        rows.push({ id: item.id, base_intent: item.base_intent, scenario: item.scenario, lane, strategy,
          expected: item.expected, native, context: item.context, policy: item.policy,
          mapping, authorization, total_ms: performance.now() - t0 });
      }
    }
  }
  // A deliberately corrupted projection illustrates masking; it is not a competitor.
  for (const item of corpus.cases.filter(row => row.expected.mapping.status === 'accepted_partial')) {
    const projection = { ...item.expected.mapping.projection, body_sha256: '0'.repeat(64) };
    const mapping = { status: 'accepted_partial', reason: 'declared_partial', authority: 'not_evaluated', projection };
    const authorization = authorize(projection, item.context, item.policy);
    diagnostics.push({ id: item.id, base_intent: item.base_intent, expected: item.expected, mapping, authorization });
  }
  const summary = {};
  for (const strategy of ['protocol', 'structured']) {
    const selected = rows.filter(row => row.strategy === strategy);
    summary[strategy] = { ...scoreRows(selected), cold_total_cost: durationSummary(selected.map(row => row.total_ms)),
      accepted_cold_total_cost: durationSummary(selected.filter(row => row.mapping.status === 'accepted_partial').map(row => row.total_ms)) };
  }
  const stable = sourceInventoryUnchanged(sources);
  const passed = stable && rows.every(row => mappingMatches(row.mapping, row.expected.mapping)
    && row.authorization.decision === row.expected.decision)
    && pureAuthorization.every(row => row.matches);
  const report = { kind: 'runtime-pilot-offline', version: 1, started_at: startedAt, finished_at: new Date().toISOString(),
    environment: runEnvironment, provenance: { case_manifest_sha256: manifest_sha256, counts: manifest.counts,
      case_authorship: 'same-project-ai-assisted', external_validation: false,
      freeze_ordering: manifest.ordering, sources },
    sources_stable: stable, passed, summary, pure_authorization: pureAuthorization,
    upstream_interface_check: upstreamContractCheck(), diagnostic_lossy_projection: { score: scoreRows(diagnostics), rows: diagnostics },
    rows, duration_ms: performance.now() - started,
    limitations: ['Public development cases, not heldouts or external validation.',
      'Cold subprocess costs include Python checking and actual OPA startup; not enterprise SLA.',
      'Mapping timers include checker time; do not sum overlapping timers.',
      'Lossy projection diagnostic is not a real competing product.', 'This run performs no provider mutations.'] };
  const path = saveReport('runtime-pilot-offline', report, options.outputDir);
  return { passed, report: path, summary, pure_authorization_matches: pureAuthorization.filter(row => row.matches).length,
    pure_authorization_total: pureAuthorization.length, sources_stable: stable };
}

function isMain() {
  try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (isMain()) {
  try { const result = runOffline(); console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1; }
  catch { console.error('offline_run_failure_before_measurement'); process.exitCode = 1; }
}

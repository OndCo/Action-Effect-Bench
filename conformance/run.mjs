import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { reviewCases } from './review-cases.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keysAre = (value, fields) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...fields].sort());
const baseFields = ['status', 'reason', 'authority'];
const failureReasons = {
  invalid_input: ['syntax', 'structure', 'references', 'transport'],
  unsupported_profile: ['numeric_domain', 'spec_version', 'critical_extension', 'profile', 'evidence_scope'],
  untrusted_evidence: ['profile_binding', 'artifact_binding', 'applicability', 'effect_projection'],
  evaluation_failure: ['limit_exceeded', 'internal_error'],
};
const canonicalBase64 = value => typeof value === 'string'
  && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  && Buffer.from(value, 'base64').toString('base64') === value;
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function exactSafeInteger(token) {
  const parts = /^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(token);
  if (!parts) throw new Error('response_number');
  const fraction = parts[3] ?? '';
  const digits = parts[2] + fraction;
  let first = 0;
  while (first < digits.length && digits[first] === '0') first++;
  if (first === digits.length) return;
  let last = digits.length;
  while (last > first && digits[last - 1] === '0') last--;
  const exponent = Number(parts[4] ?? '0');
  const shift = exponent - fraction.length + digits.length - last;
  if (!Number.isSafeInteger(exponent) || shift < 0 || last - first + shift > 16) throw new Error('response_number');
  const magnitude = BigInt(digits.slice(first, last)) * 10n ** BigInt(shift);
  if (magnitude > 9007199254740991n) throw new Error('response_number');
}

// Responses have just two object levels and scalar values. This scanner checks
// duplicate decoded keys without importing either candidate's JSON parser.
export function parseResponse(bytes) {
  if (!bytes.length || bytes.length > 4 * 1024 * 1024
    || bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw new Error('response_bytes');
  let text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.endsWith('\n')) text = text.slice(0, -1);
  if (!text.trim() || /[\n\r]/.test(text)) throw new Error('response_lines');
  const value = JSON.parse(text);
  if (!object(value)) throw new Error('response_object');
  const stack = [];
  const numeric = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      const start = i++;
      while (text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
      const decoded = JSON.parse(text.slice(start, i + 1));
      if (!decoded.isWellFormed()) throw new Error('response_scalar');
      let next = i + 1;
      while (/\s/.test(text[next] ?? '') && next < text.length) next++;
      if (text[next] === ':') {
        const names = stack.at(-1);
        if (!names || names.has(decoded)) throw new Error('response_duplicate');
        names.add(decoded);
      }
    } else if (text[i] === '{') {
      stack.push(new Set());
      if (stack.length > 2) throw new Error('response_depth');
    } else if (text[i] === '}') stack.pop();
    else if (text[i] === '[' || text[i] === ']') throw new Error('response_array');
    else if (text[i] === '-' || /[0-9]/.test(text[i])) {
      // Count fields are exact integers. Accept mathematical aliases such as
      // 1.0, but never let binary64 rounding turn a fractional count into one.
      numeric.lastIndex = i;
      const token = numeric.exec(text);
      if (!token) throw new Error('response_number');
      exactSafeInteger(token[0]);
      i = numeric.lastIndex - 1;
    }
  }
  return value;
}

function resultShape(result) {
  if (!object(result) || result.authority !== 'not_evaluated') return false;
  if (Object.hasOwn(failureReasons, result.status)) {
    return keysAre(result, baseFields) && failureReasons[result.status].includes(result.reason);
  }
  switch (result.status) {
    case 'accepted_partial':
      return keysAre(result, [...baseFields, 'description_digest', 'effect_count', 'unresolved_count'])
        && result.reason === 'declared_partial' && sha256(result.description_digest)
        && Number.isSafeInteger(result.effect_count) && result.effect_count >= 0
        && Number.isSafeInteger(result.unresolved_count) && result.unresolved_count >= 0;
    case 'canonicalized':
      return keysAre(result, [...baseFields, 'canonical_b64', 'sha256'])
        && result.reason === 'supported_subset' && canonicalBase64(result.canonical_b64)
        && sha256(result.sha256) && digest(Buffer.from(result.canonical_b64, 'base64')) === result.sha256;
    case 'capabilities':
      return keysAre(result, [...baseFields, 'spec_version', 'profile', 'numeric_domain', 'acceptance_cache'])
        && result.reason === 'offline_snapshot' && result.spec_version === '0.1.0-draft.1'
        && result.profile === 'https://example.org/profiles/refund/0.1.0-draft.1'
        && result.numeric_domain === 'safe_integer_tokens_only' && result.acceptance_cache === false;
    default: return false;
  }
}

export function scoreResponse(row, expected, requestId) {
  if (!keysAre(row, ['id', 'result']) || row.id !== requestId || !resultShape(row.result)) {
    return { matched: false, mismatch: 'response_contract' };
  }
  const differing = Object.keys(expected).filter(key => !isDeepStrictEqual(row.result[key], expected[key]));
  return differing.length ? { matched: false, mismatch: 'expected_result', fields: differing } : { matched: true };
}

export function runAdapter(adapter, request, expected, options = {}) {
  const started = performance.now();
  const child = spawnSync(adapter.command, adapter.args, {
    input: Buffer.from(JSON.stringify(request) + '\n'), cwd: options.cwd ?? tmpdir(),
    env: { PATH: process.env.PATH ?? '', LANG: 'C.UTF-8', PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' },
    timeout: options.timeout ?? 10000, maxBuffer: 4 * 1024 * 1024, killSignal: 'SIGKILL',
  });
  const common = {
    elapsed_ms: Number((performance.now() - started).toFixed(3)),
    exit_code: child.status, signal: child.signal,
    stdout_b64: (child.stdout ?? Buffer.alloc(0)).toString('base64'),
    stderr: (child.stderr ?? Buffer.alloc(0)).toString('utf8').slice(0, 1000),
  };
  if (child.error || child.status !== 0) {
    return { ...common, transport_ok: false, matched: false,
      error: child.error?.code === 'ETIMEDOUT' ? 'adapter_timeout' : 'adapter_exit' };
  }
  try {
    const response = parseResponse(child.stdout);
    const scored = scoreResponse(response, expected, request.id);
    return { ...common, transport_ok: scored.mismatch !== 'response_contract', response, ...scored,
      ...(scored.mismatch === 'response_contract' ? { error: 'adapter_contract' } : {}) };
  } catch {
    return { ...common, transport_ok: false, matched: false, error: 'adapter_response' };
  }
}

export function agree(left, right) {
  return left.transport_ok && right.transport_ok && isDeepStrictEqual(left.response, right.response);
}

function sourceHashes() {
  const hashes = {};
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === '__pycache__') continue;
      const file = join(path, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && /\.(?:md|json|mjs|py)$/.test(entry.name)) {
        hashes[relative(ROOT, file).split('\\').join('/')] = digest(readFileSync(file));
      }
    }
  }
  walk(join(ROOT, 'action-effect-spec'));
  walk(join(ROOT, 'action-effect-bench/conformance'));
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

function validateCases(corpus) {
  if (!object(corpus) || corpus.version !== 'offline-consumer-v1'
    || corpus.classification !== 'public-development-not-independent-external'
    || !Array.isArray(corpus.cases) || corpus.cases.length === 0) throw new Error('Invalid public case corpus');
  const ids = new Set();
  for (const item of corpus.cases) {
    if (!object(item) || typeof item.id !== 'string' || !item.id.isWellFormed()
      || [...item.id].length < 1 || [...item.id].length > 128 || ids.has(item.id)
      || !['hello', 'check', 'canonicalize'].includes(item.op)
      || typeof item.track !== 'string' || !Array.isArray(item.requirements)
      || !object(item.expected) || typeof item.expected.status !== 'string'
      || typeof item.expected.reason !== 'string'
      || (item.op !== 'hello' && !canonicalBase64(item.document_b64))
      || (item.op === 'hello' && Object.hasOwn(item, 'document_b64'))
      || (Object.hasOwn(item, 'basis') && !object(item.basis))) throw new Error('Invalid public case row');
    ids.add(item.id);
  }
}

export function runComparison() {
  const snapshot = sourceHashes();
  const corpus = JSON.parse(readFileSync(join(ROOT, 'action-effect-bench/conformance/cases.json'), 'utf8'));
  validateCases(corpus);
  const developmentCount = corpus.cases.length;
  const regressions = reviewCases();
  const combined = { ...corpus, cases: [...corpus.cases, ...regressions] };
  validateCases(combined);
  const python = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  if (python.status !== 0) throw new Error('Python 3 is required');
  const work = mkdtempSync(join(tmpdir(), 'action-effect-interop-'));
  const rows = [];
  const started = new Date().toISOString();
  try {
    // The case file is fixed before either consumer is invoked. Optional basis
    // data is a trusted startup argument, never a request-controlled file path.
    for (const [index, item] of combined.cases.entries()) {
      const basis = join(work, 'basis.json');
      if (item.basis) writeFileSync(basis, JSON.stringify(item.basis));
      const config = item.basis ? ['--basis', basis] : [];
      const request = { id: item.id, op: item.op,
        ...(item.op === 'hello' ? {} : { document_b64: item.document_b64 }) };
      const javascript = runAdapter({ command: process.execPath,
        args: [join(ROOT, 'action-effect-spec/implementations/javascript/cli.mjs'), ...config] }, request, item.expected, { cwd: work });
      const pythonResult = runAdapter({ command: 'python3',
        args: [join(ROOT, 'action-effect-spec/implementations/python/cli.py'), ...config] }, request, item.expected, { cwd: work });
      rows.push({ id: item.id, suite: index < developmentCount ? 'frozen-public-development' : 'post-review-regression',
        track: item.track, requirements: item.requirements, expected: item.expected,
        javascript, python: pythonResult, agreement: agree(javascript, pythonResult) });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const endSnapshot = sourceHashes();
  const unchanged = isDeepStrictEqual(snapshot, endSnapshot);
  const summary = {
    cases: rows.length,
    frozen_public_development_cases: developmentCount,
    post_review_regression_cases: regressions.length,
    frozen_public_javascript_matches: rows.slice(0, developmentCount).filter(x => x.javascript.matched).length,
    frozen_public_python_matches: rows.slice(0, developmentCount).filter(x => x.python.matched).length,
    javascript_expected_matches: rows.filter(x => x.javascript.matched).length,
    python_expected_matches: rows.filter(x => x.python.matched).length,
    cross_implementation_agreement: rows.filter(x => x.agreement).length,
    javascript_adapter_failures: rows.filter(x => !x.javascript.transport_ok).length,
    python_adapter_failures: rows.filter(x => !x.python.transport_ok).length,
    sources_unchanged_during_run: unchanged,
    external_independent_evaluations: 0,
    live_authorization_decisions: 0,
    real_provider_side_effects: 0,
  };
  const passed = unchanged && rows.every(x => x.javascript.matched && x.python.matched && x.agreement);
  const report = { format: 'offline-consumer-comparison-v1', started_at: started, completed_at: new Date().toISOString(),
    classification: corpus.classification, runtimes: { javascript: process.version, python: python.stdout.trim() },
    scope: 'Exposed development checks of one finite synthetic partial declaration profile; not policy or full core conformance.',
    timing_scope: 'Per-process startup, transport and evaluation diagnostics; not performance rankings or execution latency.',
    regression_scope: 'Post-review cases are controller-authored after observing defects, not independent or held-out samples.',
    passed, summary, source_sha256: snapshot,
    ...(!unchanged ? { changed_source_sha256: endSnapshot } : {}), results: rows };
  const reports = join(ROOT, 'action-effect-bench/reports');
  mkdirSync(reports, { recursive: true });
  const name = `offline-consumers-${started.replace(/[:.]/g, '-')}`;
  const jsonPath = join(reports, name + '.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const table = rows.map(row => `| ${row.id} | ${row.javascript.matched ? 'match' : 'FAIL'} | ${row.python.matched ? 'match' : 'FAIL'} | ${row.agreement ? 'yes' : 'no'} |`).join('\n');
  writeFileSync(join(reports, name + '.md'), `# Offline Consumer Comparison\n\nRun: ${started}. Status: ${passed ? 'PASS' : 'FAIL'}.\n\n`
    + `Exposed internal development cases, not external validation or full core conformance.\n`
    + `No live authorization decisions or real provider side effects. Timing includes process startup; no speed ranking.\n\n`
    + `JavaScript matches: ${summary.javascript_expected_matches}/${rows.length}. Python matches: ${summary.python_expected_matches}/${rows.length}.\n`
    + `Frozen public cases: ${developmentCount}. Additional post-review regressions: ${regressions.length} (not independent samples).\n`
    + `Exact cross-implementation agreement: ${summary.cross_implementation_agreement}/${rows.length}. Agreement alone is not correctness.\n`
    + `Adapter failures: JS ${summary.javascript_adapter_failures}, Python ${summary.python_adapter_failures}. Source snapshot unchanged: ${unchanged}.\n\n`
    + `The [JSON report](./${name}.json) contains source hashes, runtime versions, expected outcomes and exact responses.\n\n`
    + `| Case | JavaScript | Python | Agreement |\n| --- | --- | --- | --- |\n${table}\n`, { flag: 'wx' });
  return { passed, summary, report: jsonPath };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node conformance/run.mjs');
    const result = runComparison();
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(`Comparison did not complete: ${error.message}`);
    process.exitCode = 2;
  }
}

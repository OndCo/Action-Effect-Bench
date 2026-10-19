import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const benchRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const roots = {
  'OndCo/Action-Effect-Bench': benchRoot,
  'OndCo/Action-Effect-Spec': resolve(benchRoot, '../action-effect-spec'),
};
const pins = {
  'OndCo/Action-Effect-Bench': 'cecde389637be4f5fd3482e4942ce3fd1a623ac6',
  'OndCo/Action-Effect-Spec': 'a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40',
};
const taskIds = [
  'release-integrity',
  'clean-clone-quickstart',
  'consumer-v1-1-migration',
  'official-mcp-compatibility',
  'limits-and-recovery',
  'conformance-support',
];
const offlineReport = 'reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json';
const blobs = new Map();

function document(name) {
  const path = resolve(benchRoot, 'field-study', name);
  assert.ok(existsSync(path), `Missing frozen field-study document: ${name}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function fields(value, required, optional = []) {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  for (const key of required) assert.ok(Object.hasOwn(value, key), `Missing field: ${key}`);
  for (const key of Object.keys(value)) assert.ok([...required, ...optional].includes(key), `Unexpected field: ${key}`);
}

function text(value) {
  assert.equal(typeof value, 'string');
  assert.ok(value.trim().length > 0);
}

function unique(values) {
  assert.equal(new Set(values).size, values.length, 'Duplicate identifiers or sources');
}

function sourceKey(source) {
  return `${source.repository}@${source.ref}:${source.path}`;
}

function sourceShape(source) {
  assert.ok(Object.hasOwn(pins, source.repository));
  assert.equal(source.ref, pins[source.repository], 'Source must use its immutable release commit');
  assert.match(source.path, /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/);
  assert.ok(!source.path.split('/').some(part => part === '.' || part === '..'));
  assert.ok(!/^(?:field-study|\.git|\.runtime-private)\//.test(source.path));
}

function validateInputs(input) {
  fields(input, ['version', 'source_refs', 'tasks']);
  assert.equal(input.version, 1);
  assert.deepEqual(input.source_refs, pins);
  assert.ok(Array.isArray(input.tasks));
  assert.deepEqual(input.tasks.map(task => task.id), taskIds);
  for (const [index, task] of input.tasks.entries()) {
    fields(task, ['id', 'title', 'prompt', 'lane', 'sources', 'mandatory_deliverables'],
      index === 0 ? ['allow_release_assets'] : []);
    if (index === 0) assert.equal(task.allow_release_assets, true);
    for (const key of ['id', 'title', 'prompt']) text(task[key]);
    assert.equal(task.lane, index % 2 === 0 ? 'sdk' : 'mcp');
    assert.ok(Array.isArray(task.sources) && task.sources.length >= 2 && task.sources.length <= 5);
    unique(task.sources.map(sourceKey));
    for (const source of task.sources) {
      fields(source, ['repository', 'path', 'ref']);
      sourceShape(source);
    }
    assert.ok(Array.isArray(task.mandatory_deliverables) && task.mandatory_deliverables.length >= 3);
    task.mandatory_deliverables.forEach(text);
    const visible = [task.title, task.prompt, ...task.mandatory_deliverables].join('\n');
    assert.doesNotMatch(visible, /\b[0-9a-f]{64}\b/i, 'Expected digests belong in the separate rubric');
    assert.doesNotMatch(visible, /(?:accepted_partial|untrusted_evidence|invalid_input)\//);
  }
}

function validateCriteria(criteria, input) {
  fields(criteria, ['version', 'source_refs', 'evaluation_policy', 'human_score_categories', 'sources', 'assets', 'tasks']);
  assert.equal(criteria.version, 1);
  assert.deepEqual(criteria.source_refs, pins);
  assert.deepEqual(criteria.tasks.map(task => task.id), taskIds);
  assert.equal(criteria.evaluation_policy.population, 'exposed_internal_maintenance');
  assert.equal(criteria.evaluation_policy.oracle_visible_to_task_model, false);
  assert.equal(criteria.evaluation_policy.facts_frozen_before_model_results, true);
  assert.equal(criteria.evaluation_policy.publication_required, false);
  assert.equal(criteria.evaluation_policy.maximum_ordinary_task_publications, 6);
  assert.equal(criteria.evaluation_policy.grants_write_authority, false);
  for (const [axis, values] of Object.entries({
    setup: ['ready', 'blocked'],
    quality: ['complete', 'partial', 'incorrect', 'no_result'],
    utility: ['decision_ready', 'needs_rework', 'no_incremental_value'],
    use: ['used', 'not_used', 'not_reviewed'],
  })) {
    assert.deepEqual(Object.keys(criteria.human_score_categories[axis]), values);
    Object.values(criteria.human_score_categories[axis]).forEach(text);
  }
  assert.deepEqual(Object.keys(criteria.human_score_categories), ['setup', 'quality', 'utility', 'use']);
  assert.ok(Array.isArray(criteria.sources));
  unique(criteria.sources.map(source => source.id));
  unique(criteria.sources.map(sourceKey));
  const allInputSources = new Set(input.tasks.flatMap(task => task.sources.map(sourceKey)));
  assert.deepEqual(new Set(criteria.sources.map(sourceKey)), allInputSources);
  const catalog = new Map(criteria.sources.map(source => [source.id, source]));
  for (const source of criteria.sources) {
    fields(source, ['id', 'repository', 'path', 'ref', 'raw_sha256', 'byte_length', 'line_count']);
    text(source.id);
    sourceShape(source);
    assert.match(source.raw_sha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isSafeInteger(source.byte_length) && source.byte_length > 0 && source.byte_length <= 2 * 1024 * 1024);
    assert.ok(Number.isSafeInteger(source.line_count) && source.line_count > 0);
  }
  assert.deepEqual(criteria.assets.map(asset => asset.id), ['release-manuscript-pdf']);
  for (const asset of criteria.assets) {
    fields(asset, ['id', 'repository', 'path', 'ref', 'release_tag', 'asset_name', 'raw_sha256', 'byte_length', 'maximum_bytes', 'required']);
    sourceShape(asset);
    assert.equal(asset.repository, 'OndCo/Action-Effect-Bench');
    assert.equal(asset.path, 'paper/manuscript.pdf');
    assert.equal(asset.release_tag, 'v0.2.0-draft.1');
    assert.equal(asset.asset_name, 'manuscript.pdf');
    assert.match(asset.raw_sha256, /^[0-9a-f]{64}$/);
    assert.equal(asset.maximum_bytes, 2 * 1024 * 1024);
    assert.equal(asset.required, false);
    assert.ok(Number.isSafeInteger(asset.byte_length) && asset.byte_length > 0 && asset.byte_length <= asset.maximum_bytes);
  }
  for (const task of criteria.tasks) {
    fields(task, ['id', 'required_facts', 'material_error_rules', 'utility_criteria']);
    const allowed = new Set(input.tasks.find(item => item.id === task.id).sources.map(sourceKey));
    assert.ok(Array.isArray(task.required_facts) && task.required_facts.length >= 4);
    unique(task.required_facts.map(fact => fact.id));
    const factIds = new Set(task.required_facts.map(fact => fact.id));
    for (const fact of task.required_facts) {
      fields(fact, ['id', 'statement', 'citations'], ['verification']);
      text(fact.id);
      text(fact.statement);
      assert.ok(Array.isArray(fact.citations) && fact.citations.length > 0);
      for (const citation of fact.citations) {
        fields(citation, ['source_id', 'start_line', 'end_line', 'quote']);
        const source = catalog.get(citation.source_id);
        assert.ok(source, `Unknown citation source: ${citation.source_id}`);
        assert.ok(allowed.has(sourceKey(source)), `Citation outside task source allowlist: ${task.id}`);
        assert.ok(Number.isSafeInteger(citation.start_line) && citation.start_line >= 1);
        assert.ok(Number.isSafeInteger(citation.end_line) && citation.end_line >= citation.start_line);
        assert.ok(citation.end_line <= source.line_count);
        text(citation.quote);
      }
      if (fact.verification) {
        fields(fact.verification, ['kind', 'source_id', 'checksum_source_id', 'expected_match']);
        assert.equal(fact.verification.kind, 'raw_sha256_equals_checksum');
        assert.equal(typeof fact.verification.expected_match, 'boolean');
        assert.equal(task.id, 'release-integrity');
        for (const key of ['source_id', 'checksum_source_id']) {
          assert.ok(catalog.has(fact.verification[key]));
          assert.ok(allowed.has(sourceKey(catalog.get(fact.verification[key]))));
        }
      }
    }
    assert.ok(Array.isArray(task.material_error_rules) && task.material_error_rules.length >= 2);
    unique(task.material_error_rules.map(rule => rule.id));
    for (const rule of task.material_error_rules) {
      fields(rule, ['id', 'rule', 'fact_ids']);
      text(rule.id);
      text(rule.rule);
      assert.ok(Array.isArray(rule.fact_ids) && rule.fact_ids.length > 0);
      for (const id of rule.fact_ids) assert.ok(factIds.has(id), `Unknown material-error fact: ${id}`);
    }
    fields(task.utility_criteria, ['decision_ready', 'needs_rework', 'no_incremental_value']);
    Object.values(task.utility_criteria).forEach(text);
  }
}

function pinnedBytes(source) {
  sourceShape(source);
  const key = sourceKey(source);
  if (!blobs.has(key)) {
    blobs.set(key, execFileSync('git', ['--no-pager', 'show', `${source.ref}:${source.path}`], {
      cwd: roots[source.repository], maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    }));
  }
  return blobs.get(key);
}

function lines(bytes) {
  const result = bytes.toString('utf8').split('\n');
  if (result.at(-1) === '') result.pop();
  return result;
}

function verifySources(criteria) {
  const catalog = new Map(criteria.sources.map(source => [source.id, source]));
  for (const source of criteria.sources) {
    const raw = pinnedBytes(source);
    assert.equal(createHash('sha256').update(raw).digest('hex'), source.raw_sha256, `Raw digest drift: ${source.id}`);
    assert.equal(raw.byteLength, source.byte_length, `Byte length drift: ${source.id}`);
    assert.equal(lines(raw).length, source.line_count, `Line count drift: ${source.id}`);
  }
  for (const asset of criteria.assets) {
    const raw = pinnedBytes(asset);
    assert.equal(createHash('sha256').update(raw).digest('hex'), asset.raw_sha256, `Asset digest drift: ${asset.id}`);
    assert.equal(raw.byteLength, asset.byte_length, `Asset size drift: ${asset.id}`);
    assert.equal(raw.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(raw.byteLength <= asset.maximum_bytes);
  }
  for (const task of criteria.tasks) {
    for (const fact of task.required_facts) {
      for (const citation of fact.citations) {
        const actual = lines(pinnedBytes(catalog.get(citation.source_id)))
          .slice(citation.start_line - 1, citation.end_line).join('\n');
        assert.equal(actual, citation.quote, `Citation drift: ${task.id}/${fact.id}`);
      }
      if (fact.verification) {
        const check = fact.verification;
        const source = catalog.get(check.source_id);
        const checksum = pinnedBytes(catalog.get(check.checksum_source_id)).toString('utf8').trim();
        const match = /^([0-9a-f]{64})  ([^\n]+)$/.exec(checksum);
        assert.ok(match, 'Published checksum must identify exact raw bytes and filename');
        assert.equal(match[2], source.path.split('/').at(-1));
        assert.equal(source.raw_sha256 === match[1], check.expected_match);
        assert.ok(pinnedBytes(source).byteLength <= 2 * 1024 * 1024);
      }
    }
  }
}

test('task inputs have the exact model-facing API, six intents and alternating lanes', () => {
  validateInputs(document('tasks.json'));
});

test('release, quickstart and conformance sources include the necessary tagged evidence', () => {
  const input = document('tasks.json');
  const paths = id => input.tasks.find(task => task.id === id).sources.map(source => source.path);
  assert.ok(paths('release-integrity').includes('reports/runtime-pilot-summary.md'));
  assert.ok(paths('release-integrity').includes(offlineReport));
  assert.ok(paths('release-integrity').includes(`${offlineReport}.sha256`));
  assert.ok(paths('clean-clone-quickstart').includes('reports/release-verification.md'));
  assert.ok(paths('official-mcp-compatibility').includes('runtime-pilot/mcp-server.mjs'));
  assert.ok(paths('conformance-support').includes('conformance/requirements.md'));
  assert.match(input.tasks.at(-1).prompt, /no change/i);
});

test('separate rubric covers each task, allowable citations, material errors and human score axes', () => {
  validateCriteria(document('criteria.json'), document('tasks.json'));
});

test('every raw digest, line count, quotation and PDF identity matches immutable git objects', () => {
  const criteria = document('criteria.json');
  validateCriteria(criteria, document('tasks.json'));
  assert.equal(criteria.tasks[0].required_facts.filter(fact => fact.verification).length, 1);
  verifySources(criteria);
});

test('only T1 permits the single bounded PDF release-asset operation', () => {
  const input = document('tasks.json');
  assert.equal(input.tasks[0].allow_release_assets, true);
  for (const task of input.tasks.slice(1)) assert.equal(Object.hasOwn(task, 'allow_release_assets'), false);
  assert.match(input.tasks[0].prompt, /inspect_release\(\{repository\}\)/);
  assert.match(input.tasks[0].prompt, /inspect_release_asset\(\{repository,asset_name\}\)/);
  assert.match(input.tasks[0].prompt, /manuscript\.pdf/);
  assert.match(input.tasks[0].prompt, /2 MiB/);
  assert.match(input.tasks[0].prompt, /optional/i);
});

test('T1 obtains the large report digest through source inspection rather than full text or a PDF substitute', () => {
  const task = document('tasks.json').tasks[0];
  assert.match(task.prompt, /inspect_repository_file\(\{repository,path\}\)/);
  assert.match(task.prompt, /adjacent checksum/);
  assert.match(task.prompt, /not a substitute/i);
  assert.ok(task.sources.some(source => source.path === offlineReport));
  assert.ok(task.sources.some(source => source.path === `${offlineReport}.sha256`));
});

test('all independent tasks request bounded useful Markdown final text through the actual read tool', () => {
  for (const task of document('tasks.json').tasks) {
    assert.match(task.prompt, /read_repository_file\(\{repository,path\}\)/);
    assert.match(task.prompt, /6000 UTF-8 bytes/);
    assert.match(task.prompt, /Markdown/);
    assert.match(task.prompt, /final text/);
    assert.match(task.prompt, /fresh context/);
  }
});

test('model-facing inputs reject an injected answer-key field', () => {
  const input = document('tasks.json');
  input.tasks[0].expected_answer = 'rubric leak';
  assert.throws(() => validateInputs(input), /Unexpected field: expected_answer/);
});

test('model-facing inputs reject an expected raw digest in a prompt', () => {
  const input = document('tasks.json');
  input.tasks[0].prompt += ` Expected digest: ${'a'.repeat(64)}`;
  assert.throws(() => validateInputs(input), /Expected digests/);
});

test('model-facing source allowlists reject a mutable branch', () => {
  const input = document('tasks.json');
  input.tasks[0].sources[0].ref = 'main';
  assert.throws(() => validateInputs(input), /immutable release commit/);
});

test('model-facing source allowlists reject duplicate entries', () => {
  const input = document('tasks.json');
  input.tasks[0].sources[1] = structuredClone(input.tasks[0].sources[0]);
  assert.throws(() => validateInputs(input), /Duplicate identifiers or sources/);
});

test('model-facing inputs reject release-asset permission on another task', () => {
  const input = document('tasks.json');
  input.tasks[1].allow_release_assets = true;
  assert.throws(() => validateInputs(input), /Unexpected field: allow_release_assets/);
});

test('rubric rejects a material-error rule pointing at a nonexistent fact', () => {
  const criteria = document('criteria.json');
  criteria.tasks[0].material_error_rules[0].fact_ids = ['missing-fact'];
  assert.throws(() => validateCriteria(criteria, document('tasks.json')), /Unknown material-error fact/);
});

test('rubric rejects citations unavailable to that task', () => {
  const criteria = document('criteria.json');
  const input = document('tasks.json');
  const allowed = new Set(input.tasks[0].sources.map(sourceKey));
  const outside = criteria.sources.find(source => !allowed.has(sourceKey(source)));
  criteria.tasks[0].required_facts[0].citations[0] = {
    source_id: outside.id, start_line: 1, end_line: 1, quote: 'Wrong task source',
  };
  assert.throws(() => validateCriteria(criteria, input), /outside task source allowlist/);
});

test('pinned-byte verification rejects an altered expected raw digest', () => {
  const criteria = document('criteria.json');
  criteria.sources[0].raw_sha256 = '0'.repeat(64);
  assert.throws(() => verifySources(criteria), /Raw digest drift/);
});

test('pinned-byte verification rejects a fabricated source quotation', () => {
  const criteria = document('criteria.json');
  criteria.tasks[0].required_facts[0].citations[0].quote = 'Not present in the release';
  assert.throws(() => verifySources(criteria), /Citation drift/);
});

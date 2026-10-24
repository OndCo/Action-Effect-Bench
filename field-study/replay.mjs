import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { digestBytes, verifyJournal, assertPublicValue } from './artifacts.mjs';
import { parseJSON } from './model-client.mjs';
import { loadRecordedSources } from './provenance.mjs';
import { auditFrozenInputs, reconstructStudy, auditSourceObservations } from './replay-checks.mjs';
export { auditFrozenInputs } from './replay-checks.mjs';

const check = (condition, code) => { if (!condition) throw new Error(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = isDeepStrictEqual;
const finiteTime = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const READ_NAMES = ['get_file_contents', 'get_release_by_tag', 'issue_read'];
const SCOPES = { customer_production: false, independent_external_evaluation: false, new_provider_writes: false,
  read_tools_are_profile_authorization: false, quality_requires_separate_review: true };
function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function auditSetup(setup, events, config) {
  const captured = events.filter(event => event.type === 'native_setup');
  check(captured.length === 1 && same(captured[0], { type: 'native_setup', ...setup }), 'native_setup_binding');
  check(object(setup) && finiteTime(setup.duration_ms) && ['ready', 'blocked'].includes(setup.status), 'native_setup_binding');
  if (setup.status === 'blocked') {
    check(!Object.hasOwn(setup, 'inventory') && typeof setup.reason === 'string' && /^(mcp_[a-z_]+|setup_failed)$/.test(setup.reason), 'native_setup_binding');
    return;
  }
  const inventory = setup.inventory, pin = config.github_mcp;
  check(object(inventory) && same(inventory.pins, { source_commit: pin.source_commit,
    archive_sha256: pin.archive_sha256, executable_sha256: pin.executable_sha256 })
    && inventory.executable_sha256 === pin.executable_sha256 && inventory.transport === 'stdio' && inventory.read_only === true
    && same(inventory.selected_tools, READ_NAMES) && inventory.server?.name === 'github-mcp-server'
    && inventory.server.version === pin.version.replace(/^v/, '') && /^\d{4}-\d{2}-\d{2}$/.test(inventory.protocol_version)
    && Array.isArray(inventory.tools) && same(inventory.tools.map(tool => tool.name), READ_NAMES)
    && inventory.tools_sha256 === digestBytes(stableJSON(inventory.tools)), 'native_inventory');
  const required = { get_file_contents: ['owner', 'repo'], get_release_by_tag: ['owner', 'repo', 'tag'], issue_read: ['owner', 'repo', 'issue_number', 'method'] };
  for (const tool of inventory.tools) {
    check(tool.annotations?.readOnlyHint === true && tool.inputSchema?.type === 'object'
      && object(tool.inputSchema.properties) && Array.isArray(tool.inputSchema.required), 'native_inventory');
    for (const key of required[tool.name]) {
      check(tool.inputSchema.required.includes(key) && (key === 'issue_number'
        ? ['integer', 'number'].includes(tool.inputSchema.properties[key]?.type)
        : tool.inputSchema.properties[key]?.type === 'string'), 'native_inventory');
    }
  }
}

function auditMetadata(report, frozen, records, manifest, config) {
  const events = records.map(record => record.event), begin = events[0], end = events.at(-1);
  check(same(report.configuration, config) && same(frozen.model_configuration, config.azure_model), 'configuration_binding');
  check(same(report.scopes, SCOPES) && report.population === 'same-project-real-model-maintainer-use', 'study_scope');
  check(frozen.created_before_scored_model_requests === true && frozen.new_provider_writes_enabled === false
    && frozen.population === 'exposed-internal-maintainer-use' && same(frozen.selected_task_order, manifest.tasks.map(task => task.id)), 'freeze_metadata');
  check(begin.type === 'begin' && same(begin.metadata, { freeze: report.freeze,
    population: 'real-model-readonly-maintainer-use', tasks: manifest.tasks.map(task => ({ id: task.id, lane: task.lane })) })
    && typeof begin.run_id === 'string' && report.journal.file === `${begin.run_id}.jsonl`
    && /^field-use-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z-[a-f0-9]{6}$/.test(begin.run_id), 'journal_metadata');
  auditSetup(report.native_setup, events, config);
  const closes = events.filter(event => event.type === 'native_close_failed');
  check(end.type === 'end' && closes.length <= 1 && finiteTime(report.duration_ms)
    && typeof report.source_inventory_unchanged === 'boolean'
    && same(end.outcome, { status: report.status, duration_ms: report.duration_ms, summary: report.summary,
      source_inventory_unchanged: report.source_inventory_unchanged })
    && report.status === (report.source_inventory_unchanged && !closes.length ? 'recorded' : 'invalidated'), 'final_outcome_binding');
}

export function safeChild(root, name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(name)) throw new Error('artifact_path');
  const path = join(realpathSync(root), name);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 48 * 1024 * 1024 || dirname(realpathSync(path)) !== realpathSync(root)) throw new Error('artifact_path');
  return path;
}

export function readCheckedArtifact(root, name) {
  const raw = readFileSync(safeChild(root, name));
  const sidecar = readFileSync(safeChild(root, `${name}.sha256`), 'utf8');
  const sha256 = digestBytes(raw);
  if (sidecar !== `${sha256}  ${name}\n`) throw new Error('artifact_checksum');
  const value = parseJSON(raw.toString('utf8'), 'artifact_json');
  assertPublicValue(value);
  return { raw, sha256, value };
}

export function auditReadEvidence(events, criteria) {
  const references = new Map(criteria.sources.map(source => [
    `https://github.com/${source.repository}/blob/${source.ref}/${source.path}`, source,
  ]));
  let file_observations = 0, retained_text_observations = 0;
  for (const event of events) {
    if (event.type !== 'read_tool_result' || event.status !== 'ok' || !['read_repository_file', 'inspect_repository_file'].includes(event.tool)) continue;
    const reference = references.get(event.source_url);
    if (!reference || typeof event.result?.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(event.result.sha256)
      || reference.raw_sha256 !== event.result.sha256) throw new Error('read_evidence_reference');
    if (!Number.isSafeInteger(event.result.bytes) || event.result.bytes < 0
      || (reference.byte_length !== undefined && reference.byte_length !== event.result.bytes)) throw new Error('read_evidence_bytes');
    if (event.content_base64 !== undefined) {
      const bytes = Buffer.from(event.content_base64, 'base64');
      if (bytes.toString('base64') !== event.content_base64 || digestBytes(bytes) !== event.result.sha256 || bytes.length !== event.result.bytes) throw new Error('read_evidence_bytes');
      retained_text_observations++;
    } else if (event.tool === 'read_repository_file') throw new Error('read_evidence_missing_body');
    file_observations++;
  }
  return { file_observations, retained_text_observations };
}

export function replayStudy(reportPath) {
  const root = dirname(resolve(reportPath)), checked = readCheckedArtifact(root, basename(reportPath)), report = checked.value;
  if (!['field-study-use/1', 'field-study-use/2'].includes(report.format) || !['recorded', 'invalidated'].includes(report.status)) throw new Error('invalid_study_status');
  const frozen = readCheckedArtifact(root, report.freeze.file);
  if (frozen.sha256 !== report.freeze.sha256 || frozen.value.format !== 'field-study-freeze/1') throw new Error('freeze_binding');
  const sources = loadRecordedSources(report.provenance);
  const context = auditFrozenInputs(report, frozen.value, sources.read), { manifest, criteria, config } = context;
  if (!same(frozen.value.provenance, report.provenance)) throw new Error('source_provenance');
  const journalBytes = readFileSync(safeChild(root, report.journal.file));
  const verified = verifyJournal(journalBytes);
  if (!verified.valid || !verified.complete || verified.sha256 !== report.journal.sha256) throw new Error('journal_binding');
  const records = journalBytes.toString('utf8').trimEnd().split('\n').map(line => parseJSON(line, 'journal_json'));
  const events = records.map(record => record.event);
  if (JSON.stringify(events[0].metadata.freeze) !== JSON.stringify(report.freeze)) throw new Error('journal_freeze_binding');
  auditMetadata(report, frozen.value, records, manifest, config);
  const { summary, groups } = reconstructStudy(report, records, context);
  auditReadEvidence(events, criteria);
  const observations = auditSourceObservations(groups, context);
  return { valid: true, report_sha256: checked.sha256, journal_records: records.length, ...observations, summary,
    source_revisions: sources.revisions, study_version: context.version,
    ...(context.version === 3 ? { contract_summary: report.contract_summary } : {}),
    status: report.status, study_recorded: report.status === 'recorded',
    model_requests_replayed: 0, provider_requests_replayed: 0,
    scope: 'Recomputes captured integrity and mechanical checks. Does not reproduce stochastic model generation or externally certify task quality.' };
}

function isEntrypoint() {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isEntrypoint()) {
  try {
    if (process.argv.length !== 3) throw new Error('expected_one_local_report');
    console.log(JSON.stringify(replayStudy(process.argv[2]), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ valid: false, reason: /^[a-z][a-z0-9_]{1,80}$/.test(error.message) ? error.message : 'replay_error' }));
    process.exitCode = 1;
  }
}

import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestBytes, verifyJournal } from './artifacts.mjs';
import { parseJSON } from './model-client.mjs';
import { verifyProvenance } from './provenance.mjs';
import { inspectTask, summarizeStudy } from './scoring.mjs';

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
  return { raw, sha256, value: parseJSON(raw.toString('utf8'), 'artifact_json') };
}

export function auditReadEvidence(events, criteria) {
  const references = new Map(criteria.sources.map(source => [
    `https://github.com/${source.repository}/blob/${source.ref}/${source.path}`, source.raw_sha256,
  ]));
  let file_observations = 0, retained_text_observations = 0;
  for (const event of events) {
    if (event.type !== 'read_tool_result' || event.status !== 'ok' || !['read_repository_file', 'inspect_repository_file'].includes(event.tool)) continue;
    if (references.get(event.source_url) !== event.result.sha256) throw new Error('read_evidence_reference');
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
  if (report.format !== 'field-study-use/1' || report.status !== 'recorded' || report.source_inventory_unchanged !== true) throw new Error('invalid_study_status');
  const frozen = readCheckedArtifact(root, report.freeze.file);
  if (frozen.sha256 !== report.freeze.sha256 || frozen.value.format !== 'field-study-freeze/1') throw new Error('freeze_binding');
  const criteriaBytes = readFileSync(new URL('./criteria.json', import.meta.url));
  const taskBytes = readFileSync(new URL('./tasks.json', import.meta.url));
  if (digestBytes(criteriaBytes) !== frozen.value.criteria_sha256 || digestBytes(taskBytes) !== frozen.value.tasks_sha256) throw new Error('task_or_criteria_drift');
  const manifest = parseJSON(taskBytes.toString('utf8'), 'tasks_json');
  const criteria = parseJSON(criteriaBytes.toString('utf8'), 'criteria_json');
  if (JSON.stringify(frozen.value.task_inputs) !== JSON.stringify(manifest) || !verifyProvenance(report.provenance)
    || JSON.stringify(frozen.value.provenance) !== JSON.stringify(report.provenance)) throw new Error('source_provenance');
  const journalBytes = readFileSync(safeChild(root, report.journal.file));
  const verified = verifyJournal(journalBytes);
  if (!verified.valid || !verified.complete || verified.sha256 !== report.journal.sha256) throw new Error('journal_binding');
  const records = journalBytes.toString('utf8').trimEnd().split('\n').map(line => parseJSON(line, 'journal_json'));
  const events = records.map(record => record.event);
  if (JSON.stringify(events[0].metadata.freeze) !== JSON.stringify(report.freeze)) throw new Error('journal_freeze_binding');
  const summary = summarizeStudy(manifest.tasks, report.tasks);
  if (JSON.stringify(summary) !== JSON.stringify(report.summary) || JSON.stringify(events.at(-1).outcome.summary) !== JSON.stringify(summary)) throw new Error('summary_mismatch');
  for (const [index, row] of report.tasks.entries()) {
    const recorded = events.filter(event => event.type === 'agent_event' && event.task_id === row.id).map(event => event.event);
    const ends = events.filter(event => event.type === 'scheduled_task_end' && event.task_id === row.id);
    if (JSON.stringify(recorded) !== JSON.stringify(row.result.trace)) throw new Error('task_trace_binding');
    if (row.result.status !== 'blocked' && (ends.length !== 1 || ends[0].result_sha256 !== digestBytes(JSON.stringify(row.result)))) throw new Error('task_result_binding');
    if (JSON.stringify(inspectTask(manifest.tasks[index], row.result)) !== JSON.stringify(row.mechanical_checks)) throw new Error('task_check_mismatch');
  }
  const observations = auditReadEvidence(events, criteria);
  return { valid: true, report_sha256: checked.sha256, journal_records: records.length, ...observations, summary,
    model_requests_replayed: 0, provider_requests_replayed: 0,
    scope: 'Recomputes captured integrity and mechanical checks. Does not reproduce stochastic model generation or externally certify task quality.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Expected one local field-study-use report path.');
    console.log(JSON.stringify(replayStudy(process.argv[2]), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ valid: false, reason: error.message }));
    process.exitCode = 1;
  }
}

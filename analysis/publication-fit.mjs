import { readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestBytes, saveArtifact } from '../field-study/artifacts.mjs';
import { readCheckedArtifact, replayStudy } from '../field-study/replay.mjs';
import { prepareAction } from '../runtime-pilot/gate.mjs';
import { sourceSnapshot, environment } from '../runtime-pilot/artifacts.mjs';

export function materializeReport(report) {
  return `# Maintainer draft: ${report.task_id}\n\n${report.report_markdown}\n\n## Conclusion\n${report.conclusion}\n\n## Source references\n${report.citations.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n\nNot published. Requires maintainer approval before dispatch.\n`;
}

export function compactReport(report, artifactUrl) {
  return `# Maintainer draft: ${report.task_id}\n\n${report.conclusion}\n\nFull report and sources: ${artifactUrl}\nTask: ${report.task_id}\nReport JSON SHA-256: \`${digestBytes(JSON.stringify(report))}\`\n\nNot published. The linked record remains authoritative; this handoff does not assert independent review or grant permission.\n`;
}

export function assertCommittedReport({ revision, file, raw, readBlob = (ref, path) => execFileSync('git', ['show', `${ref}:${path}`], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), maxBuffer: 48 * 1024 * 1024,
}) }) {
  if (!/^[a-f0-9]{40}$/.test(revision) || !/^field-study-use-[A-Za-z0-9._-]+\.json$/.test(file)) throw new Error('evidence_identity');
  if (!Buffer.from(readBlob(revision, `reports/${file}`)).equals(raw)) throw new Error('committed_report_mismatch');
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || !/^[a-f0-9]{40}$/.test(process.argv[3])) throw new Error('Expected local report and the already committed evidence revision; no network calls are made.');
  const reportPath = resolve(process.argv[2]);
  const root = fileURLToPath(new URL('../reports/', import.meta.url));
  if (reportPath !== resolve(root, basename(reportPath))) throw new Error('evidence_identity');
  const checked = readCheckedArtifact(root, basename(reportPath));
  assertCommittedReport({ revision: process.argv[3], file: basename(reportPath), raw: checked.raw });
  const replay = replayStudy(reportPath);
  const sourceUrl = `https://github.com/OndCo/Action-Effect-Bench/blob/${process.argv[3]}/reports/${basename(reportPath)}`;
  const rows = [];
  for (const task of checked.value.tasks) {
    if (!task.result.finalOutput) continue;
    const value = JSON.parse(task.result.finalOutput);
    for (const [form, body] of [['standalone', materializeReport(value)], ['linked-handoff', compactReport(value, sourceUrl)]]) {
      const params = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 2147483647, body };
      const native = task.lane === 'sdk' ? { lane: 'sdk', call: params } : { lane: 'mcp', call: { name: 'add_issue_comment', arguments: params } };
      const context = { principal: 'packaging-fixture', data_class: 'public-maintainer-draft', implementation: 'github-comment-bridge/1' };
      for (const strategy of ['protocol', 'structured']) {
        const started = performance.now();
        const prepared = await prepareAction(native, context, strategy);
        rows.push({ task_id: task.id, lane: task.lane, form, strategy, body_bytes: Buffer.byteLength(body), body_sha256: digestBytes(body),
          native, context, prepared, duration_ms: performance.now() - started });
      }
    }
  }
  const artifact = saveArtifact(root, 'field-study-publication-fit', { format: 'field-study-publication-fit/1',
    population: 'exploratory-packaging-of-captured-real-task-reports', input_report: { file: basename(reportPath), sha256: checked.sha256 },
    evidence_commit: process.argv[3], source: { path: 'analysis/publication-fit.mjs', sha256: digestBytes(readFileSync(fileURLToPath(import.meta.url))) },
    runtime_sources: sourceSnapshot(), environment: environment(), replay_valid: replay.valid, rows,
    scope: 'Synthetic placeholder destination and principal. Preparation only: no policy authorization, ledger reservation, model call or provider request. Two representations of each same captured report are related observations, not new tasks.',
    provider_requests: 0, model_requests: 0 });
  console.log(JSON.stringify({ report: artifact.path, sha256: artifact.sha256, rows: rows.length }));
}

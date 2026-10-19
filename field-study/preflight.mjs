import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createJournal, saveArtifact, digestBytes } from './artifacts.mjs';
import { captureProvenance } from './provenance.mjs';
import { credentialReaders } from './credentials.mjs';
import { createAzureModel, inspectModelResponse, modelFailureInfo } from './model-client.mjs';
import { openNativeMcp, NativeMcpError } from './native-mcp.mjs';

if (!process.argv.includes('--real') || !process.argv.some(value => /^--component=(model|mcp)$/.test(value))) {
  throw new Error('Explicit --real --component=model|mcp required; this is not offline replay.');
}
const component = process.argv.find(value => value.startsWith('--component=')).split('=')[1];
const tools = JSON.parse(readFileSync(new URL('./tools.json', import.meta.url)));
const output = fileURLToPath(new URL('../reports/', import.meta.url));
const runId = `field-preflight-${component}-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(3).toString('hex')}`;
const provenance = captureProvenance();
const journal = createJournal(output, runId, { population: 'setup-not-task', component, provenance });
const credentials = credentialReaders();
const started = performance.now();
let status = 'failed', observation, session;
try {
  journal.append({ type: 'setup_start', component });
  if (component === 'model') {
    const config = tools.azure_model;
    const model = createAzureModel({ endpoint: config.endpoint, deployment: config.deployment,
      authProvider: credentials.azure, timeoutMs: config.timeout_ms, maxOutputTokens: 256 });
    const raw = await model.respond([{ role: 'user', content: 'Connectivity preflight only. Reply exactly READY. Do not call any tools.' }], []);
    observation = inspectModelResponse(raw);
    if (observation.stop_reason) throw new Error('preflight_model_stopped');
  } else {
    const pin = tools.github_mcp;
    session = await openNativeMcp({ binary: fileURLToPath(new URL('./.tools/github-mcp-server', import.meta.url)),
      tokenProvider: credentials.github, timeoutMs: 60000,
      pins: { source_commit: pin.source_commit, archive_sha256: pin.archive_sha256, executable_sha256: pin.executable_sha256 } });
    journal.append({ type: 'mcp_inventory', inventory: session.inventory });
    const args = { owner: 'OndCo', repo: 'Action-Effect-Bench', path: 'spec-lock.json', sha: 'cecde389637be4f5fd3482e4942ce3fd1a623ac6' };
    const result = await session.call('get_file_contents', args);
    observation = { inventory: session.inventory, native_call: { name: 'get_file_contents', arguments: args }, result,
      result_sha256: digestBytes(JSON.stringify(result)) };
  }
  journal.append({ type: 'setup_result', status: 'completed', observation });
  status = 'completed';
} catch (error) {
  observation = error instanceof NativeMcpError ? { reason: error.code, outcome: error.outcome } : modelFailureInfo(error);
  journal.append({ type: 'setup_result', status: 'failed', observation });
} finally {
  if (session) {
    try { await session.close(); }
    catch { status = 'failed'; journal.append({ type: 'close_error', reason: 'mcp_close_failed' }); }
  }
}
const duration_ms = performance.now() - started;
const sealed = journal.seal({ status, duration_ms });
const result = saveArtifact(output, 'field-study-preflight', { format: 'field-study-preflight/1', population: 'setup-not-task',
  component, status, duration_ms, configuration: tools, provenance, observation,
  journal: { file: basename(sealed.path), sha256: sealed.sha256 }, provider_write_attempts: 0 });
console.log(JSON.stringify({ component, status, duration_ms, report: result.path, sha256: result.sha256,
  ...(status === 'failed' ? { reason: observation.reason } : {}) }));
if (status !== 'completed') process.exitCode = 1;

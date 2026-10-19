import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, realpathSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cpus, totalmem, release } from 'node:os';

export const benchRoot = fileURLToPath(new URL('../', import.meta.url));
export const specRoot = fileURLToPath(new URL('../../action-effect-spec/', import.meta.url));
export const digestBytes = bytes => createHash('sha256').update(bytes).digest('hex');

function files(root, directory, prefix) {
  const result = [];
  for (const name of readdirSync(directory).sort()) {
    if (['node_modules', '.tools', '.runtime-private', '__pycache__', 'reports', 'tests', '.DS_Store'].includes(name)) continue;
    const path = join(directory, name), stat = statSync(path);
    if (stat.isDirectory()) result.push(...files(root, path, prefix));
    else if (/\.(mjs|py|json|rego|sha256)$/.test(name)) {
      result.push({ path: `${prefix}/${relative(root, path).split(sep).join('/')}`, sha256: digestBytes(readFileSync(path)) });
    }
  }
  return result;
}

export function sourceSnapshot() {
  const spec = ['profiles/github-issue-comment', 'implementations/python/offline_consumer'];
  const out = files(benchRoot, join(benchRoot, 'runtime-pilot'), 'bench');
  for (const dir of spec) out.push(...files(specRoot, join(specRoot, dir), 'spec'));
  for (const path of ['implementations/javascript/strict-json.mjs', 'implementations/javascript/schema.mjs', 'schemas/effect-description.schema.json']) {
    out.push({ path: `spec/${path}`, sha256: digestBytes(readFileSync(join(specRoot, path))) });
  }
  return out.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export function sourcesMatch(snapshot) {
  try {
    return snapshot.every(item => {
      if (!/^(bench|spec)\/[A-Za-z0-9_./-]+$/.test(item.path) || item.path.split('/').includes('..')) return false;
      const [which, ...parts] = item.path.split('/');
      const root = realpathSync(which === 'spec' ? specRoot : benchRoot), path = realpathSync(join(root, ...parts));
      if (!path.startsWith(`${root}${sep}`)) return false;
      return digestBytes(readFileSync(path)) === item.sha256;
    });
  } catch { return false; }
}

export function sourceInventoryUnchanged(snapshot) {
  return sourcesMatch(snapshot) && JSON.stringify(snapshot) === JSON.stringify(sourceSnapshot());
}

function repositoryIdentity(root) {
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 5000 }).trim();
    const changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'],
      { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
    return { head, dirty: changed.length > 0,
      note: 'Exact experiment-source bytes are in provenance.sources; dirty status also includes reports and documentation.' };
  } catch { return { head: null, dirty: null, note: 'Git checkout metadata unavailable; see exact file hashes.' }; }
}

export function environment() {
  let python;
  try { python = execFileSync('python3', ['--version'], { encoding: 'utf8', timeout: 5000 }).trim(); }
  catch { python = 'unavailable'; }
  const dependencies = Object.fromEntries(['@octokit/rest', '@modelcontextprotocol/sdk', 'zod', 'ajv'].map(name => {
    try { return [name, JSON.parse(readFileSync(new URL(`./node_modules/${name}/package.json`, import.meta.url))).version]; }
    catch { return [name, 'unavailable']; }
  }));
  const pin = JSON.parse(readFileSync(new URL('./tools.json', import.meta.url))).opa;
  let binaryHash = null;
  try { binaryHash = digestBytes(readFileSync(new URL('./.tools/opa', import.meta.url))); } catch { /* Report missing tool explicitly. */ }
  const cpu = cpus();
  return { node: process.version, python, platform: process.platform, architecture: process.arch,
    os_release: release(), hardware: { cpu_model: cpu[0]?.model ?? 'unknown', logical_cpus: cpu.length, memory_bytes: totalmem() },
    timezone: 'America/Toronto', measured_timestamps: 'UTC', dependencies,
    repositories: { spec: repositoryIdentity(specRoot), bench: repositoryIdentity(benchRoot) },
    opa_binary: { pinned_version: pin.version, sha256: binaryHash,
      matches_release_pin: binaryHash !== null && binaryHash === pin.assets[`${process.platform}-${process.arch}`]?.sha256 } };
}

export function saveReport(kind, report, outputDir = join(benchRoot, 'reports')) {
  mkdirSync(outputDir, { recursive: true });
  const filename = `${kind}-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(3).toString('hex')}.json`;
  const path = join(outputDir, filename), raw = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(path, raw, { flag: 'wx' });
  writeFileSync(`${path}.sha256`, `${digestBytes(raw)}  ${filename}\n`, { flag: 'wx' });
  return path;
}

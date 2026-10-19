import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { digestBytes } from './artifacts.mjs';
import { sourceSnapshot, sourcesMatch, environment, benchRoot, specRoot } from '../runtime-pilot/artifacts.mjs';

const fieldRoot = fileURLToPath(new URL('./', import.meta.url));
const IGNORED = new Set(['.tools', '.runtime-private', 'tests', 'node_modules', '__pycache__', 'source-lock.json', '.DS_Store']);

export function fieldInventory(root = fieldRoot) {
  const output = [];
  function walk(directory) {
    for (const name of readdirSync(directory).sort()) {
      if (IGNORED.has(name)) continue;
      const path = join(directory, name), stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error('source_symlink');
      if (stat.isDirectory()) walk(path);
      else if (/\.(mjs|py|json|rego|sha256)$/.test(name)) output.push({
        path: `bench/field-study/${relative(root, path).split(sep).join('/')}`,
        sha256: digestBytes(readFileSync(path)),
      });
    }
  }
  walk(root);
  return output;
}

export const sameInventory = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function captureProvenance() {
  return { field_sources: fieldInventory(), preserved_runtime_sources: sourceSnapshot(), environment: environment() };
}

export function verifyProvenance(provenance) {
  return sourcesMatch(provenance.field_sources)
    && sameInventory(provenance.field_sources, fieldInventory())
    && sourcesMatch(provenance.preserved_runtime_sources)
    && sameInventory(provenance.preserved_runtime_sources, sourceSnapshot());
}

const histories = new Map();
const RUNTIME_IGNORED = new Set(['node_modules', '.tools', '.runtime-private', '__pycache__', 'reports', 'tests', '.DS_Store']);
const SOURCE_EXTENSION = /\.(mjs|py|json|rego|sha256)$/;
const fail = code => { throw new Error(code); };

function gitBytes(root, args, maxBuffer = 16 * 1024 * 1024) {
  try {
    return execFileSync('git', ['--no-pager', ...args], { cwd: root, timeout: 10000, maxBuffer,
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1',
        GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' } });
  } catch { fail('source_revision_unavailable'); }
}

function historicalTree(which, revision) {
  if (!['bench', 'spec'].includes(which) || typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) fail('source_revision_invalid');
  const key = `${which}:${revision}`;
  if (histories.has(key)) return histories.get(key);
  const root = which === 'bench' ? benchRoot : specRoot;
  if (gitBytes(root, ['cat-file', '-t', revision]).toString('utf8').trim() !== 'commit') fail('source_revision_invalid');
  const tree = new Map();
  for (const entry of gitBytes(root, ['ls-tree', '-r', '-z', '--full-tree', revision]).toString('utf8').split('\0').filter(Boolean)) {
    const match = /^(\d{6}) (blob|commit) ([a-f0-9]{40})\t(.+)$/.exec(entry);
    if (!match || tree.has(match[4])) fail('source_inventory_invalid');
    tree.set(match[4], { mode: match[1], type: match[2], oid: match[3] });
  }
  const blobs = new Map();
  let totalBytes = 0;
  const history = { tree, read(path) {
    const entry = tree.get(path);
    if (!entry || entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) fail('source_path');
    if (!blobs.has(path)) {
      const bytes = gitBytes(root, ['cat-file', 'blob', entry.oid]);
      totalBytes += bytes.length;
      if (totalBytes > 64 * 1024 * 1024) fail('source_inventory_too_large');
      blobs.set(path, bytes);
    }
    return Buffer.from(blobs.get(path));
  } };
  if (histories.size >= 8) histories.delete(histories.keys().next().value);
  histories.set(key, history);
  return history;
}

export function readCommittedBlob(which, revision, path) {
  if (typeof path !== 'string' || path.length > 1024 || !/^[A-Za-z0-9_./-]+$/.test(path)
    || path.split('/').some(part => !part || part === '.' || part === '..')) fail('source_path');
  return historicalTree(which, revision).read(path);
}

function directoryOrder(left, right) {
  const a = left.path.split('/'), b = right.path.split('/');
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
}

function recordedInventory(which, revision, roots, ignored) {
  const history = historicalTree(which, revision), entries = [];
  for (const [path, entry] of history.tree) {
    if (!roots.some(root => path === root || path.startsWith(`${root}/`)) || path.split('/').some(part => ignored.has(part))) continue;
    if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) fail('source_inventory_invalid');
    if (SOURCE_EXTENSION.test(path)) entries.push({ path: `${which}/${path}`, sha256: digestBytes(history.read(path)) });
  }
  return entries;
}

/** Read verified historical blobs as data. Never check out or execute recorded code. */
export function loadRecordedSources(provenance) {
  const revisions = { bench: provenance?.environment?.repositories?.bench?.head, spec: provenance?.environment?.repositories?.spec?.head };
  for (const name of ['field_sources', 'preserved_runtime_sources']) {
    const entries = provenance?.[name];
    if (!Array.isArray(entries) || !entries.length || entries.length > 1024 || entries.some(entry => !entry
      || Object.keys(entry).sort().join(',') !== 'path,sha256' || typeof entry.path !== 'string'
      || !/^(bench|spec)\/[A-Za-z0-9_./-]+$/.test(entry.path) || entry.path.split('/').some(part => !part || part === '.' || part === '..')
      || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256))) fail('source_inventory_invalid');
  }
  const field = recordedInventory('bench', revisions.bench, ['field-study'], IGNORED).sort(directoryOrder);
  const runtime = [
    ...recordedInventory('bench', revisions.bench, ['runtime-pilot'], RUNTIME_IGNORED),
    ...recordedInventory('spec', revisions.spec, ['profiles/github-issue-comment', 'implementations/python/offline_consumer',
      'implementations/javascript/strict-json.mjs', 'implementations/javascript/schema.mjs', 'schemas/effect-description.schema.json'], RUNTIME_IGNORED),
  ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (!sameInventory(field, provenance.field_sources) || !sameInventory(runtime, provenance.preserved_runtime_sources)) fail('source_inventory_mismatch');
  const permitted = new Set([...field, ...runtime].map(entry => entry.path));
  return Object.freeze({ mode: 'recorded-git', revisions: Object.freeze(revisions), read(path) {
    if (!permitted.has(path)) fail('source_path');
    const [which, ...parts] = path.split('/');
    return readCommittedBlob(which, revisions[which], parts.join('/'));
  } });
}

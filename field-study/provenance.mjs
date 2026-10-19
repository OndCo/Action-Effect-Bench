import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestBytes } from './artifacts.mjs';
import { sourceSnapshot, sourcesMatch, environment } from '../runtime-pilot/artifacts.mjs';

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

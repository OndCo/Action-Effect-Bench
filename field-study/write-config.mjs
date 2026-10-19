import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { digestBytes, assertPublicValue } from './artifacts.mjs';
import { readCommittedBlob, verifyProvenance } from './provenance.mjs';
import { buildWritePlan } from './write-plan.mjs';

const REFERENCES = {
  report: { revision: '7306d8b45402bb2ee7f9a1fbaf7203835e599110',
    path: 'reports/field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json',
    sha256: 'e6d9fe0e27ca93932fb9102cc5d5b7f16e4c7c138cd72c79eeeaaf1cb2961999' },
  review: { revision: '86abb1e0c25238a0bbc22c59d45d06e983527bbf',
    path: 'analysis/review-second-field-use.json',
    sha256: '0f5b7954f549c1e184f5ece621126234f2c1c8034175391b1f1354ef2eca2682' },
};

export function frozenWriteInputs() {
  const result = { references: structuredClone(REFERENCES) };
  for (const [name, item] of Object.entries(REFERENCES)) {
    const bytes = readCommittedBlob('bench', item.revision, item.path);
    if (digestBytes(bytes) !== item.sha256) throw new Error('write_input_hash');
    result[name] = JSON.parse(bytes);
  }
  return result;
}

export function validateWriteManifest(manifest) {
  assertPublicValue(manifest);
  if (manifest?.format !== 'action-effect-owned-write-manifest/1'
    || manifest.provenance?.environment?.opa_binary?.matches_release_pin !== true) throw new Error('write_manifest');
  const environment = manifest.provenance.environment;
  const opa = JSON.parse(readFileSync(new URL('../runtime-pilot/tools.json', import.meta.url))).opa;
  const expectedBinary = opa.assets[`${environment.platform}-${environment.architecture}`]?.sha256;
  if (!expectedBinary || environment.opa_binary.sha256 !== expectedBinary
    || environment.opa_binary.pinned_version !== opa.version) throw new Error('write_opa_recorded_identity');
  const inputs = frozenWriteInputs();
  if (!isDeepStrictEqual(manifest.inputs, inputs.references)
    || !isDeepStrictEqual(manifest.tools, JSON.parse(readFileSync(new URL('./tools.json', import.meta.url))))) {
    throw new Error('write_manifest_source');
  }
  const expected = buildWritePlan({ report: inputs.report, review: inputs.review,
    target: manifest.target, principal: manifest.principal, runId: manifest.run_id });
  if (!isDeepStrictEqual(manifest.plan, expected)) throw new Error('write_manifest_plan');
  return true;
}

export function assertWriteFreshness(manifest) {
  if (!verifyProvenance(manifest.provenance)) throw new Error('write_source_drift');
  const path = fileURLToPath(new URL('../runtime-pilot/.tools/opa', import.meta.url));
  if (realpathSync(path) !== path || digestBytes(readFileSync(path)) !== manifest.provenance.environment.opa_binary.sha256) {
    throw new Error('write_opa_current_identity');
  }
  return true;
}

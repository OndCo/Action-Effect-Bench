import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalBytes, parseStrict } from '../../action-effect-spec/implementations/javascript/strict-json.mjs';

export const profile = Object.freeze(parseStrict(readFileSync(new URL(
  '../../action-effect-spec/profiles/github-issue-comment/profile.json', import.meta.url))));
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const jsonHash = value => sha256(canonicalBytes(value));
export const profileHash = jsonHash(profile);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, required) => object(value) && Object.keys(value).length === required.length
  && required.every(key => Object.hasOwn(value, key));
const scalar = value => typeof value === 'string' && value.length > 0
  && [...value].every(character => character.codePointAt(0) < 0xd800 || character.codePointAt(0) > 0xdfff);
const outcome = (status, reason) => ({ status, reason, authority: 'not_evaluated' });
const binding = (field, value) => ({ reference: `urn:action-effect:github-comment:${field}`,
  digest: { algorithm: 'sha-256', value: jsonHash(value) } });

export function nativeParameters(native) {
  if (!keys(native, ['lane', 'call']) || !['sdk', 'mcp'].includes(native.lane)) {
    return { error: outcome('invalid_input', 'native_input') };
  }
  let params = native.call;
  if (native.lane === 'mcp') {
    if (!keys(params, ['name', 'arguments']) || !scalar(params.name) || !object(params.arguments)) {
      return { error: outcome('invalid_input', 'native_input') };
    }
    if (params.name !== 'add_issue_comment') return { error: outcome('unsupported_profile', 'operation') };
    params = params.arguments;
  }
  if (!keys(params, ['owner', 'repo', 'issue_number', 'body'])
    || typeof params.owner !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(params.owner)
    || typeof params.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(params.repo)
    || ['.', '..'].includes(params.repo) || !Number.isSafeInteger(params.issue_number)
    || params.issue_number < 1 || params.issue_number > profile.maximum_issue_number
    || !scalar(params.body) || Buffer.byteLength(params.body) > profile.maximum_body_bytes) {
    return { error: outcome('invalid_input', 'native_input') };
  }
  return { params };
}

function project(params, context) {
  const repository = `${params.owner}/${params.repo}`;
  return { operation: profile.operation, repository, issue_number: params.issue_number,
    endpoint: `https://api.github.com/repos/${repository}/issues/${params.issue_number}/comments`,
    body_sha256: sha256(Buffer.from(params.body, 'utf8')), body_bytes: Buffer.byteLength(params.body),
    data_class: context.data_class };
}

function describe(native, context, projection) {
  const implementation = { id: profile.implementation, kind: 'declaration' };
  const declaration = { native, context, profile_digest: profileHash };
  const known = (namespace, value) => ({ state: 'known', namespace, value });
  return {
    spec_version: profile.core_spec, profile: profile.id,
    profile_digest: { algorithm: 'sha-256', value: profileHash },
    record_id: `urn:action-effect:github-comment:record:${jsonHash({ native, context })}`,
    invocation: binding('invocation', native), implementation: binding('implementation', implementation),
    mapping: { id: `${profile.id}#mapping`, revision: profile.mapping_revision,
      digest: { algorithm: 'sha-256', value: profileHash } },
    context: binding('context', context),
    coverage: { scope: 'direct', completeness: 'partial',
      assumptions: ['Declared direct GitHub comment only; provider descendants not bounded'], evidence_refs: ['declaration'] },
    effects: [{ effect_id: 'comment', category: profile.category, operation: profile.operation_uri,
      resource: known(profile.resource_namespace, `${projection.repository}#${projection.issue_number}`),
      destination: known(profile.destination_namespace, projection.endpoint),
      data_class: known(profile.data_namespace, projection.data_class),
      quantities: [{ name: profile.byte_quantity, value: String(projection.body_bytes), unit: 'byte', scale: '0' }],
      modality: 'may', evidence_refs: ['declaration'] }],
    evidence: [{ evidence_id: 'declaration', kind: 'declaration', source: profile.id,
      artifact_ref: 'urn:action-effect:github-comment:declaration',
      artifact_digest: { algorithm: 'sha-256', value: jsonHash(declaration) }, scope: 'direct-request-declaration' }],
    unknowns: [{ code: 'unobserved_descendants', scope: profile.unknown_scope }], relations: [],
    critical_extensions: [profile.body_digest_extension], extensions: { [profile.body_digest_extension]: projection.body_sha256 }
  };
}

export function mapNative(native, context) {
  const { params, error } = nativeParameters(native);
  if (error) return error;
  if (!object(context) || !scalar(context.principal) || !scalar(context.data_class) || !scalar(context.implementation)) {
    return outcome('untrusted_evidence', 'missing_context');
  }
  if (context.implementation !== profile.implementation) return outcome('untrusted_evidence', 'implementation_binding');
  try {
    const projection = project(params, context);
    const description = describe(native, context, projection);
    return { ...outcome('accepted_partial', 'declared_partial'), projection, description,
      description_digest: jsonHash(description) };
  } catch {
    return outcome('invalid_input', 'native_input');
  }
}

export function makeDescription(native, context) {
  const result = mapNative(native, context);
  if (result.status !== 'accepted_partial') throw new Error(`${result.status}/${result.reason}`);
  return result.description;
}

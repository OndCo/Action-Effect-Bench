import { spawnSync } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const runtimeDir = dirname(realpathSync(fileURLToPath(import.meta.url)));
const policyPath = join(runtimeDir, 'policy.rego');
const defaultOpaPath = join(runtimeDir, '.tools', 'opa');
const QUERY = 'data.action_effect.decision';
const TIMEOUT_MS = 2_000;
const MAX_OUTPUT_BYTES = 65_536;
const MAX_INPUT_BYTES = 256 * 1024;
const policyKeys = ['revision', 'principal', 'revoked', 'allow_partial_direct', 'max_body_bytes', 'grants'];
const projectionKeys = ['operation', 'repository', 'issue_number', 'endpoint', 'body_sha256', 'body_bytes', 'data_class'];
const grantKeys = ['repository', 'issue_number', 'data_class'];
const validReasons = {
  allow: ['authorized'],
  deny: ['revoked', 'principal_mismatch', 'no_matching_grant', 'body_too_large'],
  review: ['partial_scope'],
  evaluation_failure: ['invalid_policy', 'missing_projection', 'invalid_projection', 'missing_context', 'invalid_context'],
};

function record(value) {
  return value !== null && typeof value === 'object'
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function exactFields(value, keys) {
  if (!record(value) || Reflect.ownKeys(value).length !== keys.length) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return keys.every((key) => Object.hasOwn(descriptors, key)
    && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable);
}

const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const fullMatch = (value, pattern) => typeof value === 'string' && pattern.exec(value)?.[0] === value;
const principal = (value) => fullMatch(value, /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,127}$/);
const revision = (value) => fullMatch(value, /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
const dataClass = (value) => typeof value === 'string' && value.length > 0;
const repository = (value) => fullMatch(value, /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/)
  && !['.', '..'].includes(value.split('/')[1]);

function validGrants(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 1024) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return false;
    const grant = descriptor.value;
    if (!exactFields(grant, grantKeys) || !repository(grant.repository)
      || !positiveInteger(grant.issue_number) || !dataClass(grant.data_class)) return false;
  }
  return true;
}

function validPolicy(value) {
  return exactFields(value, policyKeys) && revision(value.revision) && principal(value.principal)
    && typeof value.revoked === 'boolean' && typeof value.allow_partial_direct === 'boolean'
    && positiveInteger(value.max_body_bytes) && validGrants(value.grants);
}

function validProjection(value) {
  return exactFields(value, projectionKeys) && value.operation === 'create_issue_comment'
    && repository(value.repository) && positiveInteger(value.issue_number)
    && value.endpoint === `https://api.github.com/repos/${value.repository}/issues/${value.issue_number}/comments`
    && fullMatch(value.body_sha256, /^[a-fA-F0-9]{64}$/)
    && positiveInteger(value.body_bytes) && dataClass(value.data_class);
}

function validContext(value) {
  if (!record(value)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, 'principal');
  return descriptor && Object.hasOwn(descriptor, 'value') && principal(descriptor.value);
}

function configuredExecutable(options) {
  if (!record(options) || Reflect.ownKeys(options).some((key) => key !== 'opaPath')) return undefined;
  if (!Object.hasOwn(options, 'opaPath')) return defaultOpaPath;
  const descriptor = Object.getOwnPropertyDescriptor(options, 'opaPath');
  const path = descriptor?.value;
  return typeof path === 'string' && isAbsolute(path) && !path.includes('\0') ? path : undefined;
}

function executableAvailable(path) {
  try {
    const stat = lstatSync(path);
    // Reject symlinks in the complete path, including a replaced .tools directory.
    return stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o111) !== 0 && realpathSync(path) === path;
  } catch { return false; }
}

function parseDecision(stdout) {
  let output;
  try { output = JSON.parse(stdout); } catch { return { decision: 'evaluation_failure', reason: 'malformed_opa_output' }; }
  const failure = (reason) => ({ decision: 'evaluation_failure', reason });
  if (!record(output)) return failure('malformed_opa_output');
  if (Object.hasOwn(output, 'errors')) return failure('opa_error');
  if (!Object.hasOwn(output, 'result') || (Array.isArray(output.result) && output.result.length === 0)) return failure('undefined_decision');
  if (!Array.isArray(output.result) || output.result.length !== 1) return failure('malformed_opa_output');
  const expressions = output.result[0]?.expressions;
  if (Array.isArray(expressions) && expressions.length === 0) return failure('undefined_decision');
  if (!Array.isArray(expressions) || expressions.length !== 1) return failure('malformed_opa_output');
  const value = expressions[0]?.value;
  if (!exactFields(value, ['decision', 'reason']) || typeof value.decision !== 'string'
    || !Object.hasOwn(validReasons, value.decision)
    || !validReasons[value.decision].includes(value.reason)) return failure('malformed_opa_output');
  return { decision: value.decision, reason: value.reason };
}

// The caller supplies trusted principal/policy state. options is local test/config
// control, never part of a request. This module neither bootstraps nor dispatches.
export function authorize(projection, context, policy, options = {}) {
  const started = performance.now();
  let policyRevision;
  const finish = (decision, reason) => ({
    decision, reason,
    ...(policyRevision === undefined ? {} : { policy_revision: policyRevision }),
    duration_ms: performance.now() - started,
  });
  const failure = (reason) => finish('evaluation_failure', reason);
  let phase = 'invalid_policy';
  try {
    if (!validPolicy(policy)) return failure('invalid_policy');
    policyRevision = policy.revision;
    phase = 'invalid_projection';
    if (projection === undefined || projection === null) return failure('missing_projection');
    if (!validProjection(projection)) return failure('invalid_projection');
    phase = 'invalid_context';
    if (context === undefined || context === null) return failure('missing_context');
    if (!validContext(context)) return failure('invalid_context');
    phase = 'invalid_options';
    const opaPath = configuredExecutable(options);
    if (!opaPath) return failure('invalid_options');

    // Explicit reconstruction drops tokens, unused context and serialization hooks.
    phase = 'invalid_policy';
    const input = JSON.stringify({
      projection: Object.fromEntries(projectionKeys.map((key) => [key, projection[key]])),
      context: { principal: context.principal },
      policy: {
        revision: policy.revision, principal: policy.principal, revoked: policy.revoked,
        allow_partial_direct: policy.allow_partial_direct, max_body_bytes: policy.max_body_bytes,
        grants: Array.from(policy.grants, (grant) => Object.fromEntries(grantKeys.map((key) => [key, grant[key]]))),
      },
    });
    if (Buffer.byteLength(input, 'utf8') > MAX_INPUT_BYTES) return failure('invalid_policy');
    if (!executableAvailable(opaPath)) return failure('opa_unavailable');
    phase = 'opa_error';
    const result = spawnSync(opaPath, ['eval', '--stdin-input', '--data', policyPath, '--format=json', QUERY], {
      input, encoding: 'utf8', shell: false, timeout: TIMEOUT_MS, killSignal: 'SIGKILL',
      maxBuffer: MAX_OUTPUT_BYTES, cwd: runtimeDir, env: { LANG: 'C', LC_ALL: 'C' },
    });
    if (result.error?.code === 'ETIMEDOUT') return failure('opa_timeout');
    if (result.error?.code === 'ENOBUFS') return failure('opa_output_limit');
    if (['ENOENT', 'EACCES', 'ENOEXEC'].includes(result.error?.code)) return failure('opa_unavailable');
    if (result.error || result.signal || result.status !== 0) return failure('opa_error');
    const value = parseDecision(result.stdout);
    return finish(value.decision, value.reason);
  } catch {
    return failure(phase);
  }
}

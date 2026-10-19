import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { canonicalBytes, parseStrict } from '../../action-effect-spec/implementations/javascript/strict-json.mjs';
import { mapNative, jsonHash, nativeParameters } from './mapping.mjs';
import { callConsumer } from './consumer-client.mjs';
import { authorize } from './authorization.mjs';
import { reserve, transition, load } from './ledger.mjs';
import { receiptFrom } from './provider.mjs';

function freezeJson(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function snapshotOptions(options) {
  const provider = options.provider;
  const methods = {};
  for (const name of ['principal', 'createComment', 'readComment', 'listComments']) {
    if (typeof provider?.[name] !== 'function') throw new Error('invalid_provider');
    methods[name] = provider[name].bind(provider);
  }
  const snapshot = { native: freezeJson(parseStrict(canonicalBytes(options.native))),
    context: freezeJson(parseStrict(canonicalBytes(options.context))),
    strategy: options.strategy, policyFile: options.policyFile, ledgerDir: options.ledgerDir,
    occurrence: options.occurrence, provider: Object.freeze(methods),
    preparedDescription: options.preparedDescription === undefined ? undefined
      : freezeJson(parseStrict(canonicalBytes(options.preparedDescription))) };
  if (['policyFile', 'ledgerDir', 'occurrence'].some(key => typeof snapshot[key] !== 'string')) {
    throw new Error('invalid_configuration');
  }
  return Object.freeze(snapshot);
}

function commentIds(rows) {
  if (!Array.isArray(rows) || rows.length > 500) throw new Error('invalid_preflight');
  const ids = rows.map(row => row?.id);
  if (ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
    throw new Error('invalid_preflight');
  }
  return ids;
}

export function prepareAction(native, context, strategy = 'protocol', preparedDescription) {
  const started = performance.now();
  if (strategy === 'structured') {
    const checked = callConsumer({ op: 'project', native, context });
    return { ...checked, mapping_ms: performance.now() - started };
  }
  if (strategy !== 'protocol') return { status: 'evaluation_failure', reason: 'unknown_strategy', authority: 'not_evaluated' };
  const mapped = mapNative(native, context);
  if (mapped.status !== 'accepted_partial') return { ...mapped, mapping_ms: performance.now() - started };
  const description = preparedDescription ?? mapped.description;
  const checked = callConsumer({ op: 'check', native, context, description });
  return { ...checked, description, mapping_ms: performance.now() - started };
}

export async function executeAction(options) {
  const started = performance.now(), timings = {};
  const finish = result => ({ ...result, timings: { ...timings, total_ms: performance.now() - started } });
  let native, context, prepared;
  try {
    options = snapshotOptions(options);
    ({ native, context } = options);
    prepared = prepareAction(native, context, options.strategy, options.preparedDescription);
  } catch { return finish({ outcome: 'withheld', reason: 'invalid_configuration', authorization: { decision: 'not_evaluated' } }); }
  timings.mapping_ms = prepared.mapping_ms ?? 0;
  timings.consumer_ms = prepared.consumer_ms ?? 0;
  if (prepared.status !== 'accepted_partial') {
    return finish({ outcome: 'withheld', reason: 'mapping_not_accepted', mapping: prepared, authorization: { decision: 'not_evaluated' } });
  }
  const { params } = nativeParameters(native);
  const binding = jsonHash({ native, context });
  let reserved;
  const ledgerStarted = performance.now();
  try { reserved = reserve(options.ledgerDir, options.occurrence, binding); }
  catch { return finish({ outcome: 'withheld', reason: 'ledger_failure', mapping: prepared, authorization: { decision: 'evaluation_failure' } }); }
  timings.ledger_ms = performance.now() - ledgerStarted;
  if (!reserved.reserved) return finish({ outcome: 'duplicate_suppressed', reason: reserved.reason, state: reserved.state,
    mapping: prepared, authorization: { decision: 'not_evaluated' } });

  const withhold = (reason, authorization) => {
    try { transition(options.ledgerDir, options.occurrence, 'reserved', 'withheld', { reason }); }
    catch { reason = 'ledger_failure'; }
    return finish({ outcome: 'withheld', reason, mapping: prepared, authorization });
  };
  const principalStarted = performance.now();
  try {
    const principal = await options.provider.principal();
    timings.principal_ms = performance.now() - principalStarted;
    if (principal !== context.principal) return withhold('provider_principal_mismatch', { decision: 'evaluation_failure' });
  } catch { return withhold('provider_identity_unavailable', { decision: 'evaluation_failure' }); }

  let preflightIds;
  const preflightStarted = performance.now();
  try {
    const comments = await options.provider.listComments(params);
    preflightIds = commentIds(comments);
    if (comments.some(comment => receiptFrom(comment, params, context.principal).content_matches)) {
      return withhold('preexisting_matching_content', { decision: 'not_evaluated' });
    }
    timings.preflight_ms = performance.now() - preflightStarted;
  } catch { return withhold('provider_preflight_unavailable', { decision: 'evaluation_failure' }); }

  let policy;
  try { policy = parseStrict(readFileSync(options.policyFile)); }
  catch { return withhold('policy_unavailable', { decision: 'evaluation_failure' }); }
  // Load current authority after all preparation and read-only identity checks.
  const authorization = authorize(prepared.projection, context, policy);
  timings.authority_ms = authorization.duration_ms ?? 0;
  if (authorization.decision !== 'allow') return withhold(authorization.reason, authorization);
  try { transition(options.ledgerDir, options.occurrence, 'reserved', 'inflight',
    { pre_dispatch_comment_ids: preflightIds }); }
  catch { return withhold('ledger_failure', { decision: 'evaluation_failure' }); }

  let commentId;
  const dispatchStarted = performance.now();
  try {
    const response = await options.provider.createComment(params);
    timings.dispatch_ms = performance.now() - dispatchStarted;
    if (!Number.isSafeInteger(response?.id) || response.id < 1) throw new Error('invalid_provider_response');
    commentId = response.id;
    const readbackStarted = performance.now();
    const observed = await options.provider.readComment(params, commentId);
    timings.readback_ms = performance.now() - readbackStarted;
    const receipt = receiptFrom(observed, params, context.principal, commentId);
    if (!receipt.content_matches) {
      transition(options.ledgerDir, options.occurrence, 'inflight', 'unknown', { reason: 'readback_mismatch', comment_id: commentId });
      return finish({ outcome: 'unknown', reason: 'readback_mismatch', mapping: prepared, authorization, receipt });
    }
    transition(options.ledgerDir, options.occurrence, 'inflight', 'confirmed',
      { comment_id: commentId, content_sha256: receipt.body_sha256 });
    return finish({ outcome: 'confirmed', mapping: prepared, authorization, receipt });
  } catch {
    timings.dispatch_ms ??= performance.now() - dispatchStarted;
    const metadata = { reason: 'provider_or_readback_failure', ...(commentId ? { comment_id: commentId } : {}) };
    try { transition(options.ledgerDir, options.occurrence, 'inflight', 'unknown', metadata); } catch { /* Never retry a possible POST. */ }
    return finish({ outcome: 'unknown', reason: metadata.reason, mapping: prepared, authorization });
  }
}

export async function reconcileAction(options) {
  const started = performance.now();
  const finish = result => ({ ...result, duration_ms: performance.now() - started, automatic_resend: false });
  try {
    options = snapshotOptions(options);
    const prepared = prepareAction(options.native, options.context, options.strategy);
    if (prepared.status !== 'accepted_partial') return finish({ outcome: 'unknown', reason: 'mapping_not_accepted' });
    const current = load(options.ledgerDir, options.occurrence);
    if (current.binding !== jsonHash({ native: options.native, context: options.context })) {
      return finish({ outcome: 'unknown', reason: 'binding_mismatch' });
    }
    if (!['inflight', 'unknown'].includes(current.state)) return finish({ outcome: current.state, reason: 'no_reconciliation_needed' });
    const { params } = nativeParameters(options.native);
    if (!current.comment_id && !Array.isArray(current.pre_dispatch_comment_ids)) {
      return finish({ outcome: 'unknown', reason: 'missing_occurrence_preflight' });
    }
    const rows = current.comment_id
      ? [await options.provider.readComment(params, current.comment_id)] : await options.provider.listComments(params);
    commentIds(rows);
    const matches = rows.filter(row => current.comment_id || !current.pre_dispatch_comment_ids.includes(row.id))
      .map(row => receiptFrom(row, params, options.context.principal, current.comment_id)).filter(row => row.content_matches);
    if (matches.length !== 1) return finish({ outcome: 'unknown', reason: 'no_unique_readback' });
    transition(options.ledgerDir, options.occurrence, current.state, 'confirmed',
      { comment_id: matches[0].comment_id, content_sha256: matches[0].body_sha256 });
    return finish({ outcome: 'confirmed', receipt: matches[0], recovery_evidence: current.comment_id
      ? 'known-response-id-and-current-content' : 'new-current-content-since-preflight-not-execution-attribution' });
  } catch { return finish({ outcome: 'unknown', reason: 'reconciliation_failure' }); }
}

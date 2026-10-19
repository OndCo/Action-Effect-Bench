import Ajv2020 from '../runtime-pilot/node_modules/ajv/dist/2020.js';

const ajv = new Ajv2020({ strict: true, ownProperties: true, addUsedSchema: false, coerceTypes: false, removeAdditional: false, useDefaults: false });
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.length > 0;
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const pick = (value, keys) => Object.fromEntries(keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));
const modelCodes = new Set(['invalid_model_input', 'model_auth_error', 'model_auth_invalid', 'model_timeout', 'model_transport_error', 'model_http_error', 'model_response_invalid', 'model_incomplete', 'model_failed', 'model_cancelled', 'model_unfinished', 'safety_stop', 'misalignment_enforcement']);
const failures = new WeakMap();
function fault(code, metadata = {}) {
  const error = Object.assign(new Error(code), { code, ...metadata });
  failures.set(error, { reason: code, ...metadata });
  return error;
}
function check(condition, code) { if (!condition) throw fault(code); }

// Shared boundary helpers also protect the loop when its model is an injected fixture.
export function copyJSON(value, code = 'model_response_invalid') {
  const ancestors = new Set();
  function visit(item, depth) {
    check(depth <= 100, code);
    if (item === null || ['string', 'boolean'].includes(typeof item)) return;
    if (typeof item === 'number') { check(Number.isFinite(item), code); return; }
    check(typeof item === 'object' && (Array.isArray(item) || [Object.prototype, null].includes(Object.getPrototypeOf(item))), code);
    check(!ancestors.has(item), code);
    ancestors.add(item);
    const keys = Reflect.ownKeys(item);
    if (Array.isArray(item)) check(keys.length === item.length + 1, code);
    for (const key of keys) {
      if (Array.isArray(item) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      check(typeof key === 'string' && descriptor.enumerable && Object.hasOwn(descriptor, 'value'), code);
      if (Array.isArray(item)) check(/^(0|[1-9]\d*)$/.test(key) && Number(key) < item.length, code);
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(item);
  }
  visit(value, 0);
  check(Buffer.byteLength(JSON.stringify(value), 'utf8') <= 16 * 1024 * 1024, code);
  return structuredClone(value);
}

export function parseJSON(textValue, code) {
  try {
    check(typeof textValue === 'string' && Buffer.byteLength(textValue, 'utf8') <= 16 * 1024 * 1024, code);
    const parsed = JSON.parse(textValue), containers = [];
    let lastString;
    // Inspect original tokens: JSON.parse alone silently discards duplicate names.
    for (const [token] of textValue.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:]/g)) {
      if (token === '{' || token === '[') {
        check(containers.length <= 100, code);
        containers.push(token === '{' ? new Set() : null);
      } else if (token === '}' || token === ']') containers.pop();
      else if (token === ':') {
        const names = containers.at(-1), name = JSON.parse(lastString);
        check(!names.has(name), code);
        names.add(name);
      } else lastString = token;
    }
    return copyJSON(parsed, code);
  } catch { throw fault(code); }
}

export function compileFunction(schema, code) {
  try {
    const declaration = copyJSON(schema, code);
    check(object(declaration) && Object.keys(declaration).every((key) => ['type', 'name', 'description', 'parameters', 'strict'].includes(key)), code);
    check(declaration.type === 'function' && typeof declaration.name === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(declaration.name), code);
    check(declaration.description === undefined || typeof declaration.description === 'string', code);
    check(declaration.strict === undefined || typeof declaration.strict === 'boolean', code);
    check(object(declaration.parameters) && declaration.parameters.type === 'object', code);
    const validate = ajv.compile(declaration.parameters);
    check(!validate.$async, code);
    return { schema: declaration, validate };
  } catch { throw fault(code); }
}

function checkedUsage(value) {
  if (value === null) return null;
  check(object(value) && ['input_tokens', 'output_tokens', 'total_tokens'].every((key) => integer(value[key])), 'model_response_invalid');
  check(Object.keys(value).every((key) => ['input_tokens', 'output_tokens', 'total_tokens', 'input_tokens_details', 'output_tokens_details'].includes(key)), 'model_response_invalid');
  for (const key of ['input_tokens_details', 'output_tokens_details']) {
    if (value[key] === undefined || value[key] === null) continue;
    check(object(value[key]) && Object.entries(value[key]).every(([name, count]) => /^[a-z_]+_tokens$/.test(name) && integer(count)), 'model_response_invalid');
  }
  return value;
}

export function inspectModelResponse(value) {
  const result = copyJSON(value), visible = [];
  check(object(result) && text(result.model) && text(result.response_id) && typeof result.duration_ms === 'number' && Number.isFinite(result.duration_ms) && result.duration_ms >= 0, 'model_response_invalid');
  const reasons = { completed: null, incomplete: 'model_incomplete', failed: 'model_failed', cancelled: 'model_cancelled', queued: 'model_unfinished', in_progress: 'model_unfinished' };
  check(typeof result.status === 'string' && Object.hasOwn(reasons, result.status) && Array.isArray(result.output), 'model_response_invalid');
  let stopReason = reasons[result.status];
  for (const item of result.output) {
    check(object(item), 'model_response_invalid');
    check(item.id === undefined || text(item.id), 'model_response_invalid');
    if (item.status !== undefined && item.status !== 'completed') {
      check(['in_progress', 'incomplete'].includes(item.status), 'model_response_invalid');
      stopReason ??= 'model_incomplete';
    }
    if (item.type === 'reasoning') {
      check(item.encrypted_content === undefined || item.encrypted_content === null || typeof item.encrypted_content === 'string', 'model_response_invalid');
      continue;
    }
    if (item.type === 'function_call') {
      check(text(item.name) && typeof item.call_id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(item.call_id) && typeof item.arguments === 'string', 'model_response_invalid');
      visible.push(pick(item, ['type', 'id', 'status', 'name', 'call_id', 'arguments']));
    } else {
      check(item.type === 'message' && item.role === 'assistant' && Array.isArray(item.content), 'model_response_invalid');
      const content = item.content.map((part) => {
        check(object(part), 'model_response_invalid');
        if (part.type === 'refusal') {
          check(typeof part.refusal === 'string', 'model_response_invalid');
          stopReason = 'safety_stop';
          return { type: 'refusal', refusal: part.refusal };
        }
        check(part.type === 'output_text' && typeof part.text === 'string', 'model_response_invalid');
        return pick(part, ['type', 'text', 'annotations', 'logprobs']);
      });
      visible.push({ ...pick(item, ['type', 'id', 'status', 'role']), content });
    }
  }
  return { response_id: result.response_id, model: result.model, status: result.status, usage: checkedUsage(result.usage), duration_ms: result.duration_ms, output: visible, stop_reason: stopReason };
}

export function modelFailureInfo(error) {
  if (error && failures.has(error)) return copyJSON(failures.get(error));
  const code = object(error) ? Object.getOwnPropertyDescriptor(error, 'code')?.value : undefined;
  return { reason: modelCodes.has(code) ? code : 'model_error' };
}

function safetyReason(body, depth = 0) {
  if (!object(body) || depth > 5) return null;
  for (const key of ['code', 'reason', 'type']) {
    if (typeof body[key] !== 'string') continue;
    const value = body[key].toLowerCase();
    if (value === 'misalignment_enforcement') return 'misalignment_enforcement';
    if (['content_filter', 'content_policy_violation', 'safety_violation', 'responsibleaipolicyviolation', 'safety_stop', 'safety_identifier_suspended'].includes(value)) return 'safety_stop';
  }
  for (const key of ['error', 'innererror', 'inner_error', 'incomplete_details']) {
    const reason = safetyReason(body[key], depth + 1);
    if (reason) return reason;
  }
  return null;
}

/** RAW output, including encrypted reasoning, is for in-memory continuation only. */
export function createAzureModel({ endpoint, deployment, authProvider, fetchImpl = globalThis.fetch, timeoutMs, maxOutputTokens, reportSchema } = {}) {
  let target, report, validateReport;
  try {
    check(text(endpoint) && !/[\s\\?#]/.test(endpoint), 'invalid_model_configuration');
    target = new URL(endpoint);
    check(target.protocol === 'https:' && !target.username && !target.password && !target.port && target.pathname === '/openai/v1/responses', 'invalid_model_configuration');
    check(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:openai\.azure\.com|services\.ai\.azure\.com)$/.test(target.hostname) && target.href === endpoint, 'invalid_model_configuration');
    check(typeof deployment === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(deployment) && typeof authProvider === 'function' && typeof fetchImpl === 'function', 'invalid_model_configuration');
    check(integer(timeoutMs) && timeoutMs > 0 && timeoutMs <= 2147483647 && integer(maxOutputTokens) && maxOutputTokens > 0, 'invalid_model_configuration');
    if (reportSchema !== undefined) {
      report = copyJSON(reportSchema, 'invalid_model_configuration');
      validateReport = ajv.compile(report);
      check(!validateReport.$async, 'invalid_model_configuration');
    }
  } catch { throw fault('invalid_model_configuration'); }

  return { async respond(input, toolSchemas) {
    const started = performance.now();
    const fail = (code, extra = {}) => fault(code, { duration_ms: performance.now() - started, ...extra });
    const payload = copyJSON(input, 'invalid_model_input');
    check(Array.isArray(payload) && Array.isArray(toolSchemas), 'invalid_model_input');
    const tools = toolSchemas.map((schema) => compileFunction(schema, 'invalid_model_input').schema);
    check(new Set(tools.map((tool) => tool.name)).size === tools.length, 'invalid_model_input');
    const body = JSON.stringify({ model: deployment, input: payload, tools, store: false, include: ['reasoning.encrypted_content'], reasoning: { effort: 'low' }, max_output_tokens: maxOutputTokens, parallel_tool_calls: false, stream: false, background: false,
      ...(report === undefined ? {} : { text: { format: { type: 'json_schema', name: 'field_report', strict: true, schema: report } } }) });
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(fail('model_timeout')); }, timeoutMs); });
    const request = async () => {
      let auth;
      try { auth = await authProvider(); } catch { throw fail('model_auth_error'); }
      if (controller.signal.aborted) throw fail('model_timeout');
      try {
        auth = copyJSON(auth, 'model_auth_invalid');
        if (!object(auth) || Object.keys(auth).length !== 2 || !['bearer', 'api-key'].includes(auth.kind) || typeof auth.value !== 'string' || !/^[\x21-\x7e]+$/.test(auth.value)) throw new Error();
      } catch { throw fail('model_auth_invalid'); }
      const headers = { 'Content-Type': 'application/json', ...(auth.kind === 'bearer' ? { Authorization: `Bearer ${auth.value}` } : { 'api-key': auth.value }) };
      auth = undefined;
      let response;
      try { response = await fetchImpl(target.href, { method: 'POST', headers, body, signal: controller.signal, redirect: 'error', credentials: 'omit' }); }
      catch { throw fail(controller.signal.aborted ? 'model_timeout' : 'model_transport_error'); }
      if (controller.signal.aborted) throw fail('model_timeout');
      if (!object(response) || !Number.isInteger(response.status) || response.status < 100 || response.status > 599 || response.redirected || (response.url && response.url !== target.href) || typeof response.json !== 'function') throw fail('model_response_invalid');
      let data;
      try { data = await response.json(); }
      catch { throw fail(response.status >= 200 && response.status < 300 ? 'model_response_invalid' : 'model_http_error', { http_status: response.status }); }
      if (controller.signal.aborted) throw fail('model_timeout');
      const stop = safetyReason(data);
      if (response.status < 200 || response.status >= 300) throw fail(stop ?? 'model_http_error', { http_status: response.status });
      let normalized, observation;
      try {
        check(object(data) && data.object === 'response', 'model_response_invalid');
        normalized = copyJSON({ output: data.output, model: data.model, usage: data.usage ?? null, response_id: data.id, status: data.status, duration_ms: performance.now() - started });
        observation = inspectModelResponse(normalized);
      } catch { throw fail(stop ?? 'model_response_invalid'); }
      if (stop || observation.stop_reason || data.error) throw fail(stop ?? observation.stop_reason ?? 'model_failed', { observation });
      if (validateReport && !observation.output.some((item) => item.type === 'function_call')) {
        try {
          const finalText = observation.output.flatMap((item) => item.type === 'message' ? item.content.map((part) => part.text) : []).join('');
          check(validateReport(parseJSON(finalText, 'model_response_invalid')), 'model_response_invalid');
        } catch { throw fail('model_response_invalid', { observation }); }
      }
      return normalized;
    };
    try { return await Promise.race([request(), timeout]); }
    catch (error) {
      if (error && failures.has(error)) throw error;
      throw fail('model_response_invalid');
    }
    finally { clearTimeout(timer); }
  } };
}

import { scalarString } from '../../action-effect-spec/implementations/javascript/strict-json.mjs';
import { assertPublicValue, digestBytes } from './artifacts.mjs';
import { decodeCommentResult, NativeMcpError } from './native-mcp.mjs';

const TARGET_FIELDS = ['owner', 'repo', 'issue_number'];
const CREATE_FIELDS = [...TARGET_FIELDS, 'body'];
const MAX_BODY_BYTES = 8192;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MCP_CODES = new Set(['mcp_timeout', 'mcp_transport_error', 'mcp_tool_error', 'mcp_invalid_result',
  'mcp_invalid_comment_result', 'mcp_closed', 'mcp_read_only', 'mcp_tool_not_selected',
  'mcp_invalid_arguments', 'mcp_mutation_unknown', 'mcp_mutation_in_flight']);

class FieldWriteError extends Error {
  constructor(code, outcome = 'not_dispatched') {
    super(code);
    this.name = 'FieldWriteError';
    this.code = code;
    this.outcome = outcome;
  }
}
function check(condition, code, outcome) { if (!condition) throw new FieldWriteError(code, outcome); }
function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Reflect.ownKeys(value).every(key => typeof key === 'string'
      && Object.getOwnPropertyDescriptor(value, key).enumerable
      && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}
function fields(value, allowed, required = allowed) {
  return plain(value) && Object.keys(value).every(key => allowed.includes(key))
    && required.every(key => Object.hasOwn(value, key));
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function jsonData(value, depth = 0) {
  check(depth <= 64, 'native_invalid_response');
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
  if (typeof value === 'string') { check(scalarString(value), 'native_invalid_response'); return; }
  if (Array.isArray(value)) {
    check(Reflect.ownKeys(value).length === value.length + 1, 'native_invalid_response');
    for (let i = 0; i < value.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      check(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'), 'native_invalid_response');
      jsonData(descriptor.value, depth + 1);
    }
    return;
  }
  check(plain(value), 'native_invalid_response');
  Object.values(value).forEach(child => jsonData(child, depth + 1));
}
function snapshot(value, code, outcome = 'not_dispatched') {
  try {
    jsonData(value);
    assertPublicValue(value);
    const text = JSON.stringify(value);
    check(Buffer.byteLength(text) <= MAX_RESPONSE_BYTES, code, outcome);
    return freeze(JSON.parse(text));
  } catch { throw new FieldWriteError(code, outcome); }
}
const hashJson = value => digestBytes(JSON.stringify(value));
const validId = id => Number.isSafeInteger(id) && id > 0;
const validBody = body => scalarString(body) && body.length > 0 && Buffer.byteLength(body) <= MAX_BODY_BYTES;
function nativeError(error, fallback, outcome) {
  if (error instanceof FieldWriteError) return error;
  const code = error instanceof NativeMcpError ? Object.getOwnPropertyDescriptor(error, 'code')?.value : undefined;
  return new FieldWriteError(MCP_CODES.has(code) ? code : fallback, outcome);
}

/**
 * One provider owns one attempted write. Observations always use the SDK.
 * record must resolve only after durable append; rejection is permanently failstop.
 */
export function createFieldWriteProvider(options) {
  check(fields(options, ['lane', 'target', 'sdkProvider', 'session', 'record'],
    ['lane', 'target', 'sdkProvider', 'record']), 'native_writer_configuration');
  const { lane, sdkProvider, session, record } = options;
  check(['sdk', 'mcp'].includes(lane) && typeof record === 'function', 'native_writer_configuration');
  check(fields(options.target, TARGET_FIELDS) && options.target.owner === 'OndCo'
    && options.target.repo === 'Action-Effect-Bench' && Number.isSafeInteger(options.target.issue_number)
    && options.target.issue_number > 1 && options.target.issue_number <= 2147483647, 'native_writer_target');
  const target = snapshot(options.target, 'native_writer_target');
  const sdk = {};
  for (const method of ['principal', 'listComments', 'readComment', ...(lane === 'sdk' ? ['createComment'] : [])]) {
    check(typeof sdkProvider?.[method] === 'function', 'native_writer_configuration');
    sdk[method] = sdkProvider[method].bind(sdkProvider);
  }
  if (typeof sdkProvider.readIssue === 'function') sdk.readIssue = sdkProvider.readIssue.bind(sdkProvider);
  let call, inventory;
  if (lane === 'mcp') {
    check(typeof session?.call === 'function', 'native_writer_configuration');
    inventory = snapshot(session.inventory, 'native_writer_configuration');
    check(inventory?.read_only === false && Array.isArray(inventory.selected_tools)
      && inventory.selected_tools.includes('add_issue_comment'), 'native_writer_configuration');
    call = session.call.bind(session);
  } else check(session === undefined, 'native_writer_configuration');

  let attempted = false, dispatched = false, journalFailure;
  function healthy() { if (journalFailure) throw journalFailure; }
  async function write(event) {
    healthy();
    try { await record(freeze(event)); }
    catch {
      journalFailure ??= new FieldWriteError('native_journal_failure', dispatched ? 'unknown' : 'not_dispatched');
    }
    // A different in-flight observation may have failed its journal meanwhile.
    healthy();
  }
  function parameters(value, create = false) {
    check(fields(value, CREATE_FIELDS, create ? CREATE_FIELDS : TARGET_FIELDS)
      && TARGET_FIELDS.every(key => value[key] === target[key])
      && (!Object.hasOwn(value, 'body') || validBody(value.body)), 'native_writer_arguments');
    return snapshot(value, 'native_writer_arguments');
  }
  function common(method, args, nativeLane) {
    return { lane: nativeLane, method, args, args_sha256: hashJson(args),
      ...(nativeLane === 'mcp' ? { inventory } : {}) };
  }
  async function observe(method, args, invoke, project = value => value) {
    healthy();
    const base = common(method, args, 'sdk');
    await write({ type: 'native_read_attempt', ...base });
    healthy();
    let response, error;
    try { response = snapshot(project(await invoke()), 'native_invalid_response', 'read_failed'); }
    catch (cause) { error = nativeError(cause, 'native_read_failure', 'read_failed'); }
    await write({ type: 'native_read_response', ...base, response: error ? null : response,
      response_sha256: hashJson(error ? null : response), ...(error ? { code: error.code } : {}) });
    healthy();
    if (error) throw error;
    return response;
  }
  const htmlUrl = id => `https://github.com/${target.owner}/${target.repo}/issues/${target.issue_number}#issuecomment-${id}`;
  function resultId(response) {
    if (lane === 'mcp') {
      const id = Number(decodeCommentResult(response));
      const value = response.structuredContent ?? JSON.parse(response.content[0].text);
      check((value.url ?? value.html_url) === htmlUrl(id), 'native_response_target', 'unknown');
      // This ID is untrusted until the gate performs its independent SDK readback.
      return { id };
    }
    check(plain(response) && validId(response.id), 'native_invalid_response', 'unknown');
    const base = `https://api.github.com/repos/${target.owner}/${target.repo}/issues`;
    for (const [key, expected] of Object.entries({ url: `${base}/comments/${response.id}`,
      issue_url: `${base}/${target.issue_number}`, html_url: htmlUrl(response.id) })) {
      check(!Object.hasOwn(response, key) || response[key] === expected, 'native_response_target', 'unknown');
    }
    return response;
  }
  const provider = {
    async principal(...args) {
      healthy();
      check(args.length === 0, 'native_writer_arguments');
      const result = await observe('principal', {}, sdk.principal, value => {
        const login = typeof value === 'string' ? value : Object.getOwnPropertyDescriptor(value ?? {}, 'login')?.value;
        check(scalarString(login) && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?$/.test(login),
          'native_invalid_principal', 'read_failed');
        return { login };
      });
      return result.login;
    },
    async createComment(...values) {
      healthy();
      check(!attempted, 'native_write_already_attempted');
      // Consume before validation or an await: neither reentrancy nor uncertainty permits another send.
      attempted = true;
      check(values.length === 1, 'native_writer_arguments');
      const args = parameters(values[0], true);
      const base = common(lane === 'sdk' ? 'createComment' : 'add_issue_comment', args, lane);
      await write({ type: 'native_write_attempt', ...base,
        body_sha256: digestBytes(args.body), body_bytes: Buffer.byteLength(args.body) });
      healthy();
      let response;
      try {
        dispatched = true;
        response = snapshot(await (lane === 'sdk' ? sdk.createComment(args) : call('add_issue_comment', args)),
          'native_invalid_response', 'unknown');
      } catch (cause) {
        const error = nativeError(cause, 'native_write_failure', 'unknown');
        await write({ type: 'native_write_error', ...base, code: error.code });
        healthy();
        throw error;
      }
      await write({ type: 'native_write_response', ...base, response, response_sha256: hashJson(response) });
      healthy();
      try { return resultId(response); }
      catch (cause) {
        const error = nativeError(cause, 'native_invalid_response', 'unknown');
        await write({ type: 'native_write_error', ...base, code: error.code });
        healthy();
        throw error;
      }
    },
    async readComment(...values) {
      healthy();
      check(values.length === 2 && validId(values[1]), 'native_writer_arguments');
      const args = parameters(values[0]), id = values[1];
      return observe('readComment', { ...args, comment_id: id }, () => sdk.readComment(args, id));
    },
    async listComments(...values) {
      healthy();
      check(values.length === 1, 'native_writer_arguments');
      const args = parameters(values[0]);
      return observe('listComments', args, () => sdk.listComments(args));
    },
  };
  if (sdk.readIssue) provider.readIssue = async (...values) => {
    healthy();
    check(values.length === 1, 'native_writer_arguments');
    const args = parameters(values[0]);
    return observe('readIssue', args, () => sdk.readIssue(args));
  };
  return Object.freeze(provider);
}

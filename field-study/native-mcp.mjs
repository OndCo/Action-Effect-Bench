import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute } from 'node:path';
import { parseStrict, scalarString } from '../../action-effect-spec/implementations/javascript/strict-json.mjs';

const require = createRequire(new URL('../runtime-pilot/package.json', import.meta.url));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport, DEFAULT_INHERITED_ENV_VARS } = require('@modelcontextprotocol/sdk/client/stdio.js');
const READ_TOOLS = ['get_file_contents', 'get_release_by_tag', 'issue_read'];
const ALLOWED_TOOLS = new Set([...READ_TOOLS, 'get_me', 'add_issue_comment']);
const MAX_FILE_BYTES = 180000;
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_FACTORY = parameters => new StdioClientTransport(parameters);
const sha256 = value => createHash('sha256').update(value).digest('hex');

export class NativeMcpError extends Error {
  constructor(code, outcome = 'not_dispatched') {
    super(code);
    this.name = 'NativeMcpError';
    this.code = code;
    this.outcome = outcome;
  }
}
const failure = (code, outcome) => new NativeMcpError(code, outcome);
function check(condition, code, outcome) { if (!condition) throw failure(code, outcome); }
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Object.getOwnPropertySymbols(value).length === 0
    && Object.values(Object.getOwnPropertyDescriptors(value)).every(item => 'value' in item && item.enumerable);
}
function keys(value, allowed, required = []) {
  return record(value) && Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key));
}
function string(value, limit) { return scalarString(value) && Buffer.byteLength(value) <= limit; }
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

async function deadline(operation, timeoutMs, outcome = 'not_dispatched') {
  const controller = new AbortController();
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = failure('mcp_timeout', outcome);
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), expired]); }
  finally { clearTimeout(timer); }
}

function configuration(options) {
  check(record(options), 'mcp_configuration');
  const { binary, tokenProvider, writable = false, timeoutMs = 60000, transportFactory = DEFAULT_FACTORY,
    selectedTools = READ_TOOLS, pins = {} } = options;
  check(string(binary, 4096) && isAbsolute(binary) && !binary.includes('\0') && typeof tokenProvider === 'function'
    && typeof writable === 'boolean' && Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000
    && typeof transportFactory === 'function', 'mcp_configuration');
  check(Array.isArray(selectedTools) && selectedTools.length > 0 && selectedTools.length <= ALLOWED_TOOLS.size
    && selectedTools.every(name => ALLOWED_TOOLS.has(name)) && new Set(selectedTools).size === selectedTools.length, 'mcp_configuration');
  check(writable || !selectedTools.includes('add_issue_comment'), 'mcp_read_only');
  check(keys(pins, ['source_commit', 'archive_sha256', 'executable_sha256'])
    && Object.entries(pins).every(([key, value]) => typeof value === 'string'
      && (key === 'source_commit' ? /^[a-f0-9]{40}$/ : /^[a-f0-9]{64}$/).test(value)), 'mcp_configuration');
  return { binary, tokenProvider, writable, timeoutMs, transportFactory, selectedTools: [...selectedTools], pins: { ...pins } };
}

async function executableIdentity(binary, expected) {
  try {
    const path = await realpath(binary);
    const info = await stat(path);
    check(info.isFile() && info.size > 0 && info.size <= 128 * 1024 * 1024, 'mcp_executable_identity');
    await access(path, constants.X_OK);
    const digest = sha256(await readFile(path));
    check(!expected || expected === digest, 'mcp_executable_identity');
    return { path, digest };
  } catch { throw failure('mcp_executable_identity'); }
}

function verifyTool(tool, selected) {
  check(record(tool) && selected.has(tool.name) && record(tool.inputSchema) && tool.inputSchema.type === 'object'
    && record(tool.inputSchema.properties) && record(tool.annotations)
    && tool.annotations.readOnlyHint === (tool.name !== 'add_issue_comment'), 'mcp_inventory_invalid');
  const contracts = {
    get_file_contents: { owner: 'string', repo: 'string', path: 'string', sha: 'string', ref: 'string' },
    get_release_by_tag: { owner: 'string', repo: 'string', tag: 'string' },
    issue_read: { owner: 'string', repo: 'string', issue_number: 'number', method: 'string' },
    get_me: {},
    add_issue_comment: { owner: 'string', repo: 'string', issue_number: 'number', body: 'string' },
  };
  for (const [key, type] of Object.entries(contracts[tool.name])) {
    const actual = tool.inputSchema.properties[key]?.type;
    check(actual === type || (type === 'number' && actual === 'integer'), 'mcp_inventory_invalid');
  }
  const required = tool.name === 'get_me' ? [] : ['owner', 'repo'];
  if (tool.name === 'get_release_by_tag') required.push('tag');
  if (['issue_read', 'add_issue_comment'].includes(tool.name)) required.push('issue_number');
  if (tool.name === 'issue_read') required.push('method');
  check(required.every(key => tool.inputSchema.required?.includes(key)), 'mcp_inventory_invalid');
}

async function collectInventory(client, selectedTools, signal, timeoutMs) {
  const selected = new Set(selectedTools), seen = new Set(), cursors = new Set(), tools = [];
  let cursor;
  for (let page = 0; page < 8; page += 1) {
    const result = await client.listTools(cursor === undefined ? undefined : { cursor }, { signal, timeout: timeoutMs });
    check(Array.isArray(result.tools) && result.tools.length + tools.length <= selected.size, 'mcp_inventory_invalid');
    for (const tool of result.tools) {
      verifyTool(tool, selected);
      check(!seen.has(tool.name), 'mcp_inventory_invalid');
      seen.add(tool.name);
      tools.push(tool);
    }
    check(Buffer.byteLength(JSON.stringify(tools)) <= 1024 * 1024, 'mcp_inventory_invalid');
    if (result.nextCursor === undefined) {
      check(seen.size === selected.size, 'mcp_inventory_invalid');
      return tools.sort((a, b) => selectedTools.indexOf(a.name) - selectedTools.indexOf(b.name));
    }
    check(string(result.nextCursor, 1024) && result.nextCursor.length > 0 && !cursors.has(result.nextCursor), 'mcp_inventory_invalid');
    cursor = result.nextCursor;
    cursors.add(cursor);
  }
  throw failure('mcp_inventory_invalid');
}

function argumentsFor(name, args) {
  const invalid = () => failure('mcp_invalid_arguments');
  try {
    const fields = {
      get_file_contents: ['owner', 'repo', 'path', 'sha', 'ref'],
      get_release_by_tag: ['owner', 'repo', 'tag'],
      issue_read: ['owner', 'repo', 'issue_number', 'method', 'page', 'perPage'],
      get_me: [],
      add_issue_comment: ['owner', 'repo', 'issue_number', 'body'],
    };
    if (!keys(args, fields[name])) throw invalid();
    const result = { ...args };
    if (name === 'get_me') return result;
    if (typeof result.owner !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(result.owner)
      || typeof result.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(result.repo) || ['.', '..'].includes(result.repo)) throw invalid();
    if (['issue_read', 'add_issue_comment'].includes(name)
      && (!Number.isSafeInteger(result.issue_number) || result.issue_number < 1 || result.issue_number > 2147483647)) throw invalid();
    if (name === 'add_issue_comment' && (Object.keys(result).length !== 4 || !string(result.body, 8192) || !result.body.length)) throw invalid();
    if (name === 'get_release_by_tag' && (!string(result.tag, 256) || !/^[A-Za-z0-9_.\/-]+$/.test(result.tag) || result.tag.includes('..'))) throw invalid();
    if (name === 'get_file_contents') {
      if (!string(result.path, 2048) || !result.path.length || /[\\\x00-\x1f\x7f]/.test(result.path)
        || result.path.split('/').some(part => ['', '.', '..'].includes(part))) throw invalid();
      const hasSha = Object.hasOwn(result, 'sha'), hasRef = Object.hasOwn(result, 'ref');
      if (hasSha === hasRef || (hasSha && (typeof result.sha !== 'string' || !/^[a-f0-9]{40}$/.test(result.sha)))
        || (hasRef && (!string(result.ref, 256) || !/^[A-Za-z0-9_.\/-]+$/.test(result.ref) || result.ref.includes('..')))) throw invalid();
    }
    if (name === 'issue_read') {
      if (!['get', 'get_comments', 'get_sub_issues', 'get_parent', 'get_labels'].includes(result.method)) throw invalid();
      for (const key of ['page', 'perPage']) if (Object.hasOwn(result, key)
        && (!Number.isSafeInteger(result[key]) || result[key] < 1 || result[key] > (key === 'perPage' ? 100 : 100000))) throw invalid();
    }
    return result;
  } catch { throw invalid(); }
}

/** Pins are operator-supplied provenance; only executable_sha256 is checked here. */
export async function openNativeMcp(options) {
  const config = configuration(options);
  const identity = await executableIdentity(config.binary, config.pins.executable_sha256);
  let token;
  try {
    token = await deadline(() => config.tokenProvider(), config.timeoutMs);
    check(string(token, 16384) && token.length > 0 && !/[\s\x00-\x1f\x7f]/.test(token), 'mcp_auth_unavailable');
  } catch { throw failure('mcp_auth_unavailable'); }
  await executableIdentity(identity.path, identity.digest);
  // SDK stdio merges its default environment even when env is supplied. Override
  // those defaults explicitly; never inherit credential, proxy or logging knobs.
  const env = Object.fromEntries(DEFAULT_INHERITED_ENV_VARS.map(key => [key, undefined]));
  env.PATH = '/usr/bin:/bin';
  env.TZ = 'America/Toronto';
  env.GITHUB_PERSONAL_ACCESS_TOKEN = token;
  token = undefined;
  const client = new Client({ name: 'action-effect-field-study', version: '0.3.0' });
  client.onerror = () => {};
  let protocolVersion, transport, closed = false, closing, mutationInFlight = false, mutationUnknown = false;
  async function close() {
    if (!closing) {
      closed = true;
      env.GITHUB_PERSONAL_ACCESS_TOKEN = undefined;
      closing = Promise.resolve().then(async () => {
        try { await client.close(); }
        finally { await transport?.close(); }
      }).catch(() => { throw failure('mcp_close_failed'); });
    }
    return closing;
  }
  let tools, stage = 'initialize';
  try {
    transport = config.transportFactory({ command: identity.path, cwd: dirname(identity.path),
      args: ['stdio', '--gh-host=https://github.com', '--toolsets=', config.writable ? '--read-only=false' : '--read-only', `--tools=${config.selectedTools.join(',')}`],
      env, stderr: 'ignore', maxBufferSize: MAX_MESSAGE_BYTES });
    check(transport && typeof transport.start === 'function' && typeof transport.send === 'function'
      && typeof transport.close === 'function' && transport.sessionId === undefined, 'mcp_initialization_failed');
    // SDK onclose drops its transport reference; retain one awaitable cleanup.
    const closeTransport = transport.close.bind(transport);
    let transportClosing;
    transport.close = () => {
      transportClosing ??= Promise.resolve().then(closeTransport);
      return transportClosing;
    };
    const setProtocolVersion = transport.setProtocolVersion?.bind(transport);
    // The SDK has no public protocol getter. Its optional transport hook receives
    // the actual negotiated version, including a server-selected older version.
    transport.setProtocolVersion = version => { protocolVersion = version; setProtocolVersion?.(version); };
    tools = await deadline(async signal => {
      await client.connect(transport, { signal, timeout: config.timeoutMs });
      env.GITHUB_PERSONAL_ACCESS_TOKEN = undefined;
      stage = 'inventory';
      return collectInventory(client, config.selectedTools, signal, config.timeoutMs);
    }, config.timeoutMs);
    const server = client.getServerVersion();
    check(record(server) && server.name === 'github-mcp-server' && string(server.version, 128) && server.version.length > 0
      && typeof protocolVersion === 'string', 'mcp_inventory_invalid');
    await executableIdentity(identity.path, identity.digest);
  } catch (error) {
    await close().catch(() => {});
    if (error instanceof NativeMcpError) throw error;
    throw failure(stage === 'initialize' ? 'mcp_initialization_failed' : 'mcp_inventory_invalid');
  } finally { env.GITHUB_PERSONAL_ACCESS_TOKEN = undefined; }
  const inventory = freeze(JSON.parse(JSON.stringify({ executable_sha256: identity.digest, pins: config.pins,
    transport: 'stdio', read_only: !config.writable, selected_tools: config.selectedTools,
    protocol_version: protocolVersion, server: client.getServerVersion(), tools, tools_sha256: sha256(stableJson(tools)) })));
  return { inventory, close, async call(name, args) {
    check(!closed, 'mcp_closed');
    const mutation = name === 'add_issue_comment';
    check(!mutation || config.writable, 'mcp_read_only');
    check(config.selectedTools.includes(name), 'mcp_tool_not_selected');
    const argumentsSnapshot = argumentsFor(name, args);
    check(!mutation || !mutationUnknown, 'mcp_mutation_unknown', 'unknown');
    check(!mutation || !mutationInFlight, 'mcp_mutation_in_flight');
    if (mutation) mutationInFlight = true;
    const outcome = mutation ? 'unknown' : 'read_failed';
    try {
      const result = await deadline(signal => client.callTool({ name, arguments: argumentsSnapshot }, undefined,
        { signal, timeout: config.timeoutMs }), config.timeoutMs, outcome);
      check(!result.isError, 'mcp_tool_error', outcome);
      check(Buffer.byteLength(JSON.stringify(result)) <= MAX_MESSAGE_BYTES, 'mcp_invalid_result', outcome);
      return result;
    } catch (error) {
      if (mutation) mutationUnknown = true;
      if (error instanceof NativeMcpError) throw error;
      throw failure(error?.code === -32001 ? 'mcp_timeout' : 'mcp_transport_error', outcome);
    } finally { if (mutation) mutationInFlight = false; }
  } };
}

function resultContent(result, invalid, outcome) {
  check(record(result) && (!Object.hasOwn(result, 'isError') || typeof result.isError === 'boolean'), invalid, outcome);
  check(!result.isError, 'mcp_tool_error', outcome);
  check((Array.isArray(result.content) || (!Object.hasOwn(result, 'content') && Object.hasOwn(result, 'structuredContent')))
    && Buffer.byteLength(JSON.stringify(result)) <= MAX_MESSAGE_BYTES, invalid, outcome);
  return result.content ?? [];
}
function parsedText(block, maxBytes) {
  if (!keys(block, ['type', 'text', 'annotations', '_meta'], ['type', 'text']) || block.type !== 'text' || !string(block.text, maxBytes)) throw Error();
  return parseStrict(Buffer.from(block.text), maxBytes);
}

/** expected.uri is an independently constructed exact MCP resource URI. */
export function decodeFileResult(result, expected) {
  const invalid = 'mcp_invalid_file_result', outcome = 'read_failed';
  check(keys(expected, ['uri', 'maxBytes'], ['uri']) && string(expected.uri, 4096)
    && /^repo:\/\/[^\s?#]+\/[^\s?#]+$/.test(expected.uri), 'mcp_invalid_file_expectation');
  const maxBytes = expected.maxBytes ?? MAX_FILE_BYTES;
  check(Number.isSafeInteger(maxBytes) && maxBytes >= 0 && maxBytes <= MAX_FILE_BYTES, 'mcp_invalid_file_expectation');
  try {
    let content = resultContent(result, invalid, outcome);
    if (Object.hasOwn(result, 'structuredContent')) {
      const structured = result.structuredContent;
      check(keys(structured, ['content'], ['content']) && Array.isArray(structured.content), invalid, outcome);
      if (content.length) {
        const mirror = content.length === 1 && content[0].type === 'text'
          ? parsedText(content[0], MAX_MESSAGE_BYTES) : { content };
        check(stableJson(mirror) === stableJson(structured), invalid, outcome);
      }
      content = structured.content;
    }
    check(content.length === 1 || content.length === 2, invalid, outcome);
    if (content.length === 2) check(keys(content[0], ['type', 'text', 'annotations', '_meta'], ['type', 'text'])
      && content[0].type === 'text' && string(content[0].text, 4096), invalid, outcome);
    const block = content.at(-1);
    check(keys(block, ['type', 'resource', 'annotations', '_meta'], ['type', 'resource']) && block.type === 'resource', invalid, outcome);
    const resource = block.resource;
    check(keys(resource, ['uri', 'mimeType', 'text', 'blob', '_meta'], ['uri']) && resource.uri === expected.uri
      && Object.hasOwn(resource, 'text') !== Object.hasOwn(resource, 'blob'), invalid, outcome);
    if (Object.hasOwn(resource, 'mimeType')) check(string(resource.mimeType, 256)
      && /^(?:text\/[^;\s]+|application\/(?:json|xml|[^;\s]+\+(?:json|xml)))(?:;[^\r\n]*)?$/i.test(resource.mimeType), invalid, outcome);
    let bytes, text;
    if (Object.hasOwn(resource, 'text')) {
      check(string(resource.text, maxBytes), invalid, outcome);
      text = resource.text;
      bytes = Buffer.from(text);
    } else {
      check(string(resource.blob, 4 * Math.ceil(maxBytes / 3)), invalid, outcome);
      bytes = Buffer.from(resource.blob, 'base64');
      check(bytes.length <= maxBytes && bytes.toString('base64') === resource.blob, invalid, outcome);
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      check(Buffer.from(text).equals(bytes), invalid, outcome);
    }
    return { text, provider_metadata: { uri: resource.uri, mime_type: resource.mimeType ?? null,
      representation: Object.hasOwn(resource, 'text') ? 'text' : 'base64' }, byte_length: bytes.length, sha256: sha256(bytes) };
  } catch (error) {
    if (error instanceof NativeMcpError) throw error;
    throw failure(invalid, outcome);
  }
}

/** Returns an ID for independent readback, never an authenticated receipt. */
export function decodeCommentResult(result) {
  const invalid = 'mcp_invalid_comment_result', outcome = 'unknown';
  try {
    const content = resultContent(result, invalid, outcome);
    check(content.length <= 1, invalid, outcome);
    let value = content.length ? parsedText(content[0], 16384) : undefined;
    if (Object.hasOwn(result, 'structuredContent')) {
      if (value !== undefined) check(stableJson(value) === stableJson(result.structuredContent), invalid, outcome);
      value = result.structuredContent;
    }
    check(keys(value, ['id', 'url', 'html_url'], ['id']) && Object.keys(value).length === 2
      && Object.hasOwn(value, 'url') !== Object.hasOwn(value, 'html_url'), invalid, outcome);
    const id = typeof value.id === 'number' && Number.isSafeInteger(value.id) ? String(value.id) : value.id;
    check(typeof id === 'string' && /^[1-9][0-9]{0,15}$/.test(id) && Number.isSafeInteger(Number(id)), invalid, outcome);
    const href = value.url ?? value.html_url;
    check(string(href, 2048) && new RegExp(`^https://github\\.com/[A-Za-z0-9-]+/[A-Za-z0-9_.-]+/(?:issues|pull)/[1-9][0-9]*#issuecomment-${id}$`).test(href), invalid, outcome);
    return id;
  } catch (error) {
    if (error instanceof NativeMcpError) throw error;
    throw failure(invalid, outcome);
  }
}

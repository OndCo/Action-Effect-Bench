import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { assertPublicValue } from './artifacts.mjs';

const REPOSITORIES = new Set(['OndCo/Action-Effect-Spec', 'OndCo/Action-Effect-Bench']);
const TAG = 'v0.2.0-draft.1';
const ASSET = 'manuscript.pdf';
const TEXT_LIMIT = 180000;
const INSPECTION_LIMIT = 2 * 1024 * 1024;
const READER_METADATA_LIMIT = 4 * 1024 * 1024;
const METHODS = ['readFile', 'readRelease', 'readAsset'];
const NATIVE_REASONS = new Set(['provider_read_failure',
  ...[401, 403, 404, 429, 500, 502, 503, 504].map(status => `provider_read_failure_${status}`),
  'mcp_tool_error', 'mcp_timeout', 'mcp_transport_error', 'mcp_invalid_file_result', 'release_binding']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceKey = (repository, path) => JSON.stringify([repository, path]);
const releaseUrl = repository => `https://github.com/${repository}/releases/tag/${TAG}`;
const assetUrl = repository => `https://github.com/${repository}/releases/download/${TAG}/${ASSET}`;

class ReadFailure extends Error {}
const fail = reason => { throw new ReadFailure(reason); };

function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string'
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

function fields(value, names) {
  return record(value) && Reflect.ownKeys(value).length === names.length
    && names.every(name => Object.hasOwn(value, name));
}

function nativeFailureReason(error) {
  try {
    const message = Object.getOwnPropertyDescriptor(error, 'message')?.value;
    return NATIVE_REASONS.has(message) ? message : null;
  } catch { return null; }
}

function captureReaderMetadata(response) {
  const descriptor = response && typeof response === 'object' ? Object.getOwnPropertyDescriptor(response, 'metadata') : undefined;
  if (!descriptor || (Object.hasOwn(descriptor, 'value') && descriptor.value === undefined)) return undefined;
  if (!Object.hasOwn(descriptor, 'value') || !record(descriptor.value)) fail('invalid_reader_metadata');
  let metadata;
  try { metadata = structuredClone(descriptor.value); }
  catch { fail('invalid_reader_metadata'); }
  try { assertPublicValue(metadata); }
  catch { fail('reader_metadata_not_public'); }
  if (Buffer.byteLength(JSON.stringify(metadata)) > READER_METADATA_LIMIT) fail('reader_metadata_too_large');
  return metadata;
}

function validPath(path) {
  return typeof path === 'string' && path.length > 0 && path.isWellFormed()
    && !/[\\\u0000-\u001f\u007f%?#:]/u.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

function snapshotTask(task) {
  if (!record(task) || !['sdk', 'mcp'].includes(task.lane) || !Array.isArray(task.sources) || !task.sources.length
    || (task.allow_release_assets !== undefined && typeof task.allow_release_assets !== 'boolean')) fail('invalid_task');
  const sources = new Map();
  for (const source of task.sources) {
    if (!fields(source, ['repository', 'path', 'ref']) || !REPOSITORIES.has(source.repository) || !validPath(source.path)
      || typeof source.ref !== 'string' || source.ref.length !== 40 || !/^[a-f0-9]{40}$/.test(source.ref)) fail('invalid_task');
    const key = sourceKey(source.repository, source.path);
    if (sources.has(key)) fail('invalid_task');
    sources.set(key, Object.freeze({ repository: source.repository, path: source.path, ref: source.ref }));
  }
  return { lane: task.lane, sources, repositories: [...new Set([...sources.values()].map(source => source.repository))],
    allowAssets: task.allow_release_assets === true };
}

function argumentsFor(value, names) {
  if (!fields(value, names) || names.some(name => typeof value[name] !== 'string')) fail('invalid_arguments');
  return Object.freeze(Object.fromEntries(names.map(name => [name, value[name]])));
}

function fileBytes(response, source, limit) {
  if (!record(response) || (typeof response.text !== 'string' && !Buffer.isBuffer(response.text))) fail('invalid_file_result');
  if (response.metadata !== undefined) {
    if (!record(response.metadata)) fail('invalid_file_result');
    for (const key of ['repository', 'path', 'ref']) {
      if (Object.hasOwn(response.metadata, key) && response.metadata[key] !== source[key]) fail('file_binding_mismatch');
    }
  }
  if (typeof response.text === 'string' && !response.text.isWellFormed()) fail('invalid_file_utf8');
  if (Buffer.byteLength(response.text) > limit) fail('file_too_large');
  const bytes = Buffer.from(response.text);
  let text;
  try {
    // ignoreBOM preserves a literal UTF-8 BOM instead of silently stripping its bytes.
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch { fail('invalid_file_utf8'); }
  if (!Buffer.from(text).equals(bytes)) fail('invalid_file_utf8');
  return { bytes, text };
}

function publicRelease(value, repository) {
  if (!record(value) || !Number.isSafeInteger(value.id) || value.id < 1 || value.tag_name !== TAG
    || value.draft !== false || typeof value.prerelease !== 'boolean' || value.html_url !== releaseUrl(repository)
    || !Array.isArray(value.assets)) fail('invalid_release');
  const assets = [];
  for (const asset of value.assets) {
    if (!record(asset) || typeof asset.name !== 'string') fail('invalid_release');
    if (asset.name !== ASSET) continue;
    if (assets.length || !Number.isSafeInteger(asset.size) || asset.size < 0
      || asset.browser_download_url !== assetUrl(repository)) fail('invalid_release');
    const digest = asset.digest ?? null;
    if (digest !== null && (typeof digest !== 'string' || digest.length !== 71 || !/^sha256:[a-f0-9]{64}$/.test(digest))) {
      fail('invalid_release');
    }
    assets.push({ name: ASSET, size: asset.size, url: assetUrl(repository), digest });
  }
  return { repository, id: value.id, tag: TAG, html_url: releaseUrl(repository), source_url: releaseUrl(repository),
    draft: false, prerelease: value.prerelease, assets };
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// Facades own transport timeouts, streaming limits and redirect policy. No network
// or native-server module is imported here; an unavailable lane is never replaced.
export function createReadTools({ task, sdk, mcp, journal } = {}) {
  const config = snapshotTask(task);
  const facade = config.lane === 'sdk' ? sdk : mcp;
  if (!facade || METHODS.some(method => typeof facade[method] !== 'function')) fail('invalid_reader');
  const reader = Object.fromEntries(METHODS.map(method => [method, facade[method].bind(facade)]));
  if (typeof journal?.append !== 'function') fail('invalid_journal');
  const append = journal.append.bind(journal);
  let toolSequence = 0, nativeSequence = 0;

  async function write(event) {
    try { await append(structuredClone(event)); }
    catch { fail('journal_unavailable'); }
  }

  function repositoryFor(repository) {
    if (!config.repositories.includes(repository)) fail('repository_not_allowed');
    const [owner, repo] = repository.split('/');
    return { owner, repo };
  }

  async function file(args, invoke, includeText) {
    const source = config.sources.get(sourceKey(args.repository, args.path));
    if (!source) fail('source_not_allowed');
    const { repository, path, ref } = source;
    const source_url = `https://github.com/${repository}/blob/${ref}/${path.split('/').map(encodeURIComponent).join('/')}`;
    const response = await invoke('readFile', { ...repositoryFor(repository), path, ref }, source_url);
    const { bytes, text } = fileBytes(response, source, includeText ? TEXT_LIMIT : INSPECTION_LIMIT);
    const result = { repository, path, ref, source_url, sha256: hash(bytes), bytes: bytes.length,
      ...(includeText ? { text } : {}) };
    return { result, ...(includeText ? { content_base64: bytes.toString('base64') } : {}) };
  }

  async function inspectRelease(args, invoke) {
    const target = repositoryFor(args.repository);
    const response = await invoke('readRelease', { ...target, tag: TAG }, releaseUrl(args.repository));
    return { result: publicRelease(response, args.repository) };
  }

  async function inspectAsset(args, invoke) {
    if (!config.allowAssets || args.asset_name !== ASSET) fail('asset_not_allowed');
    const { result: release } = await inspectRelease(args, invoke);
    const asset = release.assets[0];
    if (!asset) fail('asset_not_found');
    if (asset.size > INSPECTION_LIMIT) fail('asset_too_large');
    const bytes = await invoke('readAsset', { url: asset.url }, asset.url);
    if (!Buffer.isBuffer(bytes)) fail('invalid_asset_result');
    if (bytes.length > INSPECTION_LIMIT) fail('asset_too_large');
    if (bytes.length !== asset.size) fail('asset_size_mismatch');
    const sha256 = hash(bytes);
    if (asset.digest !== null && asset.digest !== `sha256:${sha256}`) fail('asset_digest_mismatch');
    return { result: { repository: args.repository, release_id: release.id, tag: TAG, asset_name: ASSET,
      source_url: asset.url, bytes: bytes.length, sha256, advertised_digest: asset.digest,
      digest_matches_release: asset.digest === null ? null : true } };
  }

  function tool(name, description, properties, action) {
    const names = Object.keys(properties);
    return { schema: freeze({ type: 'function', name, description, parameters: {
      type: 'object', properties, required: names, additionalProperties: false }, strict: true }),
    async execute(input) {
      const started = performance.now(), tool_call_index = ++toolSequence;
      const counts = { readFile: 0, readRelease: 0, readAsset: 0 };
      const common = { tool: name, tool_call_index, lane: config.lane };
      const readerMetadata = [];
      let args, nativeReason = null;
      const accounting = () => ({ call_counts: { ...counts }, native_calls: Object.values(counts).reduce((a, b) => a + b, 0),
        duration_ms: performance.now() - started });
      const diagnostics = () => ({ native_reason: nativeReason,
        ...(readerMetadata.length ? { reader_metadata: readerMetadata } : {}) });

      async function invoke(method, arguments_, source_url) {
        const call = { ...common, native_call_index: ++nativeSequence, method, arguments: arguments_, source_url };
        await write({ type: 'read_call_start', ...call, status: 'started' });
        const nativeStarted = performance.now();
        counts[method] += 1;
        let response, metadata, reason = null;
        try { response = await reader[method](Object.freeze({ ...arguments_ })); }
        catch (error) { reason = 'reader_unavailable'; nativeReason = nativeFailureReason(error); }
        if (reason === null) {
          try { metadata = captureReaderMetadata(response); }
          catch (error) { reason = error instanceof ReadFailure ? error.message : 'invalid_reader_metadata'; }
        }
        if (metadata !== undefined) readerMetadata.push({ native_call_index: call.native_call_index, method, metadata });
        await write({ type: 'read_call_result', ...call, duration_ms: performance.now() - nativeStarted,
          status: reason === null ? 'ok' : 'unavailable', native_reason: nativeReason,
          ...(reason === null ? {} : { reason }), ...(metadata === undefined ? {} : { reader_metadata: metadata }) });
        if (reason !== null) fail(reason);
        return response;
      }

      try {
        args = argumentsFor(input, names);
        const { result, content_base64 } = await action(args, invoke);
        const output = { status: 'ok', lane: config.lane, ...result };
        // Supplied public native envelopes stay journal-only. Inspection adds no
        // separate body copy; text reads also retain their exact decoded bytes.
        const { text, ...metadata } = output;
        await write({ type: 'read_tool_result', ...common, arguments: args, status: 'ok', ...accounting(), ...diagnostics(),
          source_url: result.source_url, result: metadata, ...(content_base64 === undefined ? {} : { content_base64 }) });
        return output;
      } catch (error) {
        let reason = error instanceof ReadFailure ? error.message : 'reader_unavailable';
        try {
          await write({ type: 'read_tool_result', ...common, ...(Object.values(counts).some(count => count > 0) ? { arguments: args } : {}),
            status: 'unavailable', reason, ...accounting(), ...diagnostics() });
        } catch { reason = 'journal_unavailable'; }
        return { status: 'unavailable', reason };
      }
    } };
  }

  const repository = { type: 'string', enum: config.repositories };
  const path = { type: 'string', description: 'Exact file path in this task\'s frozen source allowlist; no directories or alternate refs.' };
  return Object.freeze({
    read_repository_file: tool('read_repository_file', 'Read an allowed pinned UTF-8 file, returning its exact text and byte digest (at most 180000 bytes).',
      { repository, path }, (args, invoke) => file(args, invoke, true)),
    inspect_repository_file: tool('inspect_repository_file', 'Hash an allowed pinned UTF-8 file up to 2 MiB, returning metadata only and no file text.',
      { repository, path }, (args, invoke) => file(args, invoke, false)),
    inspect_release: tool('inspect_release', 'Inspect public v0.2.0-draft.1 release metadata in an allowed repository; draft releases are rejected.',
      { repository }, inspectRelease),
    inspect_release_asset: tool('inspect_release_asset', 'When this task explicitly permits it, download and hash the release manuscript.pdf (at most 2 MiB); return metadata only.',
      { repository, asset_name: { type: 'string', enum: [ASSET] } }, inspectAsset),
  });
}

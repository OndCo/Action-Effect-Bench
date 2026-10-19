import { createRequire } from 'node:module';

const require = createRequire(new URL('../runtime-pilot/package.json', import.meta.url));
const { Octokit } = await import(require.resolve('@octokit/rest'));
const REPOSITORIES = new Set(['Action-Effect-Spec', 'Action-Effect-Bench']);
const TAG = 'v0.2.0-draft.1';

function target(owner, repo) {
  if (owner !== 'OndCo' || !REPOSITORIES.has(repo)) throw new Error('reader_scope');
}

export function createGithubReader({ tokenProvider, request } = {}) {
  let client;
  async function invoke(route, args) {
    try {
      if (request) return await request(route, args);
      if (!client) {
        const token = await tokenProvider();
        if (typeof token !== 'string' || !token) throw new Error('auth_unavailable');
        client = new Octokit({ auth: token, userAgent: 'action-effect-real-maintainer-use/0.3',
          log: { debug() {}, info() {}, warn() {}, error() {} },
          request: { timeout: 30000, fetch: (url, init) => {
            const parsed = new URL(String(url));
            if (parsed.origin !== 'https://api.github.com' || parsed.username || parsed.password) throw new Error('provider_endpoint');
            return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000) });
          } } });
      }
      return await client.request(route, { ...args, headers: { 'X-GitHub-Api-Version': '2022-11-28' } });
    } catch (error) {
      const suffix = Number.isInteger(error.status) ? `_${error.status}` : '';
      throw new Error(`provider_read_failure${suffix}`);
    }
  }
  return {
    async readFile({ owner, repo, path, ref }) {
      target(owner, repo);
      if (!/^[a-f0-9]{40}$/.test(ref) || typeof path !== 'string' || !path || path.includes('..') || path.startsWith('/')) throw new Error('reader_scope');
      const { data } = await invoke('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path, ref });
      if (!data || Array.isArray(data) || data.type !== 'file' || data.path !== path || data.encoding !== 'base64' || typeof data.content !== 'string') throw new Error('invalid_file_shape');
      const encoded = data.content.replace(/[\r\n]/g, '');
      const bytes = Buffer.from(encoded, 'base64');
      if (bytes.toString('base64') !== encoded || bytes.length > 2 * 1024 * 1024) throw new Error('invalid_file_encoding_or_size');
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('invalid_file_utf8'); }
      if (!Buffer.from(text).equals(bytes)) throw new Error('invalid_file_roundtrip');
      return { text, metadata: { sdk: '@octokit/rest@22.0.1', git_blob_sha: data.sha ?? null,
        native_response: data,
        native_request: { route: 'GET /repos/{owner}/{repo}/contents/{path}', owner, repo, path, ref } } };
    },
    async readRelease({ owner, repo, tag }) {
      target(owner, repo);
      if (tag !== TAG) throw new Error('reader_scope');
      const { data } = await invoke('GET /repos/{owner}/{repo}/releases/tags/{tag}', { owner, repo, tag });
      if (!data || data.tag_name !== tag || data.draft !== false) throw new Error('release_binding');
      return data;
    },
    readAsset: args => readPublicAsset(args),
  };
}

export async function readPublicAsset({ url, fetchImpl = fetch, maxBytes = 2 * 1024 * 1024 }) {
  const initial = /^https:\/\/github\.com\/OndCo\/Action-Effect-(?:Bench|Spec)\/releases\/download\/v0\.2\.0-draft\.1\/manuscript\.pdf$/;
  if (typeof url !== 'string' || !initial.test(url)) throw new Error('asset_scope');
  let current = url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const parsed = new URL(current);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port
      || !['github.com', 'release-assets.githubusercontent.com'].includes(parsed.hostname)) throw new Error('asset_redirect');
    const response = await fetchImpl(current, { redirect: 'manual', headers: { Accept: 'application/octet-stream' }, signal: AbortSignal.timeout(60000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('asset_redirect');
      current = new URL(location, current).href;
      await response.body?.cancel();
      continue;
    }
    if (!response.ok) throw new Error(`asset_http_${response.status}`);
    if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw new Error('asset_size'); }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('asset_size');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('asset_redirect_limit');
}

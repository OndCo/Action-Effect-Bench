import { decodeFileResult } from './native-mcp.mjs';
import { parseJSON } from './model-client.mjs';
import { digestBytes } from './artifacts.mjs';

function target(owner, repo) {
  if (owner !== 'OndCo' || !['Action-Effect-Bench', 'Action-Effect-Spec'].includes(repo)) throw new Error('reader_scope');
}

export function createNativeReader({ session }) {
  const call = session.call.bind(session);
  return {
    async readFile({ owner, repo, path, ref }) {
      target(owner, repo);
      if (!/^[a-f0-9]{40}$/.test(ref) || typeof path !== 'string' || !path || path.includes('..') || path.startsWith('/')) throw new Error('reader_scope');
      const args = { owner, repo, path, sha: ref };
      const result = await call('get_file_contents', args);
      const uri = `repo://${owner}/${repo}/sha/${ref}/contents/${path}`;
      const decoded = decodeFileResult(result, { uri });
      return { text: decoded.text, metadata: { transport: 'official-github-mcp-stdio', resource_uri: uri,
        native_request: { name: 'get_file_contents', arguments: args },
        native_response: result,
        native_response_sha256: digestBytes(JSON.stringify(result)) } };
    },
    async readRelease({ owner, repo, tag }) {
      target(owner, repo);
      if (tag !== 'v0.2.0-draft.1') throw new Error('reader_scope');
      const result = await call('get_release_by_tag', { owner, repo, tag });
      if (result.isError || !Array.isArray(result.content) || result.content.length !== 1 || result.content[0].type !== 'text') throw new Error('native_release_result');
      const data = parseJSON(result.content[0].text, 'native_release_result');
      if (!data || data.tag_name !== tag || data.draft !== false || data.html_url !== `https://github.com/${owner}/${repo}/releases/tag/${tag}`) throw new Error('release_binding');
      return data;
    },
    async readAsset() { throw new Error('native_asset_unsupported'); },
  };
}

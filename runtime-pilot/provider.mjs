import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Octokit } from '@octokit/rest';

const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');

export function safeGitHubUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.github.com' && !url.port
      && !url.username && !url.password && !url.hash;
  } catch { return false; }
}

export function receiptFrom(comment, expected, principal, expectedId) {
  const base = `https://api.github.com/repos/${expected.owner}/${expected.repo}/issues`;
  const matches = Number.isSafeInteger(comment?.id) && comment.id > 0
    && (expectedId === undefined || comment.id === expectedId)
    && comment.url === `${base}/comments/${comment.id}`
    && comment.issue_url === `${base}/${expected.issue_number}`
    && comment.body === expected.body && comment.user?.login === principal;
  return { comment_id: Number.isSafeInteger(comment?.id) ? comment.id : null,
    url: typeof comment?.html_url === 'string' && comment.html_url.startsWith('https://github.com/') ? comment.html_url : null,
    api_url: typeof comment?.url === 'string' && safeGitHubUrl(comment.url) ? comment.url : null,
    issue_url: typeof comment?.issue_url === 'string' && safeGitHubUrl(comment.issue_url) ? comment.issue_url : null,
    body_sha256: typeof comment?.body === 'string' ? hash(comment.body) : null,
    body_bytes: typeof comment?.body === 'string' ? Buffer.byteLength(comment.body) : null,
    actor: typeof comment?.user?.login === 'string' ? comment.user.login : null,
    created_at: typeof comment?.created_at === 'string' ? comment.created_at : null,
    updated_at: typeof comment?.updated_at === 'string' ? comment.updated_at : null,
    content_matches: Boolean(matches), observation: 'fresh-current-content-not-complete-provider-provenance' };
}

export function githubProvider() {
  // Credentials stay in memory. Neither command arguments nor evidence contain them.
  const token = execFileSync('gh', ['auth', 'token', '--hostname', 'github.com'],
    { encoding: 'utf8', maxBuffer: 16384, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!token) throw new Error('github_auth_unavailable');
  const client = new Octokit({ auth: token, userAgent: 'action-effect-controlled-pilot/0.2',
    log: { debug() {}, info() {}, warn() {}, error() {} },
    request: { timeout: 15000, fetch: (url, init) => {
      if (!safeGitHubUrl(String(url))) throw new Error('unexpected_provider_endpoint');
      return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
    } } });
  const headers = { 'X-GitHub-Api-Version': '2022-11-28' };
  return {
    async principal() { return (await client.users.getAuthenticated({ headers })).data.login; },
    async readIssue(params) { return (await client.issues.get({ owner: params.owner, repo: params.repo, issue_number: params.issue_number, headers })).data; },
    async createComment(params) { return (await client.issues.createComment({ ...params, headers })).data; },
    async readComment(params, id) {
      return (await client.issues.getComment({ owner: params.owner, repo: params.repo, comment_id: id, headers })).data;
    },
    async listComments(params) {
      // The dedicated issue is bounded; do not silently inspect only page one.
      const comments = [];
      for (let page = 1; page <= 5; page += 1) {
        const response = await client.issues.listComments({ owner: params.owner, repo: params.repo,
          issue_number: params.issue_number, per_page: 100, page, headers });
        comments.push(...response.data);
        if (response.data.length < 100) return comments;
      }
      throw new Error('readback_pagination_limit');
    }
  };
}

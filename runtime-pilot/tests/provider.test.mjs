import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptFrom, safeGitHubUrl } from '../provider.mjs';

test('provider URLs are HTTPS GitHub API only and do not admit credentials or redirects', () => {
  assert.equal(safeGitHubUrl('https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/1/comments'), true);
  for (const value of ['http://api.github.com/foo', 'https://api.github.com.evil.test/foo',
    'https://user@api.github.com/foo', 'https://api.github.com:8443/foo', 'file:///tmp/x']) {
    assert.equal(safeGitHubUrl(value), false);
  }
});

test('readback requires expected repository issue body and actor, not just a returned ID', () => {
  const expected = { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 1, body: 'synthetic' };
  const comment = { id: 123, body: 'synthetic', user: { login: 'fixture-user' },
    url: 'https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/comments/123',
    issue_url: 'https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/1',
    html_url: 'https://github.com/OndCo/Action-Effect-Bench/issues/1#issuecomment-123',
    created_at: '2026-10-19T00:00:00Z', updated_at: '2026-10-19T00:00:00Z' };
  assert.equal(receiptFrom(comment, expected, 'fixture-user').content_matches, true);
  assert.equal(receiptFrom({ ...comment, body: 'changed' }, expected, 'fixture-user').content_matches, false);
  assert.equal(receiptFrom({ ...comment, issue_url: comment.issue_url.replace('/1', '/2') }, expected, 'fixture-user').content_matches, false);
  assert.equal(receiptFrom(comment, expected, 'other-user').content_matches, false);
});

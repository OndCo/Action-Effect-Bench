import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMcpAction } from '../mcp-client.mjs';

test('official MCP transport performs initialize, tools/list and tools/call without provider access', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'effect-mcp-'));
  const configFile = join(dir, 'config.json');
  writeFileSync(configFile, JSON.stringify({ mode: 'offline-map', strategy: 'protocol', context: {
    principal: 'fixture-user', data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' } }));
  try {
    const result = await runMcpAction(configFile, { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 1, body: 'Synthetic transport probe' });
    assert.equal(result.server.name, 'action-effect-comment-pilot');
    assert.equal(result.result.status, 'accepted_partial');
    assert.equal(result.result.authority, 'not_evaluated');
    assert.equal(result.tools[0], 'add_issue_comment');
    assert.ok(result.transport_total_ms > 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('MCP input schema does not strip an extra URL into an accepted operation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'effect-mcp-'));
  const configFile = join(dir, 'config.json');
  writeFileSync(configFile, JSON.stringify({ mode: 'offline-map', strategy: 'protocol', context: {
    principal: 'fixture-user', data_class: 'synthetic-public', implementation: 'github-comment-bridge/1' } }));
  try {
    const result = await runMcpAction(configFile, { owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number: 1, body: 'Test', url: 'https://example.org' });
    assert.equal(result.result.status, 'transport_failure');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseStrict } from '../../action-effect-spec/implementations/javascript/strict-json.mjs';
import { prepareAction, executeAction } from './gate.mjs';
import { githubProvider } from './provider.mjs';

export async function serve(configFile) {
  const config = parseStrict(readFileSync(configFile));
  if (!['offline-map', 'live'].includes(config.mode) || !['protocol', 'structured'].includes(config.strategy)) {
    throw new Error('invalid_server_configuration');
  }
  const provider = config.mode === 'live' ? githubProvider() : null;
  let discarded = false;
  if (provider && config.inject_lost_ack === true) {
    const actualCreate = provider.createComment;
    provider.createComment = async params => { await actualCreate(params); discarded = true; throw new Error('controlled_lost_ack'); };
  }
  const server = new McpServer({ name: 'action-effect-comment-pilot', version: '0.2.0-draft.1' }, { maxToolInputElements: 32 });
  server.registerTool('add_issue_comment', {
    description: 'Create one synthetic comment on an explicitly authorized test issue. Requires a current local policy decision.',
    inputSchema: z.strictObject({ owner: z.string(), repo: z.string(), issue_number: z.number().int(), body: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, async args => {
    const native = { lane: 'mcp', call: { name: 'add_issue_comment', arguments: args } };
    const result = config.mode === 'offline-map' ? prepareAction(native, config.context, config.strategy)
      : await executeAction({ native, context: config.context, strategy: config.strategy, provider,
        policyFile: config.policy_file, ledgerDir: config.ledger_dir, occurrence: config.occurrence,
        preparedDescription: config.prepared_description });
    if (config.inject_lost_ack === true) result.fault = { successful_post_ack_discarded: discarded };
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });
  await server.connect(new StdioServerTransport());
  return server;
}

function isMain() {
  try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}
if (isMain()) {
  if (process.argv.length !== 4 || process.argv[2] !== '--config') {
    process.stderr.write('usage: mcp-server.mjs --config FILE\n'); process.exitCode = 2;
  } else serve(process.argv[3]).catch(() => { process.stderr.write('server_configuration_failure\n'); process.exitCode = 1; });
}

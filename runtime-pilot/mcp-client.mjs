import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

export async function runMcpAction(configFile, params) {
  const started = performance.now();
  const client = new Client({ name: 'action-effect-pilot-client', version: '0.2.0' });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('./mcp-server.mjs', import.meta.url)), '--config', configFile], stderr: 'pipe', maxBufferSize: 2 * 1024 * 1024 });
  let stderrBytes = 0;
  transport.stderr?.on('data', chunk => { stderrBytes += chunk.length; });
  let server = {}, tools = [], result;
  try {
    await client.connect(transport, { timeout: 15000 });
    server = client.getServerVersion() ?? {};
    const listed = await client.listTools();
    tools = listed.tools.map(tool => tool.name);
    const response = await client.callTool({ name: 'add_issue_comment', arguments: params }, undefined, { timeout: 60000 });
    if (response.isError || response.content?.length !== 1 || response.content[0].type !== 'text') {
      result = { status: 'transport_failure', reason: 'mcp_tool_rejected', authority: 'not_evaluated' };
    } else {
      // This is an instrumentation envelope with fractional millisecond timers,
      // not the effect-description canonicalization subset checked by Python.
      result = JSON.parse(response.content[0].text);
      if (!result || typeof result !== 'object' || Array.isArray(result)
        || (typeof result.status !== 'string' && typeof result.outcome !== 'string')) throw new Error('invalid_server_result');
    }
  } catch {
    result = { status: 'transport_failure', reason: 'mcp_failure', authority: 'not_evaluated' };
  } finally { await client.close().catch(() => {}); }
  return { result, server, tools, stderr_bytes: stderrBytes, transport_total_ms: performance.now() - started };
}

#!/usr/bin/env node
/**
 * Smoke test for the Athlete OS connector. Talks to a running server the same
 * way Claude does (JSON-RPC over HTTP) and prints what each tool returns.
 *
 *   npm run test:mcp                               local server from "npm run mcp:dev"
 *   node scripts/test-mcp.mjs https://.../api/mcp/KEY   the deployed one
 *
 * Exit code is 0 only if the server answers initialize + tools/list and every
 * tool call either succeeds or fails for a clearly reported reason.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) { try { process.loadEnvFile(path.join(ROOT, f)); } catch { /* optional */ } }

const key = process.env.MCP_ACCESS_KEY || 'local-dev-key';
const url = process.argv[2] || `http://localhost:${process.env.MCP_PORT || 8787}/api/mcp/${key}`;

let nextId = 1;
async function rpc(method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${text.slice(0, 200)}`);
  // JSON mode returns plain JSON; SSE mode wraps it in "data:" lines
  const line = text.startsWith('event:') || text.startsWith('data:')
    ? text.split('\n').find((l) => l.startsWith('data:')).slice(5)
    : text;
  const msg = JSON.parse(line);
  if (msg.error) throw new Error(`${method}: ${msg.error.message}`);
  return msg.result;
}

let failed = false;
function show(label, value) { console.log(`\n== ${label}\n${value}`); }

try {
  const init = await rpc('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test-mcp', version: '0' },
  });
  show('initialize', `server: ${init.serverInfo.name} v${init.serverInfo.version}`);

  const { tools } = await rpc('tools/list', {});
  show('tools/list', tools.map((t) => `- ${t.name}: ${t.description.slice(0, 70)}...`).join('\n'));

  const calls = [
    ['get_recent_workouts', { days: 14 }],
    ['get_exercise_history', { exercise: 'bench', sessions: 3 }],
    ['get_food_log', { days: 3 }],
    ['get_weight_log', { days: 30 }],
  ];
  for (const [name, args] of calls) {
    const r = await rpc('tools/call', { name, arguments: args });
    const text = r.content?.[0]?.text || '';
    if (r.isError) {
      console.log(`\n== ${name} -> tool reported an error:\n${text}`);
      // Missing credentials is expected until the env vars are set; anything else is a failure
      if (!/not set in the environment|sign-in failed/.test(text)) failed = true;
    } else {
      show(name, text.length > 900 ? `${text.slice(0, 900)}... (${text.length} chars)` : text);
    }
  }
} catch (err) {
  console.error(`\nFAILED: ${err.message}`);
  failed = true;
}

process.exitCode = failed ? 1 : 0;

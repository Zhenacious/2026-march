#!/usr/bin/env node
/**
 * Runs the Athlete OS connector (api/mcp.js) on your own computer so it
 * can be tested without deploying. Reads the same variables from
 * fitness-tracker/.env that Vercel reads from its environment settings.
 *
 *   npm run mcp:dev            starts on http://localhost:8787
 *   npm run test:mcp           (in another window) calls every tool
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) { try { process.loadEnvFile(path.join(ROOT, f)); } catch { /* optional */ } }

if (!process.env.MCP_ACCESS_KEY) {
  process.env.MCP_ACCESS_KEY = 'local-dev-key';
  console.log('MCP_ACCESS_KEY not set; using "local-dev-key" for this run.');
}

const { default: handler } = await import(pathToFileURL(path.join(ROOT, 'api', 'mcp.js')).href);
const PORT = Number(process.env.MCP_PORT || 8787);

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : undefined); } catch { resolve(undefined); }
    });
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const m = url.pathname.match(/^\/api\/mcp\/([^/]+)$/);
  if (!m) {
    res.statusCode = 404;
    res.end('Use /api/mcp/<key>');
    return;
  }
  // Mimic what Vercel gives a function: req.query for the dynamic segment and a parsed body
  req.query = { key: decodeURIComponent(m[1]) };
  req.body = await readJson(req);
  try {
    await handler(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
}).listen(PORT, () => {
  console.log(`FitTrack MCP running at http://localhost:${PORT}/api/mcp/${process.env.MCP_ACCESS_KEY}`);
});

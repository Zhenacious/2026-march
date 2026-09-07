// Athlete OS connector: a small, read-only MCP server that lets Claude (claude.ai
// or Claude Code) pull FitTrack data live from the database.
//
// URL shape:  https://<your-fittrack-domain>/api/mcp/<MCP_ACCESS_KEY>
//
// The key in the path is the only thing standing between the internet and your
// training data, so it is generated once (long and random) and stored only in
// Vercel's environment variables. A wrong key gets a plain 404 so scanners see
// nothing interesting. Every tool only reads; there is no write path at all.

import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  getRecentWorkouts, getExerciseHistory, getFoodLog, getWeightLog,
} from '../_athleteData.js';

function keyMatches(given) {
  const expected = process.env.MCP_ACCESS_KEY || '';
  if (!expected || !given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Wraps a data function so the tool returns JSON text, or a readable error.
function tool(fn) {
  return async (args) => {
    try {
      const result = await fn(args || {});
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: `FitTrack error: ${err.message}` }] };
    }
  };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

function buildServer() {
  const server = new McpServer({ name: 'fittrack', version: '1.0.0' });

  server.registerTool('get_recent_workouts', {
    title: 'Recent workouts',
    description:
      'Lifting/cardio sessions from the last N days (default 14), newest first. ' +
      'Each session lists exercises with their sets as compact strings like "85x5" ' +
      '(kg x reps), "BWx12" (bodyweight), "5km / 25:00", plus best estimated 1RM and volume.',
    inputSchema: { days: z.number().int().min(1).max(365).optional().describe('How many days back to look (default 14)') },
    annotations: READ_ONLY,
  }, tool(getRecentWorkouts));

  server.registerTool('get_exercise_history', {
    title: 'Exercise history',
    description:
      'Session-by-session history for one exercise (e.g. "Bench Press"), newest first, with ' +
      'the all-time best set by estimated 1RM. Partial names are matched; if several ' +
      'exercises match you get the list back to choose from.',
    inputSchema: {
      exercise: z.string().min(2).describe('Exercise name or part of it'),
      sessions: z.number().int().min(1).max(100).optional().describe('How many recent sessions to return (default 10)'),
    },
    annotations: READ_ONLY,
  }, tool(getExerciseHistory));

  server.registerTool('get_food_log', {
    title: 'Food log',
    description:
      'Food and calorie log for the last N days (default 7): per-day totals of calories, ' +
      'protein, carbs and fat, every entry by meal, the period average, and the calorie/protein goals.',
    inputSchema: { days: z.number().int().min(1).max(365).optional().describe('How many days back to look (default 7)') },
    annotations: READ_ONLY,
  }, tool(getFoodLog));

  server.registerTool('get_weight_log', {
    title: 'Body weight log',
    description:
      'Body weight entries (kg) for the last N days (default 90), newest first, with the latest ' +
      'value, the change over the period and a 7-day average.',
    inputSchema: { days: z.number().int().min(1).max(3650).optional().describe('How many days back to look (default 90)') },
    annotations: READ_ONLY,
  }, tool(getWeightLog));

  return server;
}

export default async function handler(req, res) {
  if (!keyMatches(String(req.query?.key || ''))) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Stateless: a fresh server + transport per request, which suits serverless.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => { transport.close(); server.close(); });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

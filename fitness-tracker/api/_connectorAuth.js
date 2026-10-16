// Turns the key in a connector link (/api/mcp/<key>) into the FitTrack user it
// belongs to. Keys are stored only as SHA-256 hashes in connector_keys, which
// users manage from the Connect to Claude page.
//
// Uses the service-role key, which bypasses row-level security, because the
// request carries no user login. That is why every query in _connectorData.js
// filters to the userId returned here. Server only: never import from src/.

import { createClient } from '@supabase/supabase-js';
import { isConnectorKey, hashConnectorKey } from '../src/lib/connectorKey.js';

let serviceClient = null;

function getServiceClient() {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  // Values pasted into a dashboard often pick up stray spaces or quote marks
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in the environment.');
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return serviceClient;
}

// Returns { client, userId } for a valid, active key, otherwise null.
export async function resolveConnectorUser(key) {
  if (!isConnectorKey(key)) return null;
  const client = getServiceClient();
  const { data, error } = await client
    .from('connector_keys')
    .select('user_id')
    .eq('key_hash', await hashConnectorKey(key))
    .maybeSingle();
  if (error) throw new Error(`Connector key lookup failed: ${error.message}`);
  return data ? { client, userId: data.user_id } : null;
}

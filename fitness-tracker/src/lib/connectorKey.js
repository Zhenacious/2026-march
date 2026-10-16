// Personal Claude connector keys. Used by the Connect to Claude page (to make
// a key) and by api/mcp.js (to check one). Only the SHA-256 hash of a key is
// ever stored, so a database leak does not leak working links.
//
// Uses Web Crypto, which exists in every browser and in Node 20+, so this one
// file works on both sides. Do not import Supabase here.

const PREFIX = 'ft_';
const KEY_PATTERN = /^ft_[A-Za-z0-9_-]{43}$/;

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 32 random bytes -> "ft_" + 43 base64url characters
export function generateConnectorKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return PREFIX + toBase64Url(bytes);
}

export function isConnectorKey(value) {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

export async function hashConnectorKey(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function connectorUrl(origin, key) {
  return `${String(origin).replace(/\/+$/, '')}/api/mcp/${key}`;
}

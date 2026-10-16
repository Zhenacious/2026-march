// Checks the connector key helpers shared by the Connect to Claude page and
// the MCP endpoint. Pure, no database. Run: node scripts/test-connector-key.mjs
import {
  generateConnectorKey, hashConnectorKey, isConnectorKey, connectorUrl,
} from '../src/lib/connectorKey.js';

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`}`);
  if (!ok) failed++;
}

const a = generateConnectorKey();
const b = generateConnectorKey();
check('key has the ft_ prefix and 43 base64url chars', /^ft_[A-Za-z0-9_-]{43}$/.test(a), true);
check('two keys are different', a === b, false);
check('a generated key passes the format check', isConnectorKey(a), true);
check('the old env-style key is rejected', isConnectorKey('abc123'), false);
check('wrong prefix is rejected', isConnectorKey(`xx_${a.slice(3)}`), false);
check('too short is rejected', isConnectorKey(a.slice(0, -1)), false);
check('non-string is rejected', isConnectorKey(undefined), false);

// Known SHA-256 vector so browser and server provably agree
check('hash of "abc" matches the standard SHA-256',
  await hashConnectorKey('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
check('hashing is stable', await hashConnectorKey(a), await hashConnectorKey(a));
check('different keys hash differently', (await hashConnectorKey(a)) === (await hashConnectorKey(b)), false);

check('url joins origin and key', connectorUrl('https://x.app', 'ft_k'), 'https://x.app/api/mcp/ft_k');
check('url drops a trailing slash on origin', connectorUrl('https://x.app/', 'ft_k'), 'https://x.app/api/mcp/ft_k');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exitCode = failed ? 1 : 0;

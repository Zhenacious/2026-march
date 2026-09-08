// Checks that fetchAllRows keeps asking for pages until it has every row.
// Uses a fake query so it needs no database. Run: node scripts/test-fetch-all.mjs
import { fetchAllRows } from '../src/lib/fetchAll.js';

function fakeTable(total) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const calls = [];
  const make = () => ({
    order() { return this; },
    async range(from, to) { calls.push([from, to]); return { data: rows.slice(from, to + 1), error: null }; },
  });
  return { make, calls };
}

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`}`);
  if (!ok) failed++;
}

for (const [total, expectedCalls] of [[0, 1], [999, 1], [1000, 2], [1001, 2], [4681, 5]]) {
  const t = fakeTable(total);
  const rows = await fetchAllRows(t.make);
  check(`${total} rows: gets all of them`, rows.length, total);
  check(`${total} rows: uses ${expectedCalls} request(s)`, t.calls.length, expectedCalls);
}

process.exitCode = failed ? 1 : 0;

// Manual API test for name search: node scripts/test-food-search.mjs
// FatSecret results only appear when FATSECRET_CLIENT_ID/SECRET are set.
import handler from '../api/food-search.js';

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const queries = ['tim tam', 'weet-bix', 'vegemite', 'anchor milk', '老干妈', 'a'];

for (const q of queries) {
  const res = makeRes();
  await handler({ method: 'GET', query: { q } }, res);
  if (res.statusCode !== 200) {
    console.log(`--- "${q}" -> ${res.statusCode} ${JSON.stringify(res.body)}`);
    continue;
  }
  const rs = res.body.results;
  console.log(`--- "${q}" -> ${rs.length} results`);
  rs.slice(0, 3).forEach((f) => {
    console.log(`    [${f.source}] ${f.name}${f.brand ? ` (${f.brand})` : ''}`
      + ` — ${f.calories} kcal / ${f.serving_size}`
      + `${f.per_100g ? ` · per100g ${f.per_100g.calories}` : ' · no per-100g'}`);
  });
}

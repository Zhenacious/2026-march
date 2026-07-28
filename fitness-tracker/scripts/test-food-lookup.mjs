// Manual API test: node scripts/test-food-lookup.mjs (run from fitness-tracker/)
import handler from '../api/food-lookup.js';

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const cases = [
  ['3017620422003', 'Nutella — expect per_100g and serving_grams'],
  ['5449000000996', 'Coca-Cola EAN-13'],
  ['016000275270', 'Cheerios 12-digit UPC'],
  ['0000000000000', 'expect 404'],
];
for (const [barcode, label] of cases) {
  const res = makeRes();
  await handler({ method: 'GET', query: { barcode } }, res);
  console.log(`--- ${label} (${barcode}) -> ${res.statusCode}`);
  console.log(JSON.stringify(res.body));
}

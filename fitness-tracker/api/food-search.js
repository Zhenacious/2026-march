import { searchOFF, searchFatSecret } from './_foodSources.js';

// Searches foods by name across every configured source, so products without a
// scannable barcode (or missing from one database) can still be logged.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = String(req.query.q || '').trim();
  if (query.length < 2) {
    return res.status(400).json({ error: 'q required (at least 2 characters)' });
  }

  try {
    // Both sources in parallel; a failure in one just yields no results from it
    const [off, fatsecret] = await Promise.all([
      searchOFF(query).catch(() => []),
      searchFatSecret(query).catch(() => []),
    ]);

    // Interleave so neither source dominates the top of the list
    const results = [];
    for (let i = 0; i < Math.max(off.length, fatsecret.length); i++) {
      if (fatsecret[i]) results.push(fatsecret[i]);
      if (off[i]) results.push(off[i]);
    }

    // Drop near-duplicates (same name + brand from two sources)
    const seen = new Set();
    const deduped = results.filter((f) => {
      const key = `${f.name}|${f.brand}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.status(200).json({ results: deduped.slice(0, 20) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

import { lookupOFF, lookupFatSecret, lookupUSDA } from './_foodSources.js';

// Looks up nutrition info for a product barcode. Sources are tried in order and
// each one is optional, so this keeps working when a key is missing.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const barcode = String(req.query.barcode || '').trim();
  if (!/^\d{8,14}$/.test(barcode)) {
    return res.status(400).json({ error: 'barcode required (8-14 digits)' });
  }

  const attempts = [
    () => lookupOFF(barcode),
    // US/AU scanners often read 12-digit UPC-A while databases store the
    // 13-digit zero-padded EAN form
    () => (barcode.length === 12 ? lookupOFF('0' + barcode) : null),
    () => lookupFatSecret(barcode),
    () => lookupUSDA(barcode),
  ];

  try {
    for (const attempt of attempts) {
      let result = null;
      try {
        result = await attempt();
      } catch {
        result = null; // one source being down must not kill the request
      }
      if (result) return res.status(200).json(result);
    }
    return res.status(404).json({ error: 'Product not found' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

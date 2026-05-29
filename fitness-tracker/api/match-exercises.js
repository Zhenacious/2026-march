import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Given a user's existing exercise names and a list of candidate starter
// exercises, returns the subset of candidates the user does NOT already have —
// accounting for abbreviations, plurals and reworded duplicates (e.g. a user
// with "BB Bench" should NOT be offered "Barbell Bench Press" again).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { existing, candidates } = req.body;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: 'candidates array required' });
  }

  // No existing exercises means nothing to dedupe against — everything is new.
  if (!Array.isArray(existing) || existing.length === 0) {
    return res.status(200).json({ toAdd: candidates });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `A user has a personal gym exercise library. I want to add starter exercises they are missing, WITHOUT creating duplicates.

The user already has these exercises:
${existing.join('\n')}

Here are candidate starter exercises:
${candidates.join('\n')}

Return ONLY the candidate exercises the user does NOT already have. Treat exercises as the same if they refer to the same movement, even when worded differently (abbreviations like "BB"/"DB", plurals, extra/missing words, different order). When in doubt that two refer to the same movement, treat them as duplicates and exclude the candidate.

Rules:
- Reply ONLY with a JSON array of strings.
- Each string must be a candidate name copied EXACTLY as written in the candidate list above.
- Do not include any candidate that matches an existing exercise.
- No explanation, just the JSON array.`,
        },
      ],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error('Response was not an array');

    // Only trust names that actually exist in the candidate list.
    const allowed = new Set(candidates);
    const toAdd = parsed.filter((name) => allowed.has(name));

    return res.status(200).json({ toAdd });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

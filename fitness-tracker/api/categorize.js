import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { exercises } = req.body;
  if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({ error: 'exercises array required' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Categorize each of these gym exercises into exactly one of these categories:
chest, back, shoulders, biceps, triceps, legs, abs, mobility

Rules:
- Reply ONLY with a JSON object mapping exercise name to category
- Use lowercase category names exactly as listed above
- If unsure, pick the closest match
- No explanation, just JSON

Exercises:
${exercises.join('\n')}`,
        },
      ],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export const dynamic = 'force-dynamic';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function POST(request) {
  try {
    const { tables } = await request.json();

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return new Response(JSON.stringify({ error: 'tables array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const conversions = await Promise.all(
      tables.map(async (table) => {
        const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: 'Convert tables to natural spoken prose. Describe data conversationally. Use transitions between rows. Don\'t say "the table shows." No bullets, lists, or markdown. Plain text only. Keep concise.',
              }],
            },
            contents: [{
              parts: [{ text: table }],
            }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (!res.ok) {
          console.error('Gemini API error:', res.status);
          return table; // fallback to original
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || table; // fallback if no output
      })
    );

    return new Response(JSON.stringify({ conversions }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Preprocess API error:', err.message);
    return new Response(JSON.stringify({ error: 'Preprocessing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

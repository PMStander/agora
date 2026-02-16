const GEMINI_MODEL = 'gemini-embedding-001';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OUTPUT_DIMENSIONALITY = 768; // Match entity_embeddings vector(768) column

interface GeminiEmbedResponse {
  embedding: {
    values: number[];
  };
}

async function callGeminiEmbed(text: string, taskType: string): Promise<number[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // Truncate to ~8000 chars to stay within Gemini's token limit
  const truncated = text.slice(0, 8000);

  const response = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: { parts: [{ text: truncated }] },
        taskType,
        outputDimensionality: OUTPUT_DIMENSIONALITY,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data: GeminiEmbedResponse = await response.json();
  return data.embedding.values;
}

export async function generateDocumentEmbedding(text: string): Promise<number[]> {
  return callGeminiEmbed(text, 'RETRIEVAL_DOCUMENT');
}

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  return callGeminiEmbed(text, 'RETRIEVAL_QUERY');
}

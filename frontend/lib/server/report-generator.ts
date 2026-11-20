/**
 * Generate plain-English neighbourhood reports via Groq API.
 * Port of pipeline/report_generator.py.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "qwen/qwen3.8-27b";

const SYSTEM_PROMPT = `You write neighbourhood guides for homebuyers in Bangalore, India.
Output exactly ONE continuous paragraph of plain English, 120–160 words.
Be factual, balanced, and practical — mention strengths and weaknesses.
Do not use bullet points, headers, markdown, or titles.
Do not invent data beyond what is provided.
Reply with the paragraph only.`;

function buildUserPrompt(score: Record<string, unknown>): string {
  const locality = (score.locality as string) ?? "this locality";
  return `Write a 120–160 word neighbourhood report for a homebuyer considering ${locality}, Bangalore.

Score data:
${JSON.stringify(score, null, 2)}

Cover in one paragraph: overall neighbourhood score, RERA/developer track record (complaints), nearby amenities (hospitals, schools, parks, metro within 3km), and a balanced recommendation.`;
}

export async function generateReport(
  score: Record<string, unknown>,
  apiKey: string,
): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(score) },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string | null; reasoning?: string | null };
    }>;
  };
  const message = data.choices?.[0]?.message;
  const content = (message?.content ?? "").trim();
  if (content) return content;

  // Some models put text only in reasoning — use it as a last resort.
  const reasoning = (message?.reasoning ?? "").trim();
  if (reasoning) {
    const para = reasoning.match(
      /(?:Indiranagar|Koramangala|[A-Z][a-zA-Z .'-]+)\s+(?:is|sits|offers|stands|remains|presents)[\s\S]{80,}/,
    );
    if (para) return para[0].trim();
  }

  return "";
}

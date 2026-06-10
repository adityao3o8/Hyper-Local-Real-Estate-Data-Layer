/**
 * Generate plain-English neighbourhood reports via Groq API.
 * Port of pipeline/report_generator.py.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You write concise neighbourhood guides for homebuyers in Bangalore, India.
Given structured score data (RERA complaints, nearby amenities), write exactly one paragraph
of plain English, approximately 150 words. Be factual, balanced, and practical — mention
strengths and weaknesses. Do not use bullet points, headers, or markdown. Do not invent
data beyond what is provided.`;

function buildUserPrompt(score: Record<string, unknown>): string {
  const locality = (score.locality as string) ?? "this locality";
  return `Write a ~150-word neighbourhood report for a homebuyer considering ${locality}, Bangalore.

Score data:
${JSON.stringify(score, null, 2)}

Cover: overall score, RERA/developer track record (complaints), nearby amenities (hospitals, schools, parks, metro within 3km), and a balanced recommendation.`;
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
      max_tokens: 400,
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
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

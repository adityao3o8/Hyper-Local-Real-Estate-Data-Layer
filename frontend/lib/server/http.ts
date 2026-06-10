/** Tiny helpers so route handlers mirror FastAPI's HTTPException style. */

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function errorResponse(status: number, detail: string): Response {
  return Response.json({ detail }, { status });
}

export function handleException(err: unknown, fallbackStatus = 502): Response {
  if (err instanceof HttpError) return errorResponse(err.status, err.message);
  const detail = err instanceof Error ? err.message : String(err);
  return errorResponse(fallbackStatus, detail);
}

export function requireGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new HttpError(
      500,
      "GROQ_API_KEY not configured. Add it to your environment (.env.local or Vercel project settings).",
    );
  }
  return key;
}

export function requireSerpApiKey(): string {
  const key = process.env.SERPAPI_KEY || process.env.SERP_API_KEY;
  if (!key) {
    throw new HttpError(
      500,
      "SERPAPI_KEY not configured. Sign up at https://serpapi.com and add SERPAPI_KEY to your environment.",
    );
  }
  return key;
}

export function optionalSerpApiKey(): string | null {
  return process.env.SERPAPI_KEY || process.env.SERP_API_KEY || null;
}

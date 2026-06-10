/**
 * Fetch indicative property prices via SerpAPI (Google → MagicBricks snippets).
 * Port of pipeline/property_prices.py.
 */

const SERPAPI_URL = "https://serpapi.com/search.json";
const DEFAULT_SITE = "magicbricks.com";

export interface ParsedPrice {
  raw: string;
  amount_inr: number | null;
  unit: "total" | "per_sqft" | "unknown";
  source_title: string;
  source_link: string;
  snippet: string;
}

export interface PropertyPricesSummary {
  locality: string;
  query: string;
  source: string;
  price_mentions: Omit<ParsedPrice, "snippet">[];
  organic_results?: Array<{
    title: string | null;
    link: string | null;
    snippet: string | null;
  }>;
  total_price_inr?: PriceBand;
  per_sqft_inr?: PriceBand;
  error?: string;
}

interface PriceBand {
  min: number;
  max: number;
  median: number;
  sample_count: number;
}

interface PatternSpec {
  key: "per_sqft" | "per_sqft_rev" | "crore" | "lakh" | "rupees_large";
  regex: RegExp;
}

// Indian property price patterns — order matters (specific first).
const PRICE_PATTERNS: PatternSpec[] = [
  {
    key: "per_sqft",
    regex: /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:\/|per)\s*sq\.?\s*ft/gi,
  },
  {
    key: "per_sqft_rev",
    regex: /([\d,]+(?:\.\d+)?)\s*(?:\/|per)\s*sq\.?\s*ft/gi,
  },
  {
    key: "crore",
    regex:
      /(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)\s*(?:Cr|Crore|crores?)\b/gi,
  },
  {
    key: "lakh",
    regex: /(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)\s*(?:L|Lakh|Lac|lakhs?)\b/gi,
  },
  {
    key: "rupees_large",
    regex: /(?:₹|Rs\.?|INR)\s*([\d,]{7,}(?:\.\d+)?)\b/gi,
  },
];

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function toInr(amount: number, key: PatternSpec["key"]): number | null {
  if (key === "crore") return amount * 10_000_000;
  if (key === "lakh") return amount * 100_000;
  if (key === "per_sqft" || key === "per_sqft_rev" || key === "rupees_large") {
    return amount;
  }
  return null;
}

export function buildMagicbricksQuery(
  locality: string,
  site: string = DEFAULT_SITE,
): string {
  return `average property price ${locality.trim()} Bangalore site:${site}`;
}

function parsePricesFromText(
  text: string,
  sourceTitle = "",
  sourceLink = "",
): ParsedPrice[] {
  const found: ParsedPrice[] = [];
  const seen = new Set<string>();

  for (const { key, regex } of PRICE_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0].trim();
      if (seen.has(raw)) continue;
      seen.add(raw);
      const amount = parseAmount(match[1]);
      if (!Number.isFinite(amount)) continue;

      const unit: ParsedPrice["unit"] = key.includes("sq")
        ? "per_sqft"
        : key === "crore" || key === "lakh" || key === "rupees_large"
          ? "total"
          : "unknown";
      const inr = toInr(amount, key);

      found.push({
        raw,
        amount_inr: inr == null ? null : Math.round(inr * 100) / 100,
        unit,
        source_title: sourceTitle,
        source_link: sourceLink,
        snippet: text.slice(0, 500),
      });
    }
  }
  return found;
}

interface OrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerpResponse {
  organic_results?: OrganicResult[];
}

async function serpapiGoogleSearch(
  query: string,
  apiKey: string,
): Promise<SerpResponse> {
  const url = new URL(SERPAPI_URL);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");

  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`SerpAPI HTTP ${res.status}`);
  }
  return (await res.json()) as SerpResponse;
}

export async function fetchPropertyPrices(
  locality: string,
  apiKey: string,
  site: string = DEFAULT_SITE,
  maxResults = 10,
): Promise<PropertyPricesSummary> {
  const query = buildMagicbricksQuery(locality, site);
  const summary: PropertyPricesSummary = {
    locality,
    query,
    source: "serpapi_google_magicbricks",
    price_mentions: [],
  };

  let data: SerpResponse;
  try {
    data = await serpapiGoogleSearch(query, apiKey);
  } catch (exc) {
    summary.error = exc instanceof Error ? exc.message : String(exc);
    return summary;
  }

  const organic = (data.organic_results ?? []).slice(0, maxResults);
  summary.organic_results = organic.map((r) => ({
    title: r.title ?? null,
    link: r.link ?? null,
    snippet: r.snippet ?? null,
  }));

  const allPrices: ParsedPrice[] = [];
  for (const row of organic) {
    const title = row.title ?? "";
    const link = row.link ?? "";
    const snippet = row.snippet ?? "";
    const combined = `${title}. ${snippet}`;
    allPrices.push(...parsePricesFromText(combined, title, link));
  }

  const magicbricks = allPrices.filter((p) =>
    p.source_link.toLowerCase().includes("magicbricks"),
  );
  const pool = magicbricks.length ? magicbricks : allPrices;
  const dedupedRaw = new Set<string>();
  const deduped: ParsedPrice[] = [];
  for (const p of pool) {
    if (!dedupedRaw.has(p.raw)) {
      dedupedRaw.add(p.raw);
      deduped.push(p);
    }
  }

  summary.price_mentions = deduped.map(({ snippet: _snippet, ...rest }) => rest);

  const totals = deduped.filter(
    (p) => p.unit === "total" && p.amount_inr != null,
  );
  const perSqft = deduped.filter(
    (p) => p.unit === "per_sqft" && p.amount_inr != null,
  );

  if (totals.length) {
    summary.total_price_inr = bandFrom(totals.map((p) => p.amount_inr!));
  }
  if (perSqft.length) {
    summary.per_sqft_inr = bandFrom(perSqft.map((p) => p.amount_inr!));
  }

  return summary;
}

function bandFrom(amounts: number[]): PriceBand {
  const sorted = [...amounts].sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    sample_count: sorted.length,
  };
}

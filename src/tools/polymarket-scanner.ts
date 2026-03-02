import { withRetry } from "@/src/lib/retry";
import type { MarketCandidate } from "@/src/types";

const GAMMA_BASE_URL = "https://gamma-api.polymarket.com";

interface GammaMarket {
  conditionId: string;
  question: string;
  slug: string;
  outcomes: string; // JSON string: '["Yes","No"]'
  outcomePrices: string; // JSON string: '["0.55","0.45"]'
  clobTokenIds: string; // JSON string with token IDs
  volume: string | number;
  liquidity: string | number;
  endDate: string;
  active: boolean;
  closed: boolean;
  negRisk?: boolean;
}

interface GammaEvent {
  id: string;
  title: string;
  markets: GammaMarket[];
  negRisk: boolean;
}

function parseTokens(market: GammaMarket): Array<{ token_id: string; outcome: string; price: number }> {
  try {
    const outcomes: string[] = JSON.parse(market.outcomes || "[]");
    const prices: string[] = JSON.parse(market.outcomePrices || "[]");
    const tokenIds: string[] = JSON.parse(market.clobTokenIds || "[]");

    return outcomes.map((outcome, i) => ({
      token_id: tokenIds[i] ?? "",
      outcome,
      price: parseFloat(prices[i] ?? "0"),
    }));
  } catch {
    return [];
  }
}

function toNum(val: string | number): number {
  return typeof val === "string" ? parseFloat(val) || 0 : val ?? 0;
}

export async function fetchTrendingMarkets(limit = 50): Promise<MarketCandidate[]> {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    order: "volume",
    ascending: "false",
    limit: String(limit),
  });

  const data = await withRetry(
    async () => {
      const res = await fetch(`${GAMMA_BASE_URL}/events?${params}`);
      if (!res.ok) throw new Error(`Gamma API error: ${res.status} ${res.statusText}`);
      return res.json() as Promise<GammaEvent[]>;
    },
    { label: "fetch-trending-markets" }
  );

  const candidates: MarketCandidate[] = [];

  for (const event of data) {
    for (const market of event.markets ?? []) {
      if (market.closed || !market.active) continue;
      const tokens = parseTokens(market);
      if (tokens.length === 0) continue;

      candidates.push({
        conditionId: market.conditionId,
        question: market.question,
        slug: market.slug,
        tokens,
        volume: toNum(market.volume),
        liquidity: toNum(market.liquidity),
        endDate: market.endDate,
        negRisk: market.negRisk ?? event.negRisk ?? false,
      });
    }
  }

  return candidates;
}

export async function fetchMarketByCondition(conditionId: string): Promise<MarketCandidate | null> {
  const params = new URLSearchParams({ condition_id: conditionId });

  const data = await withRetry(
    async () => {
      const res = await fetch(`${GAMMA_BASE_URL}/markets?${params}`);
      if (!res.ok) throw new Error(`Gamma API error: ${res.status} ${res.statusText}`);
      return res.json() as Promise<GammaMarket[]>;
    },
    { label: `fetch-market-${conditionId}` }
  );

  if (!data || data.length === 0) return null;

  const m = data[0];
  const tokens = parseTokens(m);

  return {
    conditionId: m.conditionId,
    question: m.question,
    slug: m.slug,
    tokens,
    volume: toNum(m.volume),
    liquidity: toNum(m.liquidity),
    endDate: m.endDate ?? "",
    negRisk: m.negRisk ?? false,
  };
}

import { MarketCandidate } from "@/src/types";

export function scoreMarket(market: MarketCandidate): number {
  const volumeScore = normalizeLog(market.volume, 10_000, 10_000_000) * 0.3;
  const timeScore = scoreTimeToClose(market.endDate) * 0.25;
  const priceScore = scorePriceUncertainty(market.tokens) * 0.25;
  const liquidityScore = normalizeLog(market.liquidity, 1_000, 1_000_000) * 0.2;

  return volumeScore + timeScore + priceScore + liquidityScore;
}

export function filterMarkets(
  markets: MarketCandidate[],
  existingPositionIds: string[]
): MarketCandidate[] {
  const positionSet = new Set(existingPositionIds);
  const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;

  const filtered = markets.filter((m) => {
    if (positionSet.has(m.conditionId)) return false;
    if (new Date(m.endDate).getTime() < oneDayFromNow) return false;
    if (m.volume < 10_000) return false;
    return true;
  });

  filtered.sort((a, b) => scoreMarket(b) - scoreMarket(a));

  return filtered.slice(0, 10);
}

function normalizeLog(value: number, min: number, max: number): number {
  if (value <= 0) return 0;
  const logVal = Math.log10(value);
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  return Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin)));
}

function scoreTimeToClose(endDate: string): number {
  const daysUntilClose =
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilClose < 1 || daysUntilClose > 90) return 0;

  // Sweet spot: 2-30 days, peak around 7-14 days
  if (daysUntilClose >= 2 && daysUntilClose <= 30) {
    // Peak at ~10 days
    const peak = 10;
    const distance = Math.abs(daysUntilClose - peak) / peak;
    return Math.max(0, 1 - distance * 0.5);
  }

  // 1-2 days or 30-90 days: partial score
  if (daysUntilClose < 2) return (daysUntilClose - 1) * 0.5;
  return Math.max(0, 1 - (daysUntilClose - 30) / 60);
}

function scorePriceUncertainty(
  tokens: Array<{ token_id: string; outcome: string; price: number }>
): number {
  // Find the YES token price (or use the first token)
  const yesToken = tokens.find((t) => t.outcome === "Yes") ?? tokens[0];
  if (!yesToken) return 0;

  const price = yesToken.price;
  // Most interesting near 0.3-0.7 (uncertain outcomes)
  // Peak at 0.5
  if (price >= 0.3 && price <= 0.7) {
    const distFromCenter = Math.abs(price - 0.5);
    return 1 - distFromCenter * 2.5; // 1.0 at 0.5, 0.5 at 0.3/0.7
  }

  // Outside sweet spot: rapid falloff
  if (price < 0.3) return Math.max(0, price / 0.3 * 0.5);
  return Math.max(0, (1 - price) / 0.3 * 0.5);
}

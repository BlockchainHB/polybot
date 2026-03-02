import { NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com/events";

function parseArr(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") ?? "20";
  const order = searchParams.get("order") ?? "volume24hr";
  const gammaOrder = order === "createdAt" ? "created_at" : order;

  const res = await fetch(
    `${GAMMA_API}?active=true&closed=false&limit=${limit}&order=${gammaOrder}&ascending=false`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Gamma API error: ${res.status}` }, { status: 502 });
  }

  const events: any[] = await res.json();

  const mapped = events
    .filter((e) => e.markets?.length > 0)
    .map((e) => {
      const allMarkets: any[] = e.markets;
      const primary = allMarkets[0];
      const isMulti = allMarkets.length > 1;

      // For multi-outcome events, build the top outcomes list
      const topOutcomes = isMulti
        ? allMarkets
            .map((m: any) => {
              const prices = parseArr(m.outcomePrices).map(Number);
              const q: string = m.question ?? "";
              // Try to get a clean label
              const label =
                m.groupItemTitle ||
                q.replace(/^Will\s+/i, "")
                  .replace(/\s+win\s+the\s+.*$/i, "")
                  .replace(/\s+win\s+on\s+.*$/i, "")
                  .replace(/\s+win\s+.*$/i, "")
                  .replace(/\?$/, "")
                  .trim();
              return {
                label,
                question: q,
                price: prices[0] ?? 0,
                volume: m.volumeNum ?? parseFloat(m.volume ?? "0"),
              };
            })
            .sort((a: any, b: any) => b.price - a.price)
            .slice(0, 6)
        : [];

      // For binary, parse the primary market's outcomes
      const pPrices = parseArr(primary.outcomePrices).map(Number);

      return {
        id: e.id,
        conditionId: primary.conditionId,
        question: e.title || primary.question,
        slug: e.slug || primary.slug,
        description: (e.description ?? "").slice(0, 300),
        image: e.image || primary.image || "",

        isMulti,
        marketCount: allMarkets.length,
        yesPrice: isMulti ? null : (pPrices[0] ?? null),
        noPrice: isMulti ? null : (pPrices[1] ?? null),
        topOutcomes,

        // Order book
        bestBid: primary.bestBid ?? null,
        bestAsk: primary.bestAsk ?? null,
        spread: primary.spread ?? null,
        lastTradePrice: primary.lastTradePrice ?? null,

        // Price changes
        oneHourPriceChange: primary.oneHourPriceChange ?? null,
        oneDayPriceChange: primary.oneDayPriceChange ?? null,
        oneWeekPriceChange: primary.oneWeekPriceChange ?? null,

        // Volume
        volume: e.volume ?? primary.volumeNum ?? 0,
        volume24hr: e.volume24hr ?? primary.volume24hr ?? 0,
        liquidity: e.liquidity ?? primary.liquidityNum ?? 0,

        // Dates
        endDate: e.endDate ?? primary.endDate ?? "",
        createdAt: e.createdAt ?? "",

        // Flags
        featured: primary.featured ?? e.featured ?? false,
        isNew: primary.new ?? e.new ?? false,
        competitive: primary.competitive ?? e.competitive ?? 0,

        // Tags
        tags: (e.tags ?? []).map((t: any) => ({ label: t.label, slug: t.slug })),
        series: e.series?.[0] ? { title: e.series[0].title, slug: e.series[0].slug } : null,
        commentCount: e.commentCount ?? 0,
      };
    });

  return NextResponse.json(mapped);
}

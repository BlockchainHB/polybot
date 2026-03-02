import { NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com/events";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const res = await fetch(`${GAMMA_API}?slug=${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Gamma API error: ${res.status}` },
      { status: 502 }
    );
  }

  const events: any[] = await res.json();
  const event = events[0];

  if (!event) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const markets = (event.markets ?? []).map((m: any) => {
    const outcomes =
      typeof m.outcomePrices === "string"
        ? JSON.parse(m.outcomePrices)
        : m.outcomePrices ?? [];
    const outcomeLabels =
      typeof m.outcomes === "string"
        ? JSON.parse(m.outcomes)
        : m.outcomes ?? ["Yes", "No"];

    return {
      id: m.id,
      conditionId: m.conditionId,
      question: m.question,
      slug: m.slug,
      outcomes: outcomeLabels,
      outcomePrices: outcomes.map((p: string) => parseFloat(p)),
      lastTradePrice: m.lastTradePrice ?? null,
      bestBid: m.bestBid ?? null,
      bestAsk: m.bestAsk ?? null,
      spread: m.spread ?? null,
      oneHourPriceChange: m.oneHourPriceChange ?? null,
      oneDayPriceChange: m.oneDayPriceChange ?? null,
      oneWeekPriceChange: m.oneWeekPriceChange ?? null,
      oneMonthPriceChange: m.oneMonthPriceChange ?? null,
      volume: m.volumeNum ?? parseFloat(m.volume ?? "0"),
      volume24hr: m.volume24hr ?? 0,
      volume1wk: m.volume1wk ?? 0,
      volume1mo: m.volume1mo ?? 0,
      liquidity: m.liquidityNum ?? parseFloat(m.liquidity ?? "0"),
      competitive: m.competitive ?? 0,
      featured: m.featured ?? false,
      isNew: m.new ?? false,
      negRisk: m.negRisk ?? false,
      endDate: m.endDate ?? "",
      clobTokenIds: m.clobTokenIds ?? [],
      orderMinSize: m.orderMinSize ?? 5,
      orderPriceMinTickSize: m.orderPriceMinTickSize ?? 0.001,
    };
  });

  return NextResponse.json({
    id: event.id,
    title: event.title,
    slug: event.slug,
    description: event.description ?? "",
    image: event.image || event.markets?.[0]?.image || "",
    icon: event.icon || event.markets?.[0]?.icon || "",
    startDate: event.startDate ?? "",
    endDate: event.endDate ?? "",
    createdAt: event.createdAt ?? "",
    volume: event.volume ?? 0,
    volume24hr: event.volume24hr ?? 0,
    liquidity: event.liquidity ?? 0,
    commentCount: event.commentCount ?? 0,
    competitive: event.competitive ?? 0,
    featured: event.featured ?? false,
    isNew: event.new ?? false,
    tags: (event.tags ?? []).map((t: any) => ({
      label: t.label,
      slug: t.slug,
    })),
    series: event.series?.[0]
      ? { title: event.series[0].title, slug: event.series[0].slug }
      : null,
    markets,
  });
}

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TerminalLayout } from "@/components/dashboard/terminal-layout";
import { MarketHero } from "@/components/markets/market-hero";
import { MarketStats } from "@/components/markets/market-stats";
import { OutcomesTable } from "@/components/markets/outcomes-table";
import { OrderBookPanel } from "@/components/markets/order-book-panel";
import { MarketInfoPanel } from "@/components/markets/market-info-panel";

/* ---------- types ---------- */
interface SubMarket {
  id: string;
  conditionId: string;
  question: string;
  slug: string;
  outcomes: string[];
  outcomePrices: number[];
  lastTradePrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  oneHourPriceChange: number | null;
  oneDayPriceChange: number | null;
  oneWeekPriceChange: number | null;
  oneMonthPriceChange: number | null;
  volume: number;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  liquidity: number;
  competitive: number;
  featured: boolean;
  isNew: boolean;
  negRisk: boolean;
  endDate: string;
  clobTokenIds: string[];
  orderMinSize: number;
  orderPriceMinTickSize: number;
}

interface MarketDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  image: string;
  icon: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  volume: number;
  volume24hr: number;
  liquidity: number;
  commentCount: number;
  competitive: number;
  featured: boolean;
  isNew: boolean;
  tags: { label: string; slug: string }[];
  series: { title: string; slug: string } | null;
  markets: SubMarket[];
}

/* ---------- page ---------- */
export default function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/markets/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Market not found");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  /* Loading */
  if (loading) {
    return (
      <div className="max-w-none">
        <TerminalLayout
          main={
            <>
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            </>
          }
          sidebar={
            <>
              <div className="px-4 py-3 space-y-3">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-16 animate-pulse rounded bg-muted" />
                <div className="h-8 animate-pulse rounded bg-muted" />
              </div>
              <div className="px-4 py-3 space-y-2 border-t">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-32 animate-pulse rounded bg-muted" />
              </div>
            </>
          }
        />
      </div>
    );
  }

  /* Error */
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">{error || "Market not found"}</p>
        <Link
          href="/markets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Markets
        </Link>
      </div>
    );
  }

  const primaryMarket = data.markets.length > 0 ? data.markets[0] : null;

  return (
    <div className="max-w-none">
      <TerminalLayout
        main={
          <>
            <Link
              href="/markets"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> Markets
            </Link>
            <MarketHero event={data} primaryMarket={primaryMarket} />
            <MarketStats
              oneHour={primaryMarket?.oneHourPriceChange ?? null}
              oneDay={primaryMarket?.oneDayPriceChange ?? null}
              oneWeek={primaryMarket?.oneWeekPriceChange ?? null}
              oneMonth={primaryMarket?.oneMonthPriceChange ?? null}
              volume24hr={primaryMarket?.volume24hr ?? data.volume24hr}
              volume1wk={primaryMarket?.volume1wk ?? 0}
              volume1mo={primaryMarket?.volume1mo ?? 0}
              volumeTotal={primaryMarket?.volume ?? data.volume}
            />
            {data.markets.length > 1 && <OutcomesTable markets={data.markets} />}
            {data.description && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Resolution Criteria
                </h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {data.description}
                </p>
              </div>
            )}
          </>
        }
        sidebar={
          <>
            <OrderBookPanel
              bestBid={primaryMarket?.bestBid ?? null}
              bestAsk={primaryMarket?.bestAsk ?? null}
              spread={primaryMarket?.spread ?? null}
              lastTradePrice={primaryMarket?.lastTradePrice ?? null}
              outcomes={primaryMarket?.outcomes ?? []}
              outcomePrices={primaryMarket?.outcomePrices ?? []}
            />
            <MarketInfoPanel
              createdAt={data.createdAt}
              endDate={data.endDate}
              orderMinSize={primaryMarket?.orderMinSize ?? 5}
              tickSize={primaryMarket?.orderPriceMinTickSize ?? 0.001}
              conditionId={primaryMarket?.conditionId ?? ""}
              competitive={data.competitive}
              marketsCount={data.markets.length}
            />
          </>
        }
      />
    </div>
  );
}

import Image from "next/image";
import { Clock, MessageSquare, TrendingUp } from "lucide-react";
import { cn, formatCompactUSD } from "@/src/lib/utils";
import { pct, Delta, timeUntil } from "@/src/lib/market-utils";

interface SubMarket {
  outcomePrices: number[];
  oneDayPriceChange: number | null;
  volume24hr: number;
  endDate: string;
}

interface MarketEvent {
  title: string;
  image: string;
  featured: boolean;
  isNew: boolean;
  commentCount: number;
  tags: { label: string; slug: string }[];
  series: { title: string; slug: string } | null;
  markets: { id: string }[];
  volume24hr: number;
  endDate: string;
}

interface MarketHeroProps {
  event: MarketEvent;
  primaryMarket: SubMarket | null;
}

export function MarketHero({ event, primaryMarket }: MarketHeroProps) {
  const isMulti = event.markets.length > 1;
  const yes = primaryMarket?.outcomePrices[0] ?? null;
  const no = primaryMarket?.outcomePrices[1] ?? null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex gap-4">
        {/* Image */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {event.image ? (
            <Image src={event.image} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h1 className="text-2xl font-semibold leading-tight">{event.title}</h1>

          {/* Prices */}
          <div className="mt-1.5">
            {!isMulti && yes !== null ? (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-mono font-semibold tabular-nums text-green-400">
                  Yes {pct(yes)}&cent;
                </span>
                {no !== null && (
                  <span className="text-xl font-mono font-semibold tabular-nums text-red-400">
                    No {pct(no)}&cent;
                  </span>
                )}
              </div>
            ) : (
              <span className="rounded bg-accent px-2 py-0.5 text-sm font-medium">
                {event.markets.length} outcomes
              </span>
            )}
          </div>

          {/* Inline stats */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {!isMulti && primaryMarket && (
              <Delta value={primaryMarket.oneDayPriceChange} className="text-sm" />
            )}
            <span className="font-mono tabular-nums">{formatCompactUSD(event.volume24hr)} 24h</span>
            {event.endDate && (
              <span className={cn("inline-flex items-center gap-0.5")}>
                <Clock className="h-3.5 w-3.5" />
                {timeUntil(event.endDate)}
              </span>
            )}
            {event.commentCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-3.5 w-3.5" />
                {event.commentCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn, formatCompactUSD } from "@/src/lib/utils";
import { LiveMarket, SortOption, sorts, pct, Delta, timeUntil } from "@/src/lib/market-utils";

export function MarketGrid() {
  const [sort, setSort] = useState<SortOption>("volume24hr");
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/markets?limit=20&order=${sort}`);
      if (res.ok) setMarkets(await res.json());
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Markets</h3>
        <div className="flex gap-1 rounded-md bg-muted p-0.5">
          {sorts.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  sort === s.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto rounded-lg border border-border">
        {loading && markets.length === 0 ? (
          <div className="space-y-px p-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border sticky top-0 bg-card">
                <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">Market</th>
                <th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Yes</th>
                <th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">24h</th>
                <th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Volume</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m, i) => (
                <tr
                  key={m.id}
                  className={cn(
                    "transition-colors hover:bg-accent",
                    i % 2 === 1 && "bg-muted/30"
                  )}
                >
                  <td className="max-w-[280px] px-3 py-2">
                    <Link href={`/markets/${m.slug}`} className="block truncate text-sm hover:underline">
                      {m.question}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {m.isMulti ? (
                      <span className="text-xs font-mono tabular-nums text-muted-foreground">
                        {m.marketCount} out
                      </span>
                    ) : m.yesPrice !== null ? (
                      <span className="text-sm font-mono tabular-nums font-medium text-green-400">
                        {pct(m.yesPrice)}&cent;
                      </span>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Delta value={m.oneDayPriceChange} className="text-xs" />
                    {(m.oneDayPriceChange === null || m.oneDayPriceChange === 0) && (
                      <span className="text-xs text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-mono tabular-nums text-muted-foreground">
                    {formatCompactUSD(m.volume24hr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

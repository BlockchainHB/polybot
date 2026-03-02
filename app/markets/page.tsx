"use client";

import { useState, useEffect, useCallback } from "react";
import { MarketTable } from "@/components/markets/market-table";
import { RefreshCw } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { LiveMarket, SortOption, sorts } from "@/src/lib/market-utils";

export default function MarketsPage() {
  const [sort, setSort] = useState<SortOption>("volume24hr");
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/markets?limit=50&order=${sort}`);
      if (res.ok) {
        setMarkets(await res.json());
        setLastFetched(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Markets</h1>
          {!loading && markets.length > 0 && (
            <span className="text-sm text-muted-foreground font-mono tabular-nums">
              ({markets.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="text-xs text-muted-foreground">{lastFetched.toLocaleTimeString()}</span>
          )}
          <button
            onClick={fetchMarkets}
            disabled={loading}
            className="rounded-md p-1.5 transition-colors hover:bg-muted"
          >
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-1 rounded-md bg-muted p-0.5 w-fit">
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

        <MarketTable
          markets={markets}
          loading={loading}
          sort={sort}
          onSortChange={setSort}
        />
      </div>
    </div>
  );
}

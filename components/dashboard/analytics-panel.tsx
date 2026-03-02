"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatUSD, formatPercent } from "@/src/lib/utils";
import { MiniSparkline } from "./mini-sparkline";

export function AnalyticsPanel() {
  const allTime = useQuery(api.analytics.getAnalytics, {
    period: "all_time",
    date: "all_time",
  });
  const daily = useQuery(api.analytics.dailyAnalytics, { limit: 14 });

  const loading = allTime === undefined;
  const sparkData = daily ? [...daily].reverse().map((d) => d.totalTrades) : [];
  const wins = allTime?.winCount ?? 0;
  const losses = allTime?.lossCount ?? 0;
  const total = wins + losses;
  const winPct = total > 0 ? (wins / total) * 100 : 0;

  return (
    <div className="shrink-0 border-t px-4 py-3 space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Analytics</h3>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-400 font-medium">{wins}W</span>
              <span className="text-sm font-mono tabular-nums text-muted-foreground">
                {winPct.toFixed(0)}%
              </span>
              <span className="text-red-400 font-medium">{losses}L</span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {total > 0 && (
                <>
                  <div className="bg-green-500" style={{ width: `${winPct}%` }} />
                  <div className="bg-red-500" style={{ width: `${100 - winPct}%` }} />
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Daily Trades (14d)</span>
            {sparkData.some((v) => v > 0) ? (
              <MiniSparkline data={sparkData} width={200} height={36} color="#6366f1" />
            ) : (
              <div className="flex h-9 items-center justify-center rounded bg-muted/50 text-xs text-muted-foreground">
                No trade data yet
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span className="font-medium font-mono tabular-nums">{formatUSD(allTime?.totalVolume ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Win Rate</span>
              <span className="font-medium font-mono tabular-nums">{formatPercent(allTime?.winRate ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trades</span>
              <span className="font-medium font-mono tabular-nums">{allTime?.totalTrades ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cum. Return</span>
              <span className="font-medium font-mono tabular-nums">{formatUSD(allTime?.cumulativeReturn ?? 0)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

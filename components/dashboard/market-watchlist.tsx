"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUSD, timeAgo, cn } from "@/src/lib/utils";

const sentimentColors: Record<string, string> = {
  bullish: "bg-green-500/10 text-green-400",
  bearish: "bg-red-500/10 text-red-400",
  neutral: "bg-muted text-muted-foreground",
  mixed: "bg-yellow-500/10 text-yellow-400",
};

export function MarketWatchlist() {
  const markets = useQuery(api.markets.listMarkets);

  return (
    <div>
      {markets === undefined ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-sm text-muted-foreground">
              No markets tracked yet. The bot will discover markets on its next scan cycle.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <Card key={market._id} className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium leading-snug">
                  {market.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Volume</span>
                  <span className="tabular-nums">{formatUSD(market.volume)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Liquidity</span>
                  <span className="tabular-nums">{formatUSD(market.liquidity)}</span>
                </div>

                {market.confidenceScore !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className="tabular-nums">{Math.round(market.confidenceScore * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          market.confidenceScore >= 0.7
                            ? "bg-green-500"
                            : market.confidenceScore >= 0.4
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        )}
                        style={{ width: `${market.confidenceScore * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  {market.sentiment && (
                    <Badge className={sentimentColors[market.sentiment] ?? ""}>
                      {market.sentiment}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(market.lastChecked)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

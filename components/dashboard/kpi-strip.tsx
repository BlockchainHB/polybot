"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn, formatUSD, CHART_COLORS } from "@/src/lib/utils";
import { MiniSparkline } from "./mini-sparkline";

export function KpiStrip() {
  const allTime = useQuery(api.analytics.getAnalytics, {
    period: "all_time",
    date: "all_time",
  });
  const openPositions = useQuery(api.positions.openPositions);
  const daily = useQuery(api.analytics.dailyAnalytics, { limit: 7 });
  const wallet = useQuery(api.wallet.getWallet);

  const loading = wallet === undefined;
  const sparkData = daily ? [...daily].reverse().map((d) => d.cumulativeReturn) : [];

  // Portfolio value = cash balance + mark-to-market position values
  const positionsValue = openPositions
    ? openPositions.reduce((sum, p) => sum + p.currentPrice * p.size, 0)
    : 0;
  const totalPortfolioValue = wallet
    ? wallet.balance + positionsValue
    : allTime?.portfolioValue ?? 0;
  const totalReturn = wallet
    ? totalPortfolioValue - wallet.initialBalance
    : allTime?.totalPnl ?? 0;
  const returnPositive = totalReturn >= 0;

  const deployedPct = wallet && wallet.initialBalance > 0
    ? Math.round(((wallet.initialBalance - wallet.balance) / wallet.initialBalance) * 100)
    : 0;

  const cards = [
    {
      title: "Cash Balance",
      value: wallet ? formatUSD(wallet.balance) : "--",
      subtitle: wallet ? `${deployedPct}% deployed` : undefined,
    },
    {
      title: "Portfolio Value",
      value: formatUSD(totalPortfolioValue),
      subtitle: wallet && wallet.totalInvested > 0
        ? `${formatUSD(wallet.totalInvested)} in positions`
        : undefined,
    },
    {
      title: "Total Return",
      value: formatUSD(totalReturn),
      subtitle: wallet && wallet.initialBalance > 0
        ? `${totalReturn >= 0 ? "+" : ""}${((totalReturn / wallet.initialBalance) * 100).toFixed(1)}%`
        : undefined,
      valueColor: returnPositive ? "text-green-400" : "text-red-400",
      sparkline: true,
    },
    {
      title: "Positions",
      value: openPositions ? String(openPositions.length) : "--",
      subtitle: wallet && wallet.tradeCount > 0
        ? `${wallet.tradeCount} total trades`
        : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-lg border bg-card px-4 py-3"
        >
          <span className="text-xs text-muted-foreground">{card.title}</span>
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-muted mt-1" />
          ) : (
            <div>
              <div className="flex items-end justify-between gap-2">
                <span className={cn("text-2xl font-semibold font-mono tabular-nums", card.valueColor)}>
                  {card.value}
                </span>
                {card.sparkline && sparkData.length > 1 && (
                  <MiniSparkline
                    data={sparkData}
                    width={80}
                    color={returnPositive ? CHART_COLORS.greenLine : CHART_COLORS.redLine}
                  />
                )}
              </div>
              {card.subtitle && (
                <span className="text-xs text-muted-foreground">{card.subtitle}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

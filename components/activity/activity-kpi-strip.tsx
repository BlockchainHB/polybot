"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Activity, ArrowUpDown, SkipForward, AlertCircle } from "lucide-react";

export function ActivityKpiStrip() {
  const stats = useQuery(api.agentActions.cycleStats);
  const loading = stats === undefined;

  const cards = [
    {
      title: "Total Cycles",
      value: stats?.totalCycles ?? 0,
      icon: Activity,
    },
    {
      title: "Executed Trades",
      value: stats?.totalTrades ?? 0,
      icon: ArrowUpDown,
    },
    {
      title: "Skip Rate",
      value:
        stats && stats.totalTrades + stats.totalSkips > 0
          ? `${((stats.totalSkips / (stats.totalTrades + stats.totalSkips)) * 100).toFixed(0)}%`
          : "0%",
      icon: SkipForward,
    },
    {
      title: "Errors",
      value: stats?.totalErrors ?? 0,
      icon: AlertCircle,
      valueColor: stats && stats.totalErrors > 0 ? "text-red-400" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.title} className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{card.title}</span>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          {loading ? (
            <div className="h-7 w-20 animate-pulse rounded bg-muted" />
          ) : (
            <span
              className={`text-xl font-semibold tabular-nums ${card.valueColor ?? ""}`}
            >
              {card.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

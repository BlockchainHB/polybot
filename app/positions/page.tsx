"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PositionsTable } from "@/components/dashboard/positions-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatUSD, timeAgo } from "@/src/lib/utils";

type Tab = "positions" | "history";
type StatusFilter = "all" | "open" | "closed" | "resolved";

const statusFilters: StatusFilter[] = ["all", "open", "closed", "resolved"];

const statusColors: Record<string, string> = {
  filled: "bg-green-500/10 text-green-400",
  dry_run: "bg-muted text-muted-foreground",
  pending: "bg-muted text-muted-foreground",
  rejected: "bg-red-500/10 text-red-400",
  error: "bg-red-500/10 text-red-400",
};

export default function PositionsPage() {
  const [tab, setTab] = useState<Tab>("positions");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const trades = useQuery(api.trades.listTrades);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Positions</h1>
        <div className="flex gap-1 rounded-lg border p-0.5">
          <Button
            variant={tab === "positions" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("positions")}
          >
            Positions
          </Button>
          <Button
            variant={tab === "history" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("history")}
          >
            Trade History
          </Button>
        </div>
      </div>

      {tab === "positions" ? (
        <>
          <div className="flex gap-1 rounded-md bg-muted p-0.5 w-fit">
            {statusFilters.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  statusFilter === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <PositionsTable statusFilter={statusFilter} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Trade History</CardTitle>
          </CardHeader>
          <CardContent>
            {trades === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trades recorded yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Market</th>
                      <th className="pb-2 pr-4 font-medium">Side</th>
                      <th className="pb-2 pr-4 font-medium">Size</th>
                      <th className="pb-2 pr-4 font-medium">Price</th>
                      <th className="pb-2 pr-4 font-medium">Confidence</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade._id} className="border-b">
                        <td className="max-w-[250px] truncate py-3 pr-4">
                          {trade.question}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            className={
                              trade.side === "buy_yes"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-red-500/10 text-red-400"
                            }
                          >
                            {trade.side === "buy_yes" ? "YES" : "NO"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 font-mono tabular-nums">{formatUSD(trade.size)}</td>
                        <td className="py-3 pr-4 font-mono tabular-nums">{(trade.price * 100).toFixed(1)}&cent;</td>
                        <td className="py-3 pr-4 font-mono tabular-nums">
                          <span
                            className={cn(
                              trade.confidence >= 0.7
                                ? "text-green-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {(trade.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={statusColors[trade.status] ?? ""}>
                            {trade.status === "dry_run" ? "DRY RUN" : trade.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 font-mono tabular-nums text-muted-foreground">
                          {timeAgo(trade.executedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

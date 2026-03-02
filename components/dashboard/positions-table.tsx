"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatUSD, cn } from "@/src/lib/utils";

type StatusFilter = "all" | "open" | "closed" | "resolved";

interface PositionsTableProps {
  statusFilter?: StatusFilter;
  compact?: boolean;
}

export function PositionsTable({ statusFilter = "all", compact = false }: PositionsTableProps) {
  const positions = useQuery(api.positions.listPositions);
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = useMemo(() => {
    if (!positions) return undefined;
    const list =
      statusFilter === "all"
        ? positions
        : positions.filter((p) => p.status === statusFilter);
    return [...list].sort((a, b) =>
      sortDesc ? b.unrealizedPnl - a.unrealizedPnl : a.unrealizedPnl - b.unrealizedPnl
    );
  }, [positions, statusFilter, sortDesc]);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Positions</CardTitle>
      </CardHeader>
      <CardContent>
        {filtered === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No positions found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Market</th>
                  <th className="pb-2 pr-4 font-medium">Side</th>
                  <th className="pb-2 pr-4 font-medium">Size</th>
                  {!compact && (
                    <>
                      <th className="pb-2 pr-4 font-medium">Entry</th>
                      <th className="pb-2 pr-4 font-medium">Current</th>
                    </>
                  )}
                  <th className="pb-2 pr-4 font-medium">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setSortDesc(!sortDesc)}
                    >
                      P&L
                      {sortDesc ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronUp className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pos) => (
                  <tr key={pos._id} className="border-b">
                    <td className="max-w-[200px] truncate py-3 pr-4">
                      {pos.question}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        className={
                          pos.side === "yes"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }
                      >
                        {pos.side.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{formatUSD(pos.size)}</td>
                    {!compact && (
                      <>
                        <td className="py-3 pr-4 tabular-nums">{pos.avgEntryPrice.toFixed(2)}</td>
                        <td className="py-3 pr-4 tabular-nums">{pos.currentPrice.toFixed(2)}</td>
                      </>
                    )}
                    <td
                      className={cn(
                        "py-3 pr-4 font-medium tabular-nums",
                        pos.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {pos.unrealizedPnl >= 0 ? "+" : ""}{formatUSD(pos.unrealizedPnl)}
                    </td>
                    <td className="py-3">
                      <Badge variant={pos.status === "open" ? "outline" : "secondary"}>
                        {pos.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

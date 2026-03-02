"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatCompactUSD } from "@/src/lib/utils";
import { LiveMarket, SortOption, pct, Delta, timeUntil } from "@/src/lib/market-utils";

type Column = {
  key: string;
  label: string;
  sortKey?: SortOption;
  align: "left" | "right";
};

const columns: Column[] = [
  { key: "market", label: "Market", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "bid", label: "Bid", align: "right" },
  { key: "ask", label: "Ask", align: "right" },
  { key: "spread", label: "Spread", align: "right" },
  { key: "change", label: "24h", align: "right" },
  { key: "volume", label: "Vol 24h", sortKey: "volume24hr", align: "right" },
  { key: "liquidity", label: "Liquidity", sortKey: "liquidity", align: "right" },
  { key: "ends", label: "Ends", align: "right" },
];

interface MarketTableProps {
  markets: LiveMarket[];
  loading: boolean;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function MarketTable({ markets, loading, sort, onSortChange }: MarketTableProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? markets.filter((m) => m.question.toLowerCase().includes(search.toLowerCase()))
    : markets;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search markets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {loading && markets.length === 0 ? (
        <div className="space-y-px">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {search ? "No markets match your search." : "No markets found."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border sticky top-0 bg-card">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground",
                      col.align === "right" ? "text-right" : "text-left",
                      col.sortKey && "cursor-pointer select-none hover:text-foreground"
                    )}
                    onClick={col.sortKey ? () => onSortChange(col.sortKey!) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortKey && sort === col.sortKey && (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr
                  key={m.id}
                  className={cn(
                    "group border-b border-border transition-colors hover:bg-accent",
                    i % 2 === 1 && "bg-muted/30"
                  )}
                >
                  <td className="max-w-[320px] px-3 py-2">
                    <Link href={`/markets/${m.slug}`} className="block truncate text-sm font-medium group-hover:underline">
                      {m.question}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {m.isMulti ? (
                      <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-mono font-medium tabular-nums">
                        {m.marketCount} out
                      </span>
                    ) : m.yesPrice !== null ? (
                      <span className="text-base font-mono font-medium tabular-nums">{pct(m.yesPrice)}&cent;</span>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-sm text-green-400">
                    {m.bestBid !== null ? `${(m.bestBid * 100).toFixed(1)}\u00a2` : <span className="text-muted-foreground">&mdash;</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-sm text-red-400">
                    {m.bestAsk !== null ? `${(m.bestAsk * 100).toFixed(1)}\u00a2` : <span className="text-muted-foreground">&mdash;</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-sm text-muted-foreground">
                    {m.spread !== null ? `${(m.spread * 100).toFixed(1)}\u00a2` : <span>&mdash;</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">
                    <Delta value={m.oneDayPriceChange} className="text-sm" />
                    {(m.oneDayPriceChange === null || m.oneDayPriceChange === 0) && (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-sm text-muted-foreground">
                    {formatCompactUSD(m.volume24hr)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-sm text-muted-foreground">
                    {formatCompactUSD(m.liquidity)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-sm text-muted-foreground">
                    {m.endDate ? timeUntil(m.endDate) : <span>&mdash;</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

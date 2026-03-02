"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatCompactUSD } from "@/src/lib/utils";
import { pct, Delta } from "@/src/lib/market-utils";

interface SubMarket {
  id: string;
  question: string;
  outcomePrices: number[];
  volume24hr: number;
  oneDayPriceChange: number | null;
  liquidity: number;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
}

interface OutcomesTableProps {
  markets: SubMarket[];
}

type SortKey = "price" | "volume24hr" | "oneDayPriceChange" | "liquidity";
type SortDir = "asc" | "desc";

function getPrice(m: SubMarket) {
  return m.outcomePrices[0] ?? 0;
}

function getSortValue(m: SubMarket, key: SortKey): number {
  switch (key) {
    case "price":
      return getPrice(m);
    case "volume24hr":
      return m.volume24hr;
    case "oneDayPriceChange":
      return m.oneDayPriceChange ?? 0;
    case "liquidity":
      return m.liquidity;
  }
}

const columns: { key: SortKey; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "volume24hr", label: "Volume 24h" },
  { key: "oneDayPriceChange", label: "24h Change" },
  { key: "liquidity", label: "Liquidity" },
];

export function OutcomesTable({ markets }: OutcomesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...markets].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "desc" ? (
      <ChevronDown className="h-3 w-3" />
    ) : (
      <ChevronUp className="h-3 w-3" />
    );
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-medium text-muted-foreground">Outcomes</h3>
      </div>
      <div className="px-4">
        <table className="w-full">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 text-left font-medium">Outcome</th>
              {columns.map((col) => (
                <th key={col.key} className="py-2 text-right font-medium">
                  <button
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center gap-0.5 hover:text-foreground"
                  >
                    {col.label}
                    <SortIcon col={col.key} />
                  </button>
                </th>
              ))}
              <th className="py-2 text-right font-medium">Bid</th>
              <th className="py-2 text-right font-medium">Ask</th>
              <th className="py-2 text-right font-medium">Spread</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-accent">
                <td className="max-w-[240px] truncate py-2.5 text-sm">{m.question}</td>
                <td className="py-2.5 text-right font-mono font-medium tabular-nums text-sm">
                  {pct(getPrice(m))}&cent;
                </td>
                <td className="py-2.5 text-right text-sm font-mono tabular-nums">
                  {formatCompactUSD(m.volume24hr)}
                </td>
                <td className="py-2.5 text-right text-sm">
                  <Delta value={m.oneDayPriceChange} className="text-sm" />
                </td>
                <td className="py-2.5 text-right text-sm font-mono tabular-nums">
                  {formatCompactUSD(m.liquidity)}
                </td>
                <td className="py-2.5 text-right text-sm font-mono tabular-nums text-green-400">
                  {m.bestBid !== null ? `${(m.bestBid * 100).toFixed(1)}\u00a2` : "\u2014"}
                </td>
                <td className="py-2.5 text-right text-sm font-mono tabular-nums text-red-400">
                  {m.bestAsk !== null ? `${(m.bestAsk * 100).toFixed(1)}\u00a2` : "\u2014"}
                </td>
                <td className="py-2.5 text-right text-sm font-mono tabular-nums text-muted-foreground">
                  {m.spread !== null ? `${(m.spread * 100).toFixed(1)}\u00a2` : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

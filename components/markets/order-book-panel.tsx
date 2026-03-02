import { cn } from "@/src/lib/utils";

interface OrderBookPanelProps {
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  lastTradePrice: number | null;
  outcomes: string[];
  outcomePrices: number[];
}

export function OrderBookPanel({
  bestBid,
  bestAsk,
  spread,
  lastTradePrice,
  outcomes,
  outcomePrices,
}: OrderBookPanelProps) {
  if (bestBid === null && bestAsk === null) {
    return (
      <div className="px-4 py-3">
        <h3 className="text-sm font-medium">Pricing</h3>
        <p className="mt-2 text-sm text-muted-foreground">No pricing data</p>
      </div>
    );
  }

  const bidCents = bestBid !== null ? (bestBid * 100).toFixed(1) : null;
  const askCents = bestAsk !== null ? (bestAsk * 100).toFixed(1) : null;
  const spreadCents = spread !== null ? (spread * 100).toFixed(1) : null;
  const spreadPct =
    spread !== null && bestBid !== null && bestBid > 0
      ? ((spread / bestBid) * 100).toFixed(1)
      : null;
  const lastCents =
    lastTradePrice !== null ? (lastTradePrice * 100).toFixed(1) : null;

  const midpoint =
    bestBid !== null && bestAsk !== null
      ? (((bestBid + bestAsk) / 2) * 100).toFixed(1)
      : null;

  const bidProportion =
    bestBid !== null && bestAsk !== null && bestBid + bestAsk > 0
      ? (bestBid / (bestBid + bestAsk)) * 100
      : 50;

  return (
    <div className="px-4 py-3 space-y-3">
      <h3 className="text-sm font-medium">Pricing</h3>

      {/* Bid / Ask display */}
      <div className="flex justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Bid</p>
          <p className="text-lg font-mono text-green-400 font-medium tabular-nums">
            {bidCents !== null ? `${bidCents}\u00a2` : "\u2014"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Ask</p>
          <p className="text-lg font-mono text-red-400 font-medium tabular-nums">
            {askCents !== null ? `${askCents}\u00a2` : "\u2014"}
          </p>
        </div>
      </div>

      {/* Spread */}
      <p className="text-sm font-mono tabular-nums text-muted-foreground">
        Spread: {spreadCents !== null ? `${spreadCents}\u00a2` : "\u2014"}
        {spreadPct !== null && ` (${spreadPct}%)`}
      </p>

      {/* Last trade */}
      <p className="text-sm font-mono tabular-nums text-muted-foreground">
        Last: {lastCents !== null ? `${lastCents}\u00a2` : "\u2014"}
      </p>

      {/* Spread visualization bar */}
      <div className="h-2 rounded-full bg-muted flex overflow-hidden">
        <div
          className="bg-green-400 rounded-l-full"
          style={{ width: `${bidProportion}%` }}
        />
        <div
          className="bg-red-400 rounded-r-full flex-1"
        />
      </div>

      {/* Midpoint */}
      {midpoint !== null && (
        <p className="text-sm font-mono tabular-nums text-muted-foreground text-center">
          Midpoint: {midpoint}&cent;
        </p>
      )}
    </div>
  );
}

import { cn, formatCompactUSD } from "@/src/lib/utils";

interface MarketStatsProps {
  oneHour: number | null;
  oneDay: number | null;
  oneWeek: number | null;
  oneMonth: number | null;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  volumeTotal: number;
}

function formatChange(value: number | null) {
  if (value === null) return null;
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function MarketStats({
  oneHour,
  oneDay,
  oneWeek,
  oneMonth,
  volume24hr,
  volume1wk,
  volume1mo,
  volumeTotal,
}: MarketStatsProps) {
  const priceChanges: { label: string; value: number | null }[] = [
    { label: "1H", value: oneHour },
    { label: "24H", value: oneDay },
    { label: "7D", value: oneWeek },
    { label: "30D", value: oneMonth },
  ];

  const volumes: { label: string; value: number }[] = [
    { label: "24H", value: volume24hr },
    { label: "7D", value: volume1wk },
    { label: "30D", value: volume1mo },
    { label: "All-Time", value: volumeTotal },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-0">
      {/* Price Changes */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Price Changes</h3>
        <div className="grid grid-cols-4 gap-3">
          {priceChanges.map((cell) => (
            <div key={cell.label}>
              <p className="text-xs text-muted-foreground">{cell.label}</p>
              <p
                className={cn(
                  "text-base font-mono font-medium tabular-nums",
                  cell.value === null
                    ? "text-muted-foreground"
                    : cell.value > 0
                      ? "text-green-400"
                      : cell.value < 0
                        ? "text-red-400"
                        : "text-muted-foreground"
                )}
              >
                {cell.value !== null ? formatChange(cell.value) : "\u2014"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t my-3" />

      {/* Volume */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Volume</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {volumes.map((cell) => (
            <div key={cell.label}>
              <p className="text-xs text-muted-foreground">{cell.label}</p>
              <p className="text-base font-mono font-medium tabular-nums">
                {formatCompactUSD(cell.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

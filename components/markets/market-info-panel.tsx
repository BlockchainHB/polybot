import { cn } from "@/src/lib/utils";

interface MarketInfoPanelProps {
  createdAt: string;
  endDate: string;
  orderMinSize: number;
  tickSize: number;
  conditionId: string;
  competitive: number;
  marketsCount: number;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MarketInfoPanel({
  createdAt,
  endDate,
  orderMinSize,
  tickSize,
  conditionId,
  competitive,
  marketsCount,
}: MarketInfoPanelProps) {
  const competitivePct = Math.round(competitive * 100);
  const competitiveColor =
    competitivePct >= 70
      ? "text-green-400"
      : competitivePct >= 40
        ? "text-muted-foreground"
        : "text-muted-foreground";

  const truncatedConditionId = conditionId
    ? conditionId.slice(0, 8) + "..."
    : "\u2014";

  const rows: { label: string; value: string; className?: string }[] = [
    { label: "Created", value: formatDate(createdAt) },
    { label: "End Date", value: formatDate(endDate) },
    {
      label: "Min Order",
      value: `$${orderMinSize.toFixed(2)}`,
    },
    {
      label: "Tick Size",
      value: `${(tickSize * 100).toFixed(1)}\u00a2`,
    },
    { label: "Markets", value: String(marketsCount) },
    {
      label: "Competitive",
      value: `${competitivePct}%`,
      className: competitiveColor,
    },
  ];

  return (
    <div className="px-4 py-3 space-y-2 border-t">
      <h3 className="text-sm font-medium">Market Info</h3>

      {rows.map((row) => (
        <div key={row.label} className="flex justify-between">
          <span className="text-xs text-muted-foreground">{row.label}</span>
          <span className={cn("text-sm font-mono font-medium tabular-nums", row.className)}>
            {row.value}
          </span>
        </div>
      ))}

      {/* Condition ID */}
      <div className="flex justify-between">
        <span className="text-xs text-muted-foreground">Condition</span>
        <span className="text-sm font-mono text-muted-foreground">
          {truncatedConditionId}
        </span>
      </div>
    </div>
  );
}

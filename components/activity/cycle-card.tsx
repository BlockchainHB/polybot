"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PipelineSteps } from "./pipeline-steps";
import { cn, timeAgo, formatUSD } from "@/src/lib/utils";
import { ChevronRight, ExternalLink } from "lucide-react";

interface CycleStage {
  type: string;
  summary: string;
  timestamp: number;
  details: any;
}

interface CycleCardProps {
  cycleId: string;
  startedAt: number;
  endedAt: number;
  stages: CycleStage[];
  tradeCount: number;
  hasError: boolean;
}

function getStatusBadge(tradeCount: number, hasError: boolean, stages: CycleStage[]) {
  if (hasError) return { label: "Error", className: "bg-red-500/10 text-red-400" };
  if (tradeCount > 0) return { label: "Traded", className: "bg-green-500/10 text-green-400" };
  const hasSkip = stages.some(
    (s) => s.type === "trade" && s.details?.decision?.action === "skip"
  );
  if (hasSkip) return { label: "Skipped", className: "bg-yellow-500/10 text-yellow-400" };
  return { label: "Complete", className: "bg-blue-500/10 text-blue-400" };
}

function extractTrades(stages: CycleStage[]) {
  return stages
    .filter((s) => s.type === "trade")
    .map((s) => {
      const d = s.details as any;
      const decision = d?.decision;
      return {
        question: d?.question ?? decision?.question ?? "Unknown market",
        slug: d?.slug,
        action: decision?.action as string | undefined,
        confidence: decision?.confidence as number | undefined,
        size: decision?.suggestedSize as number | undefined,
        price: decision?.suggestedPrice as number | undefined,
        dryRun: d?.dryRun as boolean | undefined,
        riskRejected: d?.riskResult && !d.riskResult.approved,
      };
    });
}

export function CycleCard({
  cycleId,
  startedAt,
  stages,
  tradeCount,
  hasError,
}: CycleCardProps) {
  const completedStages = [...new Set(stages.map((s) => s.type))];
  const status = getStatusBadge(tradeCount, hasError, stages);
  const trades = extractTrades(stages);

  return (
    <Link
      href={`/activity/${cycleId}`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted-foreground truncate">
            {cycleId.slice(0, 12)}...
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {timeAgo(startedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={status.className}>{status.label}</Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="mb-3">
        <PipelineSteps completedStages={completedStages} size="sm" />
      </div>

      {/* Trade outcomes */}
      {trades.length > 0 && (
        <div className="space-y-2">
          {trades.map((trade, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-muted-foreground">
                &ldquo;{trade.question}&rdquo;
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {trade.action && trade.action !== "skip" ? (
                  <>
                    <Badge
                      className={
                        trade.action === "buy_yes"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }
                    >
                      {trade.action === "buy_yes" ? "BUY YES" : "BUY NO"}
                    </Badge>
                    {trade.confidence != null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {(trade.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {trade.size != null && trade.price != null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatUSD(trade.size)} @ {trade.price.toFixed(2)}
                      </span>
                    )}
                    {trade.dryRun && (
                      <Badge className="bg-yellow-500/10 text-yellow-400 text-[10px]">
                        DRY
                      </Badge>
                    )}
                  </>
                ) : trade.riskRejected ? (
                  <Badge className="bg-red-500/10 text-red-400">RISK REJECTED</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">SKIP</Badge>
                )}
                {trade.slug && (
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

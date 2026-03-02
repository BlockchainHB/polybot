"use client";

import Link from "next/link";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo, formatUSD } from "@/src/lib/utils";

interface TradeDecisionCardProps {
  summary: string;
  timestamp: number;
  details: any;
  prevTimestamp?: number;
}

export function TradeDecisionCard({
  summary,
  timestamp,
  details,
  prevTimestamp,
}: TradeDecisionCardProps) {
  const decision = details?.decision;
  const riskResult = details?.riskResult;
  const question = details?.question ?? decision?.question ?? "Unknown market";
  const slug = details?.slug;
  const dryRun = details?.dryRun;
  const action = decision?.action as string | undefined;
  const confidence = decision?.confidence as number | undefined;
  const reasoning = decision?.reasoning as string | undefined;
  const price = decision?.suggestedPrice as number | undefined;
  const size = decision?.suggestedSize as number | undefined;
  const duration = prevTimestamp ? Math.round((timestamp - prevTimestamp) / 1000) : null;

  const isSkip = action === "skip";
  const isRiskRejected = riskResult && !riskResult.approved;
  const isExecuted = !isSkip && !isRiskRejected;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="rounded p-1.5 bg-green-400/10">
            <ArrowUpDown className="h-4 w-4 text-green-400" />
          </div>
          <span className="text-sm font-semibold text-green-400">
            Trade Decision
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {duration !== null && duration > 0 && <span>{duration}s</span>}
          <span>{timeAgo(timestamp)}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Question */}
        <p className="text-sm font-medium">&ldquo;{question}&rdquo;</p>

        {/* Action + confidence + dry run badge */}
        <div className="flex items-center flex-wrap gap-2">
          {isSkip ? (
            <Badge className="bg-muted text-muted-foreground">SKIP</Badge>
          ) : isRiskRejected ? (
            <Badge className="bg-red-500/10 text-red-400">RISK REJECTED</Badge>
          ) : action === "buy_yes" ? (
            <Badge className="bg-green-500/10 text-green-400">BUY YES</Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-400">BUY NO</Badge>
          )}

          {confidence != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence:</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      confidence >= 0.7
                        ? "bg-green-400"
                        : confidence >= 0.5
                          ? "bg-yellow-400"
                          : "bg-red-400"
                    )}
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums font-medium">
                  {(confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {dryRun && (
            <Badge className="bg-yellow-500/10 text-yellow-400">DRY RUN</Badge>
          )}
        </div>

        {/* Reasoning */}
        {reasoning && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reasoning</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {reasoning}
            </p>
          </div>
        )}

        {/* Price / Size / Risk row */}
        {(price != null || size != null || riskResult) && (
          <div className="flex items-center gap-4 text-sm border-t pt-3">
            {price != null && (
              <div>
                <span className="text-xs text-muted-foreground">Price</span>
                <p className="tabular-nums font-medium">${price.toFixed(2)}</p>
              </div>
            )}
            {size != null && (
              <div>
                <span className="text-xs text-muted-foreground">Size</span>
                <p className="tabular-nums font-medium">{formatUSD(size)}</p>
              </div>
            )}
            {riskResult && (
              <div>
                <span className="text-xs text-muted-foreground">Risk</span>
                <p
                  className={cn(
                    "font-medium",
                    riskResult.approved ? "text-green-400" : "text-red-400"
                  )}
                >
                  {riskResult.approved ? "Approved" : "Rejected"}
                </p>
                {riskResult.reason && (
                  <p className="text-xs text-muted-foreground">{riskResult.reason}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Market links */}
        {slug && (
          <div className="flex items-center gap-3 border-t pt-3">
            <Link
              href={`/markets/${slug}`}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View Market Detail
              <ExternalLink className="h-3 w-3" />
            </Link>
            <a
              href={`https://polymarket.com/event/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Open on Polymarket
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

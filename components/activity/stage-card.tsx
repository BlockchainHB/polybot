"use client";

import {
  Search,
  Filter,
  Eye,
  BookOpen,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn, timeAgo } from "@/src/lib/utils";

const typeConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  scan: { icon: Search, color: "text-cyan-400", bg: "bg-cyan-400/10", label: "Market Scan" },
  filter: { icon: Filter, color: "text-orange-400", bg: "bg-orange-400/10", label: "Market Filter" },
  screen: { icon: Eye, color: "text-yellow-400", bg: "bg-yellow-400/10", label: "LLM Screen" },
  research: { icon: BookOpen, color: "text-blue-400", bg: "bg-blue-400/10", label: "Deep Research" },
  trade: { icon: ArrowUpDown, color: "text-green-400", bg: "bg-green-400/10", label: "Trade Decision" },
  position_refresh: { icon: RefreshCw, color: "text-purple-400", bg: "bg-purple-400/10", label: "Position Refresh" },
  error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10", label: "Error" },
};

interface StageCardProps {
  type: string;
  summary: string;
  timestamp: number;
  details: any;
  prevTimestamp?: number;
}

function renderDetails(type: string, details: any) {
  if (!details) return null;

  switch (type) {
    case "scan":
      return (
        <p className="text-sm text-muted-foreground">
          Found <span className="text-foreground font-medium">{details.count}</span> trending markets
        </p>
      );
    case "filter":
      return (
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{details.before}</span> markets filtered down to{" "}
          <span className="text-foreground font-medium">{details.after}</span>
        </p>
      );
    case "screen":
      if (!details.candidates) return null;
      return (
        <div className="space-y-2">
          {details.candidates.map((c: any, i: number) => (
            <div key={i} className="rounded-md border bg-muted/50 p-2.5">
              <p className="text-sm font-medium">{c.question ?? c.conditionId}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground">
                  Confidence:{" "}
                  <span className="text-foreground tabular-nums">
                    {((c.confidence ?? 0) * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
              {c.reasoning && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {c.reasoning}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    case "research":
      return (
        <div className="space-y-1">
          {details.question && (
            <p className="text-sm font-medium">&ldquo;{details.question}&rdquo;</p>
          )}
          <p className="text-xs text-muted-foreground">
            Synthesis: {details.synthesisLength} characters of research collected
          </p>
        </div>
      );
    case "position_refresh":
      return (
        <p className="text-sm text-muted-foreground">
          Refreshed <span className="text-foreground font-medium">{details.positionCount}</span> open positions
        </p>
      );
    case "error":
      return (
        <p className="text-sm text-red-400">
          {details.error ?? "Unknown error"}
        </p>
      );
    default:
      return null;
  }
}

export function StageCard({ type, summary, timestamp, details, prevTimestamp }: StageCardProps) {
  const config = typeConfig[type] ?? typeConfig.error;
  const Icon = config.icon;
  const duration = prevTimestamp ? Math.round((timestamp - prevTimestamp) / 1000) : null;

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("rounded p-1.5", config.bg)}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <span className={cn("text-sm font-semibold", config.color)}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {duration !== null && duration > 0 && <span>{duration}s</span>}
          <span>{timeAgo(timestamp)}</span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm mb-2">{summary}</p>

      {/* Structured details */}
      {renderDetails(type, details)}
    </div>
  );
}

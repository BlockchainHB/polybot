"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Search,
  Filter,
  Eye,
  BookOpen,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn, timeAgo, truncate } from "@/src/lib/utils";

const typeConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  scan: { icon: Search, color: "text-muted-foreground", bg: "bg-muted", label: "Scan" },
  filter: { icon: Filter, color: "text-muted-foreground", bg: "bg-muted", label: "Filter" },
  screen: { icon: Eye, color: "text-muted-foreground", bg: "bg-muted", label: "Screen" },
  research: { icon: BookOpen, color: "text-muted-foreground", bg: "bg-muted", label: "Research" },
  trade: { icon: ArrowUpDown, color: "text-green-400", bg: "bg-green-400/10", label: "Trade" },
  position_refresh: { icon: RefreshCw, color: "text-muted-foreground", bg: "bg-muted", label: "Refresh" },
  error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10", label: "Error" },
};

const filterTypes = ["all", "trade", "error"] as const;
type FilterType = (typeof filterTypes)[number];

export function AgentFeed() {
  const actions = useQuery(api.agentActions.listActions, { limit: 50 });
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filtered = useMemo(() => {
    if (!actions) return undefined;
    if (activeFilter === "all") return actions;
    return actions.filter((a) => a.type === activeFilter);
  }, [actions, activeFilter]);

  const summary = useMemo(() => {
    if (!actions) return { total: 0, trades: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const todayActions = actions.filter((a) => a.timestamp >= todayTs);
    return {
      total: todayActions.length,
      trades: todayActions.filter((a) => a.type === "trade").length,
    };
  }, [actions]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Agent Activity</h3>
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-muted-foreground">
          {summary.total} today / {summary.trades} trades
        </span>
      </div>

      <div className="flex gap-1 px-4 pb-2">
        {filterTypes.map((t) => (
          <button
            key={t}
            onClick={() => setActiveFilter(t)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeFilter === t
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "all" ? "All" : t === "trade" ? "Trades" : "Errors"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {filtered === undefined ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <div className="space-y-px">
            {filtered.map((action) => {
              const config = typeConfig[action.type] ?? typeConfig.error;
              const Icon = config.icon;
              const detail = (action.details as Record<string, unknown> | undefined)?.market as string
                ?? (action.details as Record<string, unknown> | undefined)?.reason as string
                ?? "";

              return (
                <div
                  key={action._id}
                  className="w-full rounded-md p-2 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("rounded p-1 mt-0.5", config.bg)}>
                      <Icon className={cn("h-3 w-3", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs truncate">{action.summary}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {timeAgo(action.timestamp)}
                        </span>
                      </div>
                      {detail && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {truncate(String(detail), 80)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

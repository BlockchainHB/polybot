"use client";

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
import { cn, timeAgo } from "@/src/lib/utils";

const typeConfig: Record<
  string,
  { icon: React.ElementType; color: string; border: string; bg: string }
> = {
  scan: { icon: Search, color: "text-cyan-400", border: "border-cyan-400", bg: "bg-cyan-400/10" },
  filter: { icon: Filter, color: "text-orange-400", border: "border-orange-400", bg: "bg-orange-400/10" },
  screen: { icon: Eye, color: "text-yellow-400", border: "border-yellow-400", bg: "bg-yellow-400/10" },
  research: { icon: BookOpen, color: "text-blue-400", border: "border-blue-400", bg: "bg-blue-400/10" },
  trade: { icon: ArrowUpDown, color: "text-green-400", border: "border-green-400", bg: "bg-green-400/10" },
  position_refresh: { icon: RefreshCw, color: "text-purple-400", border: "border-purple-400", bg: "bg-purple-400/10" },
  error: { icon: AlertCircle, color: "text-red-400", border: "border-red-400", bg: "bg-red-400/10" },
};

export function ActivitySidebar() {
  const actions = useQuery(api.agentActions.recentActions, { limit: 20 });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Trade Radar</h3>
        <p className="text-xs text-muted-foreground">Latest pipeline actions</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {actions === undefined ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : actions.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {actions.map((action) => {
              const config = typeConfig[action.type] ?? typeConfig.error;
              const Icon = config.icon;

              return (
                <div
                  key={action._id}
                  className={cn(
                    "rounded-md border-l-2 p-2.5 transition-colors hover:bg-accent/50",
                    config.border
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("rounded p-1 shrink-0", config.bg)}>
                      <Icon className={cn("h-3 w-3", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">
                        {action.summary}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn("text-[10px] font-medium uppercase", config.color)}>
                          {action.type.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(action.timestamp)}
                        </span>
                      </div>
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

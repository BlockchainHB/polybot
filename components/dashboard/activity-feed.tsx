"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  { icon: React.ElementType; color: string; bg: string }
> = {
  scan: { icon: Search, color: "text-cyan-400", bg: "bg-cyan-400/10" },
  filter: { icon: Filter, color: "text-orange-400", bg: "bg-orange-400/10" },
  screen: { icon: Eye, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  research: { icon: BookOpen, color: "text-blue-400", bg: "bg-blue-400/10" },
  trade: { icon: ArrowUpDown, color: "text-green-400", bg: "bg-green-400/10" },
  position_refresh: { icon: RefreshCw, color: "text-purple-400", bg: "bg-purple-400/10" },
  error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10" },
};

interface ActivityFeedProps {
  limit?: number;
  filterType?: string;
}

export function ActivityFeed({ limit, filterType }: ActivityFeedProps) {
  const actions = useQuery(api.agentActions.listActions, limit ? { limit } : {});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = actions
    ? filterType && filterType !== "all"
      ? actions.filter((a) => a.type === filterType)
      : actions
    : undefined;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Activity Feed</CardTitle>
      </CardHeader>
      <CardContent>
        {filtered === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <div className="max-h-[600px] space-y-1 overflow-y-auto">
            {filtered.map((action) => {
              const config = typeConfig[action.type] ?? typeConfig.error;
              const Icon = config.icon;
              const isExpanded = expandedId === action._id;

              return (
                <button
                  key={action._id}
                  className="w-full rounded-md border p-3 text-left transition-colors hover:bg-accent"
                  onClick={() => setExpandedId(isExpanded ? null : action._id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded p-1.5", config.bg)}>
                      <Icon className={cn("h-3 w-3", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {action.summary}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {timeAgo(action.timestamp)}
                        </span>
                      </div>
                      {isExpanded && action.details && (
                        <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                          {JSON.stringify(action.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

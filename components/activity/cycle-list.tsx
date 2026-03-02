"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CycleCard } from "./cycle-card";
import { cn } from "@/src/lib/utils";

type FilterTab = "all" | "traded" | "skipped" | "errors";

const tabs: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "traded", label: "Traded" },
  { value: "skipped", label: "Skipped" },
  { value: "errors", label: "Errors" },
];

export function CycleList() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const cycles = useQuery(api.agentActions.listCycles, {});

  const filtered = cycles?.filter((cycle) => {
    if (filter === "all") return true;
    if (filter === "traded") return cycle.tradeCount > 0;
    if (filter === "skipped") {
      return (
        cycle.tradeCount === 0 &&
        !cycle.hasError &&
        cycle.stages.some(
          (s) => s.type === "trade" && (s.details as any)?.decision?.action === "skip"
        )
      );
    }
    if (filter === "errors") return cycle.hasError;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-md bg-muted p-0.5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cycle cards */}
      {filtered === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "No pipeline cycles yet" : `No ${filter} cycles`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cycle) => (
            <CycleCard key={cycle.cycleId} {...cycle} />
          ))}
        </div>
      )}
    </div>
  );
}

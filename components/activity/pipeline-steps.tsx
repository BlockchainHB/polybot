"use client";

import {
  Search,
  Filter,
  Eye,
  BookOpen,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

const PIPELINE_STAGES = [
  { key: "scan", label: "Scan", icon: Search, color: "cyan" },
  { key: "filter", label: "Filter", icon: Filter, color: "orange" },
  { key: "screen", label: "Screen", icon: Eye, color: "yellow" },
  { key: "research", label: "Research", icon: BookOpen, color: "blue" },
  { key: "trade", label: "Trade", icon: ArrowUpDown, color: "green" },
  { key: "position_refresh", label: "Refresh", icon: RefreshCw, color: "purple" },
] as const;

const colorMap: Record<string, { dot: string; line: string; icon: string }> = {
  cyan: { dot: "bg-cyan-400", line: "bg-cyan-400/40", icon: "text-cyan-400" },
  orange: { dot: "bg-orange-400", line: "bg-orange-400/40", icon: "text-orange-400" },
  yellow: { dot: "bg-yellow-400", line: "bg-yellow-400/40", icon: "text-yellow-400" },
  blue: { dot: "bg-blue-400", line: "bg-blue-400/40", icon: "text-blue-400" },
  green: { dot: "bg-green-400", line: "bg-green-400/40", icon: "text-green-400" },
  purple: { dot: "bg-purple-400", line: "bg-purple-400/40", icon: "text-purple-400" },
};

interface PipelineStepsProps {
  completedStages: string[];
  size?: "sm" | "lg";
}

export function PipelineSteps({ completedStages, size = "sm" }: PipelineStepsProps) {
  const isLarge = size === "lg";

  return (
    <div className="flex items-center gap-0">
      {PIPELINE_STAGES.map((stage, i) => {
        const completed = completedStages.includes(stage.key);
        const colors = colorMap[stage.color];
        const Icon = stage.icon;

        return (
          <div key={stage.key} className="flex items-center">
            {/* Connector line */}
            {i > 0 && (
              <div
                className={cn(
                  "h-0.5",
                  isLarge ? "w-6" : "w-3",
                  completed ? colors.line : "bg-muted"
                )}
              />
            )}
            {/* Stage dot/icon */}
            {isLarge ? (
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full",
                    completed ? colors.dot : "bg-muted",
                    "h-8 w-8"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      completed ? "text-background" : "text-muted-foreground"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    completed ? colors.icon : "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-full",
                  completed ? colors.dot : "bg-muted-foreground/30",
                  "h-2 w-2"
                )}
                title={stage.label}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

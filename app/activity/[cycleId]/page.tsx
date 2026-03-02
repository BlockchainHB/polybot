"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PipelineSteps } from "@/components/activity/pipeline-steps";
import { CycleDetail } from "@/components/activity/cycle-detail";
import { timeAgo } from "@/src/lib/utils";

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = use(params);
  const actions = useQuery(api.agentActions.actionsByCycle, { cycleId });

  const sorted = actions ? [...actions].sort((a, b) => a.timestamp - b.timestamp) : [];
  const completedStages = sorted ? [...new Set(sorted.map((a) => a.type))] : [];
  const startedAt = sorted.length > 0 ? sorted[0].timestamp : 0;
  const endedAt = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : 0;
  const durationSec = Math.round((endedAt - startedAt) / 1000);
  const hasError = sorted.some((a) => a.type === "error");
  const tradeCount = sorted.filter((a) => {
    if (a.type !== "trade") return false;
    const d = a.details as any;
    return d?.decision?.action !== "skip";
  }).length;

  function getStatusBadge() {
    if (hasError) return { label: "Error", className: "bg-red-500/10 text-red-400" };
    if (tradeCount > 0) return { label: "Traded", className: "bg-green-500/10 text-green-400" };
    return { label: "Complete", className: "bg-blue-500/10 text-blue-400" };
  }

  const status = getStatusBadge();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/activity"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Activity
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono">{cycleId}</h1>
          {startedAt > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {timeAgo(startedAt)}
              {durationSec > 0 && ` \u00b7 ${durationSec}s duration`}
              {` \u00b7 ${sorted.length} stages`}
            </p>
          )}
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </div>

      {/* Pipeline stepper */}
      {actions !== undefined && (
        <div className="rounded-lg border bg-card p-4">
          <PipelineSteps completedStages={completedStages} size="lg" />
        </div>
      )}

      {/* Stage cards */}
      {actions === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No actions found for this cycle</p>
        </div>
      ) : (
        <CycleDetail actions={sorted} />
      )}
    </div>
  );
}

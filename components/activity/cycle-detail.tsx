"use client";

import { StageCard } from "./stage-card";
import { TradeDecisionCard } from "./trade-decision-card";

interface Action {
  _id: string;
  type: string;
  summary: string;
  details: any;
  timestamp: number;
  cycleId?: string;
}

interface CycleDetailProps {
  actions: Action[];
}

export function CycleDetail({ actions }: CycleDetailProps) {
  // Sort ascending for timeline order
  const sorted = [...actions].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="space-y-3">
      {sorted.map((action, i) => {
        const prevTimestamp = i > 0 ? sorted[i - 1].timestamp : undefined;

        if (action.type === "trade") {
          return (
            <TradeDecisionCard
              key={action._id}
              summary={action.summary}
              timestamp={action.timestamp}
              details={action.details}
              prevTimestamp={prevTimestamp}
            />
          );
        }

        return (
          <StageCard
            key={action._id}
            type={action.type}
            summary={action.summary}
            timestamp={action.timestamp}
            details={action.details}
            prevTimestamp={prevTimestamp}
          />
        );
      })}
    </div>
  );
}

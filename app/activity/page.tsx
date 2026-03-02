"use client";

import { TerminalLayout } from "@/components/dashboard/terminal-layout";
import { ActivityKpiStrip } from "@/components/activity/activity-kpi-strip";
import { CycleList } from "@/components/activity/cycle-list";
import { ActivitySidebar } from "@/components/activity/activity-sidebar";

export default function ActivityPage() {
  return (
    <TerminalLayout
      main={
        <>
          <h1 className="text-2xl font-bold">Activity</h1>
          <ActivityKpiStrip />
          <CycleList />
        </>
      }
      sidebar={<ActivitySidebar />}
    />
  );
}

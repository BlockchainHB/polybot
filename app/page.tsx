"use client";

import { TerminalLayout } from "@/components/dashboard/terminal-layout";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { PnlAreaChart } from "@/components/dashboard/pnl-area-chart";
import { MarketGrid } from "@/components/dashboard/market-grid";
import { AgentFeed } from "@/components/dashboard/agent-feed";
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";

export default function DashboardPage() {
  return (
    <TerminalLayout
      main={
        <>
          <KpiStrip />
          <PnlAreaChart />
          <MarketGrid />
        </>
      }
      sidebar={
        <>
          <AgentFeed />
          <AnalyticsPanel />
        </>
      }
    />
  );
}

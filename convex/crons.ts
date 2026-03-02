import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "agent-cycle",
  { minutes: 15 },
  internal.agentRun.runAgentCycle
);

crons.interval(
  "position-refresh",
  { minutes: 5 },
  internal.agentRun.refreshPositions
);

crons.cron(
  "daily-analytics",
  "0 0 * * *",
  internal.agentRun.computeDailyAnalytics
);

export default crons;

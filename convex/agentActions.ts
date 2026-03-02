import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const logActionArgs = {
  type: v.union(
    v.literal("scan"),
    v.literal("filter"),
    v.literal("screen"),
    v.literal("research"),
    v.literal("trade"),
    v.literal("position_refresh"),
    v.literal("error")
  ),
  summary: v.string(),
  details: v.any(),
  timestamp: v.float64(),
  cycleId: v.optional(v.string()),
};

export const logAction = mutation({
  args: logActionArgs,
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentActions", args);
  },
});

export const internalLogAction = internalMutation({
  args: logActionArgs,
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentActions", args);
  },
});

export const listActions = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const q = ctx.db.query("agentActions").order("desc");
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const recentActions = query({
  args: { limit: v.float64() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentActions")
      .order("desc")
      .take(args.limit);
  },
});

export const actionsByCycle = query({
  args: { cycleId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentActions")
      .withIndex("by_cycleId", (q) => q.eq("cycleId", args.cycleId))
      .order("desc")
      .collect();
  },
});

export const listCycles = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("agentActions").order("desc").collect();
    const cycleMap = new Map<
      string,
      {
        cycleId: string;
        startedAt: number;
        endedAt: number;
        stages: Array<{ type: string; summary: string; timestamp: number; details: any }>;
        tradeCount: number;
        hasError: boolean;
      }
    >();

    for (const action of all) {
      const cid = action.cycleId ?? "unknown";
      let cycle = cycleMap.get(cid);
      if (!cycle) {
        cycle = {
          cycleId: cid,
          startedAt: action.timestamp,
          endedAt: action.timestamp,
          stages: [],
          tradeCount: 0,
          hasError: false,
        };
        cycleMap.set(cid, cycle);
      }
      cycle.stages.push({
        type: action.type,
        summary: action.summary,
        timestamp: action.timestamp,
        details: action.details,
      });
      if (action.timestamp < cycle.startedAt) cycle.startedAt = action.timestamp;
      if (action.timestamp > cycle.endedAt) cycle.endedAt = action.timestamp;
      if (action.type === "trade") {
        const d = action.details as any;
        const isSkip = d?.decision?.action === "skip";
        if (!isSkip) cycle.tradeCount++;
      }
      if (action.type === "error") cycle.hasError = true;
    }

    const cycles = Array.from(cycleMap.values()).sort(
      (a, b) => b.startedAt - a.startedAt
    );

    return args.limit ? cycles.slice(0, args.limit) : cycles;
  },
});

export const cycleStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("agentActions").collect();
    const cycleIds = new Set<string>();
    let totalTrades = 0;
    let totalSkips = 0;
    let totalErrors = 0;

    for (const action of all) {
      if (action.cycleId) cycleIds.add(action.cycleId);
      if (action.type === "trade") {
        const d = action.details as any;
        if (d?.decision?.action === "skip") {
          totalSkips++;
        } else {
          totalTrades++;
        }
      }
      if (action.type === "error") totalErrors++;
    }

    return {
      totalCycles: cycleIds.size,
      totalTrades,
      totalSkips,
      totalErrors,
    };
  },
});

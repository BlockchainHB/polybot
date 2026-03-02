import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertAnalytics = mutation({
  args: {
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("all_time")),
    date: v.string(),
    totalPnl: v.float64(),
    totalTrades: v.float64(),
    winCount: v.float64(),
    lossCount: v.float64(),
    winRate: v.float64(),
    totalVolume: v.float64(),
    portfolioValue: v.float64(),
    cumulativeReturn: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analytics")
      .withIndex("by_period_date", (q) =>
        q.eq("period", args.period).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("analytics", args);
  },
});

export const getAnalytics = query({
  args: {
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("all_time")),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analytics")
      .withIndex("by_period_date", (q) =>
        q.eq("period", args.period).eq("date", args.date)
      )
      .first();
  },
});

export const dailyAnalytics = query({
  args: { limit: v.float64() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("analytics")
      .withIndex("by_period_date", (q) => q.eq("period", "daily"))
      .order("desc")
      .take(args.limit);
    return all;
  },
});

// --- Internal version for agentRun.ts ---

const upsertAnalyticsArgs = {
  period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("all_time")),
  date: v.string(),
  totalPnl: v.float64(),
  totalTrades: v.float64(),
  winCount: v.float64(),
  lossCount: v.float64(),
  winRate: v.float64(),
  totalVolume: v.float64(),
  portfolioValue: v.float64(),
  cumulativeReturn: v.float64(),
};

export const internalUpsertAnalytics = internalMutation({
  args: upsertAnalyticsArgs,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analytics")
      .withIndex("by_period_date", (q) =>
        q.eq("period", args.period).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("analytics", args);
  },
});

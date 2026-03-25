import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Increment usage counters for an API service (upsert: one row per service per day).
 */
export const internalIncrementUsage = internalMutation({
  args: {
    service: v.string(),
    date: v.string(),
    latencyMs: v.float64(),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("apiUsage")
      .withIndex("by_service_date", (q) =>
        q.eq("service", args.service).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalCalls: existing.totalCalls + 1,
        successCount: existing.successCount + (args.success ? 1 : 0),
        failureCount: existing.failureCount + (args.success ? 0 : 1),
        totalLatencyMs: existing.totalLatencyMs + args.latencyMs,
        lastCalledAt: Date.now(),
      });
    } else {
      await ctx.db.insert("apiUsage", {
        service: args.service,
        date: args.date,
        totalCalls: 1,
        successCount: args.success ? 1 : 0,
        failureCount: args.success ? 0 : 1,
        totalLatencyMs: args.latencyMs,
        lastCalledAt: Date.now(),
      });
    }
  },
});

/**
 * Get usage stats for the last N days.
 */
export const getUsageStats = query({
  args: { days: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const days = args.days ?? 7;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const all = await ctx.db
      .query("apiUsage")
      .withIndex("by_date")
      .order("desc")
      .collect();

    return all.filter((r) => r.date >= cutoff);
  },
});

/**
 * Get today's usage summary (aggregated per service).
 */
export const getTodaySummary = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);

    const rows = await ctx.db
      .query("apiUsage")
      .withIndex("by_date")
      .order("desc")
      .collect();

    return rows.filter((r) => r.date === today);
  },
});

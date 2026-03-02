import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertMarket = mutation({
  args: {
    conditionId: v.string(),
    question: v.string(),
    slug: v.string(),
    volume: v.float64(),
    liquidity: v.float64(),
    endDate: v.string(),
    lastChecked: v.float64(),
    yesPrice: v.optional(v.float64()),
    noPrice: v.optional(v.float64()),
    negRisk: v.boolean(),
    confidenceScore: v.optional(v.float64()),
    sentiment: v.optional(
      v.union(
        v.literal("bullish"),
        v.literal("bearish"),
        v.literal("neutral"),
        v.literal("mixed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("markets")
      .withIndex("by_conditionId", (q) => q.eq("conditionId", args.conditionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("markets", args);
  },
});

export const updateMarketScore = mutation({
  args: {
    marketId: v.id("markets"),
    confidenceScore: v.float64(),
    sentiment: v.union(
      v.literal("bullish"),
      v.literal("bearish"),
      v.literal("neutral"),
      v.literal("mixed")
    ),
  },
  handler: async (ctx, args) => {
    const { marketId, ...fields } = args;
    await ctx.db.patch(marketId, fields);
  },
});

export const listMarkets = query({
  args: {},
  handler: async (ctx) => {
    const markets = await ctx.db.query("markets").collect();
    return markets.sort((a, b) => b.volume - a.volume);
  },
});

export const getMarketByCondition = query({
  args: { conditionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("markets")
      .withIndex("by_conditionId", (q) => q.eq("conditionId", args.conditionId))
      .first();
  },
});

export const getSlugByCondition = query({
  args: { conditionId: v.string() },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("markets")
      .withIndex("by_conditionId", (q) => q.eq("conditionId", args.conditionId))
      .first();
    return market?.slug ?? null;
  },
});

export const topMarkets = query({
  args: { limit: v.float64() },
  handler: async (ctx, args) => {
    const markets = await ctx.db.query("markets").collect();
    return markets
      .filter((m) => m.confidenceScore !== undefined)
      .sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))
      .slice(0, args.limit);
  },
});

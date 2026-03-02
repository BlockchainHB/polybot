import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const recordTrade = mutation({
  args: {
    conditionId: v.string(),
    question: v.string(),
    tokenId: v.string(),
    side: v.union(v.literal("buy_yes"), v.literal("buy_no")),
    size: v.float64(),
    price: v.float64(),
    confidence: v.float64(),
    reasoning: v.string(),
    orderId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("filled"),
      v.literal("rejected"),
      v.literal("error"),
      v.literal("dry_run")
    ),
    executedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("trades", args);
  },
});

export const updateTradeStatus = mutation({
  args: {
    tradeId: v.id("trades"),
    status: v.union(
      v.literal("pending"),
      v.literal("filled"),
      v.literal("rejected"),
      v.literal("error"),
      v.literal("dry_run")
    ),
    orderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tradeId, ...fields } = args;
    await ctx.db.patch(tradeId, fields);
  },
});

export const updateTradePnl = mutation({
  args: {
    tradeId: v.id("trades"),
    pnl: v.float64(),
    exitPrice: v.float64(),
    resolvedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const { tradeId, ...fields } = args;
    await ctx.db.patch(tradeId, fields);
  },
});

export const listTrades = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("trades").order("desc").collect();
  },
});

export const getTradesByStatus = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("filled"),
      v.literal("rejected"),
      v.literal("error"),
      v.literal("dry_run")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const recentTrades = query({
  args: { limit: v.float64() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trades")
      .order("desc")
      .take(args.limit);
  },
});

// --- Internal versions for agentRun.ts ---

const recordTradeArgs = {
  conditionId: v.string(),
  question: v.string(),
  tokenId: v.string(),
  side: v.union(v.literal("buy_yes"), v.literal("buy_no")),
  size: v.float64(),
  price: v.float64(),
  confidence: v.float64(),
  reasoning: v.string(),
  orderId: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("filled"),
    v.literal("rejected"),
    v.literal("error"),
    v.literal("dry_run")
  ),
  executedAt: v.float64(),
};

export const internalRecordTrade = internalMutation({
  args: recordTradeArgs,
  handler: async (ctx, args) => {
    return await ctx.db.insert("trades", args);
  },
});

export const internalGetTradesByStatus = internalQuery({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("filled"),
      v.literal("rejected"),
      v.literal("error"),
      v.literal("dry_run")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trades")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

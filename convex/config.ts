import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const setConfig = mutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("config", {
      key: args.key,
      value: args.value,
      updatedAt: Date.now(),
    });
  },
});

export const getConfig = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return entry ?? null;
  },
});

export const internalGetConfig = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return entry ?? null;
  },
});

export const getAllConfig = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("config").collect();
  },
});

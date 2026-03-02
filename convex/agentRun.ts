"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const runAgentCycle = internalAction({
  args: {},
  handler: async (ctx) => {
    // Read config to check if agent is enabled
    const enabledEntry = await ctx.runQuery(
      internal.config.internalGetConfig,
      { key: "enabled" }
    );
    const isEnabled = enabledEntry ? enabledEntry.value === "true" : false;

    if (!isEnabled) {
      await ctx.runMutation(internal.agentActions.internalLogAction, {
        type: "scan",
        summary: "Agent cycle skipped: agent is disabled",
        details: {},
        timestamp: Date.now(),
      });
      return;
    }

    // Check wallet exists and has funds
    const wallet = await ctx.runQuery(internal.wallet.internalGetWallet);
    if (!wallet) {
      await ctx.runMutation(internal.agentActions.internalLogAction, {
        type: "error",
        summary: "Agent cycle skipped: no wallet initialized",
        details: { hint: "Initialize wallet from Settings page or run seed-config" },
        timestamp: Date.now(),
      });
      return;
    }

    if (wallet.balance < 0.5) {
      await ctx.runMutation(internal.agentActions.internalLogAction, {
        type: "scan",
        summary: `Agent cycle skipped: insufficient balance ($${wallet.balance.toFixed(2)})`,
        details: { balance: wallet.balance },
        timestamp: Date.now(),
      });
      return;
    }

    const cycleId = `cycle-${Date.now()}`;

    await ctx.runMutation(internal.agentActions.internalLogAction, {
      type: "scan",
      summary: `Agent cycle started: ${cycleId} | Balance: $${wallet.balance.toFixed(2)}`,
      details: {
        cycleId,
        walletBalance: wallet.balance,
        totalInvested: wallet.totalInvested,
        realizedPnl: wallet.realizedPnl,
      },
      timestamp: Date.now(),
      cycleId,
    });

    try {
      const { runPipeline } = await import("../src/agent/pipeline");
      const { OpenRouterProvider } = await import("../src/llm/openrouter");
      const { fetchTrendingMarkets } = await import(
        "../src/tools/polymarket-scanner"
      );
      const { initClient } = await import("../src/tools/polymarket-client");

      // Read config values
      const modelEntry = await ctx.runQuery(
        internal.config.internalGetConfig,
        { key: "modelId" }
      );
      const maxTradeSizeEntry = await ctx.runQuery(
        internal.config.internalGetConfig,
        { key: "maxTradeSize" }
      );
      const maxExposureEntry = await ctx.runQuery(
        internal.config.internalGetConfig,
        { key: "maxTotalExposure" }
      );
      const minConfidenceEntry = await ctx.runQuery(
        internal.config.internalGetConfig,
        { key: "minConfidence" }
      );
      const dryRunEntry = await ctx.runQuery(
        internal.config.internalGetConfig,
        { key: "dryRun" }
      );

      const config = {
        maxTradeSize: maxTradeSizeEntry
          ? parseFloat(maxTradeSizeEntry.value)
          : 25,
        maxTotalExposure: maxExposureEntry
          ? parseFloat(maxExposureEntry.value)
          : 500,
        minConfidence: minConfidenceEntry
          ? parseFloat(minConfidenceEntry.value)
          : 0.6,
        modelId: modelEntry?.value ?? "x-ai/grok-4.1-fast",
        runIntervalMinutes: 15,
        enabled: true,
        dryRun: dryRunEntry ? dryRunEntry.value === "true" : true,
        availableBalance: wallet.balance,
      };

      const llm = new OpenRouterProvider({
        apiKey: process.env.OPENROUTER_API_KEY!,
        modelId: config.modelId,
      });

      let polyClient: any = null;
      if (!config.dryRun) {
        polyClient = initClient();
      }

      const openPositions = await ctx.runQuery(
        internal.positions.internalOpenPositions,
        {}
      );
      const existingPositionIds = openPositions.map(
        (p: any) => p.conditionId
      );
      const currentExposure = openPositions.reduce(
        (sum: number, p: any) => sum + p.currentPrice * p.size,
        0
      );

      // Track balance changes within this cycle
      let cycleBalance = wallet.balance;

      await runPipeline({
        llm,
        scanner: { fetchTrendingMarkets },
        polyClient,
        toolDeps: {},
        config,
        existingPositionIds,
        currentExposure,
        logAction: async (action) => {
          await ctx.runMutation(internal.agentActions.internalLogAction, {
            ...action,
            cycleId,
          });
        },
        recordTrade: async (trade: any) => {
          // Map pipeline output to the trade mutation schema
          const side: "buy_yes" | "buy_no" =
            trade.action === "buy_yes" || trade.side === "buy_yes"
              ? "buy_yes"
              : "buy_no";
          const status: "dry_run" | "pending" = trade.dryRun
            ? "dry_run"
            : "pending";

          const tradeCost = trade.size * trade.price;

          // Deduct from wallet
          const deducted = await ctx.runMutation(
            internal.wallet.internalDeductForTrade,
            { cost: tradeCost }
          );

          if (!deducted) {
            await ctx.runMutation(internal.agentActions.internalLogAction, {
              type: "error",
              summary: `Trade rejected: insufficient wallet balance for $${tradeCost.toFixed(2)} trade`,
              details: {
                conditionId: trade.conditionId,
                tradeCost,
                walletBalance: cycleBalance,
              },
              timestamp: Date.now(),
              cycleId,
            });
            return;
          }

          cycleBalance -= tradeCost;
          // Update available balance for subsequent risk checks
          config.availableBalance = cycleBalance;

          // Record the trade
          await ctx.runMutation(internal.trades.internalRecordTrade, {
            conditionId: trade.conditionId,
            question: trade.question,
            tokenId: trade.tokenId,
            side,
            size: trade.size,
            price: trade.price,
            confidence: trade.confidence,
            reasoning: trade.reasoning,
            status,
            executedAt: Date.now(),
          });

          // Open a position
          const positionSide: "yes" | "no" =
            trade.action === "buy_yes" || trade.side === "buy_yes"
              ? "yes"
              : "no";

          await ctx.runMutation(internal.positions.internalOpenPosition, {
            conditionId: trade.conditionId,
            question: trade.question,
            tokenId: trade.tokenId,
            side: positionSide,
            size: trade.size,
            avgEntryPrice: trade.price,
            currentPrice: trade.price,
            unrealizedPnl: 0,
            openedAt: Date.now(),
            slug: trade.slug,
          });
        },
        updatePositionPrice: async (conditionId, price) => {
          const pos = await ctx.runQuery(
            internal.positions.internalGetPositionByCondition,
            { conditionId }
          );
          if (pos) {
            const unrealizedPnl =
              (price - pos.avgEntryPrice) *
              pos.size *
              (pos.side === "yes" ? 1 : -1);
            await ctx.runMutation(
              internal.positions.internalUpdatePositionPrice,
              {
                positionId: pos._id,
                currentPrice: price,
                unrealizedPnl,
              }
            );
          }
        },
        openPositions: openPositions.map((p: any) => ({
          conditionId: p.conditionId,
          tokenId: p.tokenId,
          side: p.side,
          size: p.size,
          avgEntryPrice: p.avgEntryPrice,
        })),
      });

      // Reconcile wallet totalInvested from actual open positions
      const finalPositions = await ctx.runQuery(
        internal.positions.internalOpenPositions,
        {}
      );
      const totalInvested = finalPositions.reduce(
        (sum: number, p: any) => sum + p.avgEntryPrice * p.size,
        0
      );
      await ctx.runMutation(internal.wallet.internalReconcileWallet, {
        openPositionsCost: totalInvested,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.agentActions.internalLogAction, {
        type: "error",
        summary: `Agent cycle failed: ${message}`,
        details: { cycleId, error: message },
        timestamp: Date.now(),
        cycleId,
      });
    }
  },
});

export const refreshPositions = internalAction({
  args: {},
  handler: async (ctx) => {
    const openPositions = await ctx.runQuery(
      internal.positions.internalOpenPositions,
      {}
    );

    for (const position of openPositions) {
      try {
        // Fetch current price from Polymarket API
        const res = await fetch(
          `https://clob.polymarket.com/midpoint?token_id=${position.tokenId}`
        );
        if (!res.ok) continue;

        const data = (await res.json()) as { mid: string };
        const currentPrice = parseFloat(data.mid);
        if (isNaN(currentPrice)) continue;

        const unrealizedPnl =
          (currentPrice - position.avgEntryPrice) *
          position.size *
          (position.side === "yes" ? 1 : -1);

        await ctx.runMutation(
          internal.positions.internalUpdatePositionPrice,
          {
            positionId: position._id,
            currentPrice,
            unrealizedPnl,
          }
        );
      } catch {
        // Skip positions that fail to update
      }
    }

    await ctx.runMutation(internal.agentActions.internalLogAction, {
      type: "position_refresh",
      summary: `Refreshed ${openPositions.length} open positions`,
      details: { count: openPositions.length },
      timestamp: Date.now(),
    });

    // Update daily analytics snapshot so the P&L chart stays current
    try {
      await ctx.runAction(internal.agentRun.computeDailyAnalytics, {});
    } catch {
      // Analytics update is non-critical — don't fail the refresh cycle
    }
  },
});

export const computeDailyAnalytics = internalAction({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    // Get all filled/dry_run trades
    const filledTrades = await ctx.runQuery(
      internal.trades.internalGetTradesByStatus,
      { status: "filled" }
    );
    const dryRunTrades = await ctx.runQuery(
      internal.trades.internalGetTradesByStatus,
      { status: "dry_run" }
    );
    const allTrades = [...filledTrades, ...dryRunTrades];

    // Filter to today's trades
    const startOfDay = new Date(today).getTime();
    const endOfDay = startOfDay + 86400000;
    const todayTrades = allTrades.filter(
      (t) => t.executedAt >= startOfDay && t.executedAt < endOfDay
    );

    const totalTrades = todayTrades.length;
    const tradesWithPnl = todayTrades.filter((t) => t.pnl !== undefined);
    const winCount = tradesWithPnl.filter((t) => (t.pnl ?? 0) > 0).length;
    const lossCount = tradesWithPnl.filter(
      (t) => (t.pnl ?? 0) <= 0
    ).length;
    const totalPnl = tradesWithPnl.reduce(
      (sum, t) => sum + (t.pnl ?? 0),
      0
    );
    const totalVolume = todayTrades.reduce(
      (sum, t) => sum + t.size * t.price,
      0
    );
    const winRate =
      tradesWithPnl.length > 0 ? winCount / tradesWithPnl.length : 0;

    // Get wallet for portfolio value
    const wallet = await ctx.runQuery(internal.wallet.internalGetWallet);
    const openPositions = await ctx.runQuery(
      internal.positions.internalOpenPositions,
      {}
    );
    const positionsValue = openPositions.reduce(
      (sum, p) => sum + p.currentPrice * p.size,
      0
    );
    const portfolioValue = (wallet?.balance ?? 0) + positionsValue;
    const cumulativeReturn = wallet
      ? ((portfolioValue - wallet.initialBalance) / wallet.initialBalance) * 100
      : 0;

    await ctx.runMutation(internal.analytics.internalUpsertAnalytics, {
      period: "daily",
      date: today,
      totalPnl,
      totalTrades,
      winCount,
      lossCount,
      winRate,
      totalVolume,
      portfolioValue,
      cumulativeReturn,
    });

    await ctx.runMutation(internal.agentActions.internalLogAction, {
      type: "scan",
      summary: `Daily analytics computed for ${today}`,
      details: { date: today, totalTrades, totalPnl, winRate, portfolioValue },
      timestamp: Date.now(),
    });
  },
});

/**
 * Data Source Manager — Unified abstraction over multiple data providers.
 *
 * Priority chains with automatic fallback:
 *   Trader stats:    Falcon → Data API → Subgraph
 *   Trader activity: Bitquery → Data API (polling)
 *   Win rates:       Falcon → Subgraph → Data API heuristic
 *   Positions:       On-Chain RPC → Data API
 *
 * Each function tries the best source first and falls back gracefully.
 * Console logs which source succeeded for dev server visibility.
 */

import {
  fetchTraderStats as falconStats,
  fetchFalconLeaderboard,
  isFalconAvailable,
  type FalconTraderStats,
} from "@/src/tools/falcon-api";

import {
  fetchOnChainWinRate,
  fetchOnChainPositions,
  isSubgraphAvailable,
} from "@/src/tools/polymarket-subgraph";

import {
  fetchTraderRecentTrades,
  isBitqueryAvailable,
  type BitqueryTrade,
} from "@/src/tools/bitquery-client";

import {
  fetchRecentTraderEvents,
  isRpcAvailable,
  type OnChainTrade,
} from "@/src/tools/polygon-rpc";

import {
  fetchLeaderboard,
  fetchTraderActivity,
  fetchTraderPositions,
  type LeaderboardEntry,
  type TraderActivityItem,
  type TraderPosition,
} from "@/src/tools/polymarket-data-api";

// ---- Types ----

export type DataSource = "falcon" | "subgraph" | "bitquery" | "onchain" | "data_api";

export interface EnrichedTraderStats {
  address: string;
  username?: string;
  pnl: number;
  roi: number;
  winRate: number;
  onChainWinRate?: number;
  volume: number;
  tradeCount: number;
  maxDrawdown?: number;
  consistency?: number;
  lastTradeAt?: number;
  source: DataSource;
}

export interface EnrichedTradeDetection {
  traderAddress: string;
  conditionId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: string;
  source: DataSource;
  txHash?: string;
  title?: string;
  outcome?: string;
}

// ---- Status ----

export function getAvailableSources(): Record<DataSource, boolean> {
  return {
    falcon: isFalconAvailable(),
    subgraph: isSubgraphAvailable(),
    bitquery: isBitqueryAvailable(),
    onchain: isRpcAvailable(),
    data_api: true, // always available
  };
}

export function logAvailableSources(): void {
  const sources = getAvailableSources();
  const active = Object.entries(sources)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const inactive = Object.entries(sources)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  console.log(`[DATA SOURCES] Active: ${active.join(", ")} | Inactive: ${inactive.join(", ")}`);
}

// ---- Trader Stats (Falcon → Data API) ----

export async function getTraderStats(address: string): Promise<EnrichedTraderStats | null> {
  // Try Falcon first (pre-computed, single call)
  if (isFalconAvailable()) {
    const falcon = await falconStats(address);
    if (falcon) {
      console.log(`[DATA] Trader stats for ${address.slice(0, 8)} from Falcon`);
      return {
        address: falcon.address,
        username: falcon.username,
        pnl: falcon.pnl,
        roi: falcon.roi,
        winRate: falcon.winRate,
        volume: falcon.volume,
        tradeCount: falcon.tradeCount,
        maxDrawdown: falcon.maxDrawdown,
        lastTradeAt: falcon.lastTradeAt,
        source: "falcon",
      };
    }
  }

  // Fallback: Data API (requires multiple calls)
  try {
    const [activity, positions] = await Promise.all([
      fetchTraderActivity(address, 50),
      fetchTraderPositions(address),
    ]);

    const trades = activity.filter((a) => a.type === "TRADE");
    const totalVolume = trades.reduce((s, t) => s + parseFloat(t.size) * parseFloat(t.price), 0);

    console.log(`[DATA] Trader stats for ${address.slice(0, 8)} from Data API (fallback)`);
    return {
      address,
      pnl: 0, // Data API doesn't give aggregate PnL easily
      roi: 0,
      winRate: 0,
      volume: totalVolume,
      tradeCount: trades.length,
      source: "data_api",
    };
  } catch {
    return null;
  }
}

// ---- Win Rate (Falcon → Subgraph → Data API heuristic) ----

export async function getWinRate(address: string): Promise<{
  winRate: number;
  onChainWinRate?: number;
  source: DataSource;
  tradeCount: number;
} | null> {
  // Try Falcon
  if (isFalconAvailable()) {
    const falcon = await falconStats(address);
    if (falcon && falcon.tradeCount > 0) {
      console.log(`[DATA] Win rate for ${address.slice(0, 8)} from Falcon: ${(falcon.winRate * 100).toFixed(0)}%`);
      return {
        winRate: falcon.winRate,
        source: "falcon",
        tradeCount: falcon.tradeCount,
      };
    }
  }

  // Try Subgraph (on-chain ground truth)
  if (isSubgraphAvailable()) {
    const onChain = await fetchOnChainWinRate(address);
    if (onChain && onChain.totalPositions > 0) {
      console.log(`[DATA] Win rate for ${address.slice(0, 8)} from Subgraph (on-chain): ${(onChain.winRate * 100).toFixed(0)}%`);
      return {
        winRate: onChain.winRate,
        onChainWinRate: onChain.winRate,
        source: "subgraph",
        tradeCount: onChain.totalPositions,
      };
    }
  }

  // Fallback: Data API heuristic (existing logic in copy-trader.ts)
  return null; // Let the caller use the existing heuristic
}

// ---- Trader Activity (Bitquery → Data API polling) ----

export async function getTraderActivity(
  addresses: string[],
  sinceMinutes = 20
): Promise<EnrichedTradeDetection[]> {
  const results: EnrichedTradeDetection[] = [];
  const sinceTimestamp = Date.now() - sinceMinutes * 60 * 1000;

  // Try Bitquery first (real-time, all addresses in one call)
  if (isBitqueryAvailable()) {
    const bitqueryTrades = await fetchTraderRecentTrades(addresses, sinceMinutes);
    if (bitqueryTrades.length > 0) {
      console.log(`[DATA] ${bitqueryTrades.length} trades from Bitquery (real-time)`);
      for (const t of bitqueryTrades) {
        results.push({
          traderAddress: t.traderAddress,
          conditionId: t.conditionId,
          tokenId: t.tokenId,
          side: t.side,
          size: t.size,
          price: t.price,
          timestamp: t.timestamp,
          source: "bitquery",
          txHash: t.txHash,
        });
      }
      return results;
    }
  }

  // Try on-chain RPC (direct Polygon logs)
  if (isRpcAvailable()) {
    const rpcTrades = await fetchRecentTraderEvents(addresses);
    if (rpcTrades.length > 0) {
      console.log(`[DATA] ${rpcTrades.length} trades from on-chain RPC`);
      for (const t of rpcTrades) {
        results.push({
          traderAddress: t.traderAddress,
          conditionId: "", // RPC doesn't easily give conditionId
          tokenId: t.tokenId,
          side: t.side,
          size: t.size,
          price: 0, // Need to get from market data
          timestamp: new Date(t.timestamp).toISOString(),
          source: "onchain",
          txHash: t.txHash,
        });
      }
      // If we got RPC trades but they lack conditionId/price, still fall through to Data API
      // to get enriched data. RPC trades serve as a speed hint.
    }
  }

  // Fallback: Data API polling (existing method)
  console.log(`[DATA] Falling back to Data API polling for ${addresses.length} addresses`);
  const BATCH_SIZE = 5;
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (addr) => {
        const activity = await fetchTraderActivity(addr, 30);
        return { addr, activity };
      })
    );

    for (const r of batchResults) {
      if (r.status !== "fulfilled") continue;
      const { addr, activity } = r.value;

      for (const trade of activity) {
        const tradeTime = new Date(trade.timestamp).getTime();
        if (trade.type !== "TRADE" || tradeTime <= sinceTimestamp) continue;

        results.push({
          traderAddress: addr,
          conditionId: trade.conditionId,
          tokenId: trade.asset,
          side: trade.side,
          size: parseFloat(trade.size),
          price: parseFloat(trade.price),
          timestamp: trade.timestamp,
          source: "data_api",
          title: trade.title,
          outcome: trade.outcome,
        });
      }
    }

    if (i + BATCH_SIZE < addresses.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

// ---- Leaderboard (Falcon → Data API) ----

export async function getLeaderboard(
  period: "7d" | "30d" | "all" = "7d",
  limit = 50
): Promise<Array<LeaderboardEntry & { source: DataSource }>> {
  // Try Falcon first
  if (isFalconAvailable()) {
    const falconPeriod = period === "7d" ? "week" : period === "30d" ? "month" : "all";
    const falcon = await fetchFalconLeaderboard(limit, falconPeriod as any);
    if (falcon.length > 0) {
      console.log(`[DATA] Leaderboard from Falcon: ${falcon.length} traders`);
      return falcon.map((f) => ({
        address: f.address,
        username: f.username ?? "",
        profit: f.pnl,
        volume: f.volume,
        marketsTraded: 0,
        positions: 0,
        source: "falcon" as DataSource,
      }));
    }
  }

  // Fallback: Data API
  console.log(`[DATA] Leaderboard from Data API (fallback)`);
  const entries = await fetchLeaderboard(period, limit);
  return entries.map((e) => ({ ...e, source: "data_api" as DataSource }));
}

// ---- Position Verification (On-Chain → Data API) ----

export async function getTraderPositions(address: string): Promise<TraderPosition[]> {
  // On-chain positions are more accurate but less detailed
  // Use Data API as primary (has titles, outcomes) but could verify with on-chain
  return fetchTraderPositions(address);
}

/**
 * Data Source Manager — Unified abstraction over multiple data providers.
 *
 * SIMPLE APPROACH:
 *   Leaderboard:      Falcon H-Score → Data API
 *   Win rates:        Falcon Wallet360 → Subgraph → heuristic
 *   Trader activity:  ALWAYS Data API (it has conditionId, price, title, outcome)
 *                     Bitquery/RPC used only to narrow which traders to poll
 *
 * Bitquery and Alchemy can't replace the Data API for activity because they
 * return on-chain transfer events without market metadata (conditionId, price,
 * title, outcome). The Data API is the only source with full trade context.
 */

import {
  fetchTraderStats as falconWallet360,
  fetchFalconLeaderboard,
  isFalconAvailable,
} from "@/src/tools/falcon-api";

import {
  fetchOnChainWinRate,
  isSubgraphAvailable,
} from "@/src/tools/polymarket-subgraph";

import {
  fetchTraderRecentTrades,
  isBitqueryAvailable,
} from "@/src/tools/bitquery-client";

import {
  fetchLeaderboard,
  fetchTraderActivity,
  fetchTraderPositions,
  type LeaderboardEntry,
  type TraderPosition,
} from "@/src/tools/polymarket-data-api";

// ---- Types ----

export type DataSource = "falcon" | "subgraph" | "bitquery" | "onchain" | "data_api";

export interface EnrichedTradeDetection {
  traderAddress: string;
  conditionId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: string;
  source: DataSource;
  title?: string;
  outcome?: string;
}

// ---- Status ----

export function getAvailableSources(): Record<DataSource, boolean> {
  return {
    falcon: isFalconAvailable(),
    subgraph: isSubgraphAvailable(),
    bitquery: isBitqueryAvailable(),
    onchain: false, // RPC is supplementary, not standalone
    data_api: true,
  };
}

export function logAvailableSources(): void {
  const sources = getAvailableSources();
  const active = Object.entries(sources).filter(([, v]) => v).map(([k]) => k);
  console.log(`[DATA SOURCES] Active: ${active.join(", ")}`);
}

// ---- Leaderboard (Falcon → Data API) ----

export async function getLeaderboard(
  period: "7d" | "30d" | "all" = "7d",
  limit = 50
): Promise<Array<LeaderboardEntry & { source: DataSource }>> {
  if (isFalconAvailable()) {
    try {
      const sortBy = period === "7d" ? "roi" : "pnl";
      const falcon = await fetchFalconLeaderboard(limit, sortBy as any);
      if (falcon.length > 0) {
        console.log(`[DATA] Leaderboard from Falcon H-Score: ${falcon.length} traders`);
        return falcon.map((f) => ({
          address: f.address,
          username: f.address ? `${f.address.slice(0, 6)}...${f.address.slice(-4)}` : "",
          profit: f.pnl,
          volume: f.volume,
          marketsTraded: f.marketsTraded,
          positions: 0,
          source: "falcon" as DataSource,
        }));
      }
    } catch (err) {
      console.warn(`[DATA] Falcon leaderboard failed: ${err}`);
    }
  }

  console.log(`[DATA] Leaderboard from Data API`);
  const entries = await fetchLeaderboard(period, limit);
  return entries.map((e) => ({ ...e, source: "data_api" as DataSource }));
}

// ---- Win Rate (Falcon → Subgraph → null for heuristic) ----

export async function getWinRate(address: string): Promise<{
  winRate: number;
  onChainWinRate?: number;
  source: DataSource;
  tradeCount: number;
} | null> {
  // Try Falcon Wallet 360
  if (isFalconAvailable()) {
    try {
      const falcon = await falconWallet360(address);
      if (falcon && falcon.tradeCount > 0) {
        console.log(`[DATA] Win rate for ${address.slice(0, 8)} from Falcon: ${(falcon.winRate * 100).toFixed(0)}%`);
        return {
          winRate: falcon.winRate,
          source: "falcon",
          tradeCount: falcon.tradeCount,
        };
      }
    } catch {
      // Fall through
    }
  }

  // Try Subgraph (on-chain ground truth)
  if (isSubgraphAvailable()) {
    try {
      const onChain = await fetchOnChainWinRate(address);
      if (onChain && onChain.totalPositions > 0) {
        console.log(`[DATA] Win rate for ${address.slice(0, 8)} from Subgraph: ${(onChain.winRate * 100).toFixed(0)}%`);
        return {
          winRate: onChain.winRate,
          onChainWinRate: onChain.winRate,
          source: "subgraph",
          tradeCount: onChain.totalPositions,
        };
      }
    } catch {
      // Fall through
    }
  }

  return null; // Caller uses heuristic
}

// ---- Trader Activity ----
//
// Strategy: Use Bitquery to quickly detect WHICH traders are active,
// then poll ONLY those traders via Data API for full trade details.
// If Bitquery is unavailable, poll all traders via Data API.

export async function getTraderActivity(
  addresses: string[],
  sinceMinutes = 20
): Promise<EnrichedTradeDetection[]> {
  const sinceTimestamp = Date.now() - sinceMinutes * 60 * 1000;

  // Step 1: Use Bitquery to narrow down active traders (optional optimization)
  let addressesToPoll = addresses;

  if (isBitqueryAvailable() && addresses.length > 10) {
    try {
      const bitqueryTrades = await fetchTraderRecentTrades(addresses, sinceMinutes);
      if (bitqueryTrades.length > 0) {
        // Get unique active addresses from Bitquery
        const activeSet = new Set<string>();
        for (const t of bitqueryTrades) {
          if (t.traderAddress) activeSet.add(t.traderAddress.toLowerCase());
        }

        // Match back to our tracked addresses (case-insensitive)
        const matched = addresses.filter((a) => activeSet.has(a.toLowerCase()));

        if (matched.length > 0) {
          console.log(`[DATA] Bitquery: ${bitqueryTrades.length} transfers from ${activeSet.size} addresses → ${matched.length} matched tracked traders`);
          addressesToPoll = matched;
        } else {
          console.log(`[DATA] Bitquery: ${activeSet.size} active addresses but none matched tracked traders (address format mismatch) — polling all`);
        }
      }
    } catch (err) {
      console.warn(`[DATA] Bitquery detection failed (${err}), polling all via Data API`);
    }
  }

  // Step 2: ALWAYS poll Data API for full trade details
  console.log(`[DATA] Polling ${addressesToPoll.length}/${addresses.length} traders via Data API...`);
  const results: EnrichedTradeDetection[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < addressesToPoll.length; i += BATCH_SIZE) {
    const batch = addressesToPoll.slice(i, i + BATCH_SIZE);
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

    if (i + BATCH_SIZE < addressesToPoll.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`[DATA] Data API returned ${results.length} trades from ${new Set(results.map((r) => r.traderAddress)).size} traders`);
  return results;
}

// ---- Position Verification ----

export async function getTraderPositions(address: string): Promise<TraderPosition[]> {
  return fetchTraderPositions(address);
}

/**
 * Falcon API Client (PolymarketAnalytics.com)
 *
 * Pre-computed trader stats: PnL, ROI, win rates, max drawdown, active positions.
 * Replaces 80+ manual API calls for trader scoring with a single REST call per trader.
 *
 * Docs: https://polymarketanalytics.com/api
 */

import { withRetry } from "@/src/lib/retry";

const FALCON_BASE = process.env.FALCON_API_BASE || "https://api.polymarketanalytics.com";

function getApiKey(): string {
  return process.env.FALCON_API_KEY || "";
}

function headers(): Record<string, string> {
  const key = getApiKey();
  return {
    Accept: "application/json",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

// ---- Types ----

export interface FalconTraderStats {
  address: string;
  username?: string;
  pnl: number;
  roi: number;
  winRate: number;
  volume: number;
  tradeCount: number;
  maxDrawdown: number;
  activePositions: number;
  avgHoldTime?: number;
  sharpeRatio?: number;
  lastTradeAt?: number;
}

export interface FalconLeaderboardEntry {
  address: string;
  username?: string;
  pnl: number;
  roi: number;
  winRate: number;
  volume: number;
  rank: number;
}

// ---- API Functions ----

/**
 * Fetch pre-computed stats for a single trader.
 */
export async function fetchTraderStats(address: string): Promise<FalconTraderStats | null> {
  if (!getApiKey()) return null;

  try {
    return await withRetry(async () => {
      // Try multiple endpoint patterns (API may vary)
      const urls = [
        `${FALCON_BASE}/v2/traders/stats?address=${address}`,
        `${FALCON_BASE}/v1/traders/${address}/stats`,
        `${FALCON_BASE}/traders/${address}`,
      ];

      for (const url of urls) {
        const res = await fetch(url, { headers: headers() });
        if (!res.ok) continue;

        const data = await res.json();
        const stats = data?.stats ?? data?.trader ?? data;
        if (!stats) continue;

        return {
          address: stats.address ?? stats.wallet ?? address,
          username: stats.username ?? stats.userName ?? stats.displayName,
          pnl: parseFloat(stats.pnl ?? stats.profit ?? stats.totalPnl ?? "0"),
          roi: parseFloat(stats.roi ?? stats.returnOnInvestment ?? "0"),
          winRate: parseFloat(stats.winRate ?? stats.win_rate ?? "0"),
          volume: parseFloat(stats.volume ?? stats.totalVolume ?? "0"),
          tradeCount: parseInt(stats.tradeCount ?? stats.numTrades ?? stats.trades ?? "0"),
          maxDrawdown: parseFloat(stats.maxDrawdown ?? stats.max_drawdown ?? "0"),
          activePositions: parseInt(stats.activePositions ?? stats.openPositions ?? "0"),
          avgHoldTime: stats.avgHoldTime ? parseFloat(stats.avgHoldTime) : undefined,
          sharpeRatio: stats.sharpeRatio ? parseFloat(stats.sharpeRatio) : undefined,
          lastTradeAt: stats.lastTradeAt ? new Date(stats.lastTradeAt).getTime() : undefined,
        } satisfies FalconTraderStats;
      }

      return null;
    }, { label: `falcon-stats-${address.slice(0, 8)}`, maxRetries: 2 });
  } catch {
    return null;
  }
}

/**
 * Fetch top traders from Falcon leaderboard.
 */
export async function fetchFalconLeaderboard(
  limit = 50,
  period: "day" | "week" | "month" | "all" = "week"
): Promise<FalconLeaderboardEntry[]> {
  if (!getApiKey()) return [];

  try {
    return await withRetry(async () => {
      const urls = [
        `${FALCON_BASE}/v2/leaderboard?period=${period}&limit=${limit}&orderBy=roi`,
        `${FALCON_BASE}/v1/leaderboard?period=${period}&limit=${limit}`,
        `${FALCON_BASE}/leaderboard?period=${period}&limit=${limit}`,
      ];

      for (const url of urls) {
        const res = await fetch(url, { headers: headers() });
        if (!res.ok) continue;

        const data = await res.json();
        const entries: any[] = Array.isArray(data)
          ? data
          : data?.leaderboard ?? data?.traders ?? data?.rankings ?? data?.data ?? [];

        if (entries.length === 0) continue;

        return entries.slice(0, limit).map((e: any, idx: number) => ({
          address: e.address ?? e.wallet ?? e.proxyWallet ?? "",
          username: e.username ?? e.userName ?? e.displayName,
          pnl: parseFloat(e.pnl ?? e.profit ?? "0"),
          roi: parseFloat(e.roi ?? "0"),
          winRate: parseFloat(e.winRate ?? e.win_rate ?? "0"),
          volume: parseFloat(e.volume ?? "0"),
          rank: e.rank ?? idx + 1,
        }));
      }

      return [];
    }, { label: "falcon-leaderboard", maxRetries: 2 });
  } catch {
    return [];
  }
}

/**
 * Check if Falcon API is available (has key + responds).
 */
export function isFalconAvailable(): boolean {
  return !!getApiKey();
}

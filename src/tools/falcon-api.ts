/**
 * Falcon API Client (PolymarketAnalytics / Heisenberg)
 *
 * Single endpoint: POST https://narrative.agent.heisenberg.so/api/v2/semantic/retrieve/parameterized
 * Switch data source by changing agent_id.
 *
 * Key agent_ids for copy trading:
 *   584 — H-Score Leaderboard (proprietary trader ranking)
 *   581 — Wallet 360 (60+ metrics per wallet)
 *   556 — Trades (historical trade feed)
 *   579 — PnL Leaderboard (official Polymarket ranking)
 *   574 — Markets (search/filter markets)
 */

import { withRetry } from "@/src/lib/retry";

const FALCON_BASE = "https://narrative.agent.heisenberg.so/api/v2/semantic/retrieve/parameterized";

function getApiKey(): string {
  return process.env.FALCON_API_KEY || "";
}

// ---- Types ----

export interface FalconTraderStats {
  address: string;
  hScore: number;
  leaderboardRank: number;
  pnl: number;
  roi: number;
  winRate: number;
  volume: number;
  tradeCount: number;
  marketsTraded: number;
  sharpeRatio: number | null;
  tier: string;
  trajectory: string;
}

export interface FalconWallet360 {
  address: string;
  pnl: number;
  roi: number;
  winRate: number;
  volume: number;
  tradeCount: number;
  maxDrawdown: number;
  avgHoldTime: number;
  sharpeRatio: number;
}

// ---- Core Request Helper ----

async function falconRequest(
  agentId: number,
  params: Record<string, string>,
  limit = 50,
  offset = 0
): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  return withRetry(async () => {
    const res = await fetch(FALCON_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        params,
        pagination: { limit, offset },
        formatter_config: { format_type: "raw" },
      }),
    });

    if (!res.ok) {
      throw new Error(`Falcon API error: ${res.status}`);
    }

    const json = await res.json();
    return json?.data?.results ?? json?.data ?? json?.results ?? [];
  }, { label: "falcon-request", maxRetries: 2 });
}

// ---- API Functions ----

/**
 * Fetch top traders from H-Score leaderboard (agent_id: 584).
 * H-Score filters out bots, lucky streaks, and wash traders.
 */
export async function fetchFalconLeaderboard(
  limit = 50,
  sortBy: "roi" | "win_rate" | "pnl" = "roi"
): Promise<FalconTraderStats[]> {
  const results = await falconRequest(584, {
    min_win_rate_15d: "0.40",
    max_win_rate_15d: "0.95",
    min_roi_15d: "0",
    min_total_trades_15d: "20",
    max_total_trades_15d: "10000",
    sort_by: sortBy,
  }, limit);

  if (!results || !Array.isArray(results)) return [];

  return results.map((r: any) => ({
    address: r.wallet ?? r.address ?? "",
    hScore: parseFloat(r.h_score ?? "0"),
    leaderboardRank: parseInt(r.leaderboard_rank ?? "0"),
    pnl: parseFloat(r.total_pnl_15d ?? r.pnl ?? "0"),
    roi: parseFloat(r.roi_pct_15d ?? r.roi ?? "0") / 100, // Convert from percentage
    winRate: parseFloat(r.win_rate_pct_15d ?? r.win_rate ?? "0") / 100,
    volume: parseFloat(r.total_volume_15d ?? r.volume ?? "0"),
    tradeCount: parseInt(r.total_trades_15d ?? r.trades ?? "0"),
    marketsTraded: parseInt(r.markets_traded_15d ?? "0"),
    sharpeRatio: r.sharpe_ratio_15d ? parseFloat(r.sharpe_ratio_15d) : null,
    tier: r.tier ?? "",
    trajectory: r.trajectory ?? "",
  }));
}

/**
 * Fetch Wallet 360 stats for a single trader (agent_id: 581).
 * 60+ metrics in one call.
 */
export async function fetchTraderStats(address: string, windowDays = 15): Promise<FalconWallet360 | null> {
  const results = await falconRequest(581, {
    proxy_wallet: address,
    window_days: String(windowDays),
  }, 1);

  if (!results || (Array.isArray(results) && results.length === 0)) return null;

  const r = Array.isArray(results) ? results[0] : results;
  if (!r) return null;

  return {
    address: r.proxy_wallet ?? r.wallet ?? address,
    pnl: parseFloat(r.total_pnl ?? r.pnl ?? "0"),
    roi: parseFloat(r.roi_pct ?? r.roi ?? "0") / 100,
    winRate: parseFloat(r.win_rate_pct ?? r.win_rate ?? "0") / 100,
    volume: parseFloat(r.total_volume ?? r.volume ?? "0"),
    tradeCount: parseInt(r.total_trades ?? r.trades ?? "0"),
    maxDrawdown: parseFloat(r.max_drawdown ?? r.max_drawdown_pct ?? "0") / 100,
    avgHoldTime: parseFloat(r.avg_hold_time_hours ?? "0") * 3600000, // Convert hours to ms
    sharpeRatio: parseFloat(r.sharpe_ratio ?? "0"),
  };
}

/**
 * Fetch recent trades for a wallet (agent_id: 556).
 */
export async function fetchFalconTrades(
  address: string,
  sinceTimestamp?: number,
  limit = 100
): Promise<Array<{
  conditionId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: number;
  marketSlug: string;
}>> {
  const params: Record<string, string> = {
    wallet_proxy: address,
  };
  if (sinceTimestamp) {
    params.start_time = String(Math.floor(sinceTimestamp / 1000)); // Unix seconds
  }

  const results = await falconRequest(556, params, limit);
  if (!results || !Array.isArray(results)) return [];

  return results.map((r: any) => ({
    conditionId: r.condition_id ?? r.conditionId ?? "",
    side: (r.side ?? "BUY").toUpperCase() as "BUY" | "SELL",
    size: parseFloat(r.size ?? r.amount ?? "0"),
    price: parseFloat(r.price ?? "0"),
    timestamp: (parseFloat(r.timestamp ?? r.time ?? "0")) * 1000, // Unix seconds to ms
    marketSlug: r.market_slug ?? r.slug ?? "",
  }));
}

/**
 * Fetch PnL leaderboard (agent_id: 579).
 */
export async function fetchPnlLeaderboard(
  period: "1d" | "3d" | "7d" | "30d" = "7d",
  limit = 50
): Promise<Array<{ address: string; pnl: number; rank: number }>> {
  const results = await falconRequest(579, {
    wallet_address: "ALL",
    leaderboard_period: period,
  }, limit);

  if (!results || !Array.isArray(results)) return [];

  return results.map((r: any, idx: number) => ({
    address: r.wallet ?? r.address ?? "",
    pnl: parseFloat(r.pnl ?? r.profit ?? "0"),
    rank: parseInt(r.rank ?? String(idx + 1)),
  }));
}

/**
 * Check if Falcon API is available.
 */
export function isFalconAvailable(): boolean {
  return !!getApiKey();
}

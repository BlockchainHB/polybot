/**
 * The Graph — Polymarket Subgraph Client
 *
 * On-chain position/P&L data via GraphQL.
 * Provides ground-truth win rates from actual redemption data.
 * 100K queries/month free.
 *
 * Subgraph: Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp
 */

import { withRetry } from "@/src/lib/retry";

function getSubgraphUrl(): string {
  const apiKey = process.env.THEGRAPH_API_KEY || "";
  if (apiKey) {
    return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp`;
  }
  // Fallback to free hosted service (may be deprecated)
  return "https://api.thegraph.com/subgraphs/name/polymarket/polymarket-matic";
}

// ---- Types ----

export interface SubgraphPosition {
  conditionId: string;
  outcomeIndex: number;
  amount: string; // raw token amount
  avgPrice: number;
  redeemed: boolean;
  redeemedAmount: string;
  pnl: number;
  createdAt: number;
  closedAt?: number;
}

export interface SubgraphTraderStats {
  address: string;
  totalPositions: number;
  totalRedemptions: number;
  totalPnl: number;
  winCount: number;
  lossCount: number;
  onChainWinRate: number;
  avgReturn: number;
  positions: SubgraphPosition[];
}

// ---- GraphQL Query Helper ----

async function querySubgraph(query: string, variables: Record<string, any> = {}): Promise<any> {
  const url = getSubgraphUrl();

  return withRetry(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`Subgraph error: ${res.status}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(`Subgraph query error: ${json.errors[0]?.message}`);
    }

    return json.data;
  }, { label: "subgraph-query", maxRetries: 2 });
}

// ---- API Functions ----

/**
 * Fetch on-chain position history and compute real win rate.
 * A "win" = position redeemed at profit (payout > cost).
 */
export async function fetchOnChainWinRate(address: string): Promise<{
  winRate: number;
  winCount: number;
  lossCount: number;
  totalPositions: number;
  totalPnl: number;
  avgReturn: number;
} | null> {
  if (!process.env.THEGRAPH_API_KEY) return null;

  try {
    // Query user's positions — try different schema shapes
    const data = await querySubgraph(`
      {
        userPositions(
          where: { user: "${address.toLowerCase()}" }
          first: 200
          orderBy: createdTimestamp
          orderDirection: desc
        ) {
          id
          condition { id }
          outcomeIndex
          quantityBought
          quantitySold
          netQuantity
          avgBuyPrice
          avgSellPrice
          realizedPnl
          createdTimestamp
          lastUpdatedTimestamp
        }
      }
    `);

    const positions = data?.userPositions ?? [];
    if (positions.length === 0) {
      // Try alternative schema
      const altData = await querySubgraph(`
        {
          positions(
            where: { user: "${address.toLowerCase()}" }
            first: 200
            orderBy: timestamp
            orderDirection: desc
          ) {
            id
            conditionId
            outcomeIndex
            size
            avgPrice
            payout
            redeemed
            pnl
            timestamp
          }
        }
      `).catch(() => null);

      const altPositions = altData?.positions ?? [];
      if (altPositions.length === 0) return null;

      return computeStatsFromPositions(altPositions, "alt");
    }

    return computeStatsFromPositions(positions, "standard");
  } catch {
    return null;
  }
}

function computeStatsFromPositions(
  positions: any[],
  schema: "standard" | "alt"
): {
  winRate: number;
  winCount: number;
  lossCount: number;
  totalPositions: number;
  totalPnl: number;
  avgReturn: number;
} {
  let wins = 0;
  let losses = 0;
  let totalPnl = 0;
  const returns: number[] = [];

  for (const pos of positions) {
    let pnl: number;

    if (schema === "standard") {
      pnl = parseFloat(pos.realizedPnl ?? "0");
      // If no realized PnL, estimate from buy/sell
      if (pnl === 0) {
        const bought = parseFloat(pos.quantityBought ?? "0");
        const sold = parseFloat(pos.quantitySold ?? "0");
        const avgBuy = parseFloat(pos.avgBuyPrice ?? "0");
        const avgSell = parseFloat(pos.avgSellPrice ?? "0");
        if (bought > 0 && sold > 0) {
          pnl = (avgSell - avgBuy) * Math.min(bought, sold);
        }
      }
    } else {
      pnl = parseFloat(pos.pnl ?? "0");
      if (pnl === 0 && pos.payout) {
        const cost = parseFloat(pos.size ?? "0") * parseFloat(pos.avgPrice ?? "0");
        pnl = parseFloat(pos.payout) - cost;
      }
    }

    totalPnl += pnl;
    if (pnl > 0.01) {
      wins++;
      returns.push(pnl);
    } else if (pnl < -0.01) {
      losses++;
      returns.push(pnl);
    }
  }

  const total = wins + losses;
  const winRate = total > 0 ? wins / total : 0;
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

  return {
    winRate,
    winCount: wins,
    lossCount: losses,
    totalPositions: positions.length,
    totalPnl,
    avgReturn,
  };
}

/**
 * Fetch trader's current on-chain token balances for position verification.
 */
export async function fetchOnChainPositions(address: string): Promise<Array<{
  conditionId: string;
  outcomeIndex: number;
  balance: number;
}>> {
  if (!process.env.THEGRAPH_API_KEY) return [];

  try {
    const data = await querySubgraph(`
      {
        userPositions(
          where: { user: "${address.toLowerCase()}", netQuantity_gt: "0" }
          first: 100
        ) {
          condition { id }
          outcomeIndex
          netQuantity
        }
      }
    `);

    return (data?.userPositions ?? []).map((p: any) => ({
      conditionId: p.condition?.id ?? "",
      outcomeIndex: parseInt(p.outcomeIndex ?? "0"),
      balance: parseFloat(p.netQuantity ?? "0"),
    }));
  } catch {
    return [];
  }
}

/**
 * Check if The Graph is available.
 */
export function isSubgraphAvailable(): boolean {
  return !!process.env.THEGRAPH_API_KEY;
}

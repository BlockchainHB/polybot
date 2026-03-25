/**
 * Bitquery API Client — Real-Time Polymarket Trade Feeds
 *
 * GraphQL API for on-chain trade data with sub-second latency.
 * Used for real-time trader activity detection instead of polling.
 *
 * Docs: https://docs.bitquery.io/docs/examples/polymarket-api/
 */

import { withRetry } from "@/src/lib/retry";

const BITQUERY_BASE = "https://streaming.bitquery.io/graphql";

function getAccessToken(): string {
  return process.env.BITQUERY_API_KEY || "";
}

// ---- Types ----

export interface BitqueryTrade {
  traderAddress: string;
  conditionId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: string;
  txHash: string;
  blockNumber: number;
  question?: string;
}

export interface BitqueryWhaleTrade extends BitqueryTrade {
  totalValueUsd: number;
}

// ---- GraphQL Helper ----

async function queryBitquery(query: string, variables: Record<string, any> = {}): Promise<any> {
  const token = getAccessToken();
  if (!token) return null;

  return withRetry(async () => {
    const res = await fetch(BITQUERY_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`Bitquery error: ${res.status}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(`Bitquery query error: ${json.errors[0]?.message}`);
    }

    return json.data;
  }, { label: "bitquery-query", maxRetries: 2 });
}

// ---- Polymarket Contract Addresses (Polygon) ----

// CTF Exchange — where OrderFilled events happen
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
// Conditional Tokens Framework
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
// NegRisk CTF Exchange
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";

// ---- API Functions ----

/**
 * Fetch recent trades by specific trader addresses on Polymarket.
 * This is the core function for copy-trade detection.
 */
export async function fetchTraderRecentTrades(
  addresses: string[],
  sinceMinutes = 20
): Promise<BitqueryTrade[]> {
  if (!getAccessToken() || addresses.length === 0) return [];

  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();

  try {
    // Query in batches of 10 addresses to avoid query size limits
    const allTrades: BitqueryTrade[] = [];
    const BATCH = 10;

    for (let i = 0; i < addresses.length; i += BATCH) {
      const batch = addresses.slice(i, i + BATCH);
      const addrList = batch.map((a) => `"${a.toLowerCase()}"`).join(", ");

      const data = await queryBitquery(`
        {
          EVM(dataset: realtime, network: matic) {
            Transfers(
              where: {
                Transfer: {
                  Currency: {
                    SmartContract: { is: "${CTF_CONTRACT}" }
                  }
                  Sender: { in: [${addrList}] }
                }
                Block: { Time: { after: "${since}" } }
              }
              orderBy: { descending: Block_Time }
              limit: { count: 50 }
            ) {
              Transfer {
                Sender
                Receiver
                Currency { SmartContract }
                Amount
              }
              Transaction { Hash }
              Block { Number Time }
            }
          }
        }
      `);

      const sends = data?.EVM?.Transfers ?? [];
      for (const t of sends) {
        allTrades.push({
          traderAddress: t.Transfer?.Sender?.toLowerCase() ?? "",
          conditionId: "",
          tokenId: t.Transfer?.Currency?.SmartContract ?? "",
          side: "SELL",
          size: parseFloat(t.Transfer?.Amount ?? "0"),
          price: 0,
          timestamp: t.Block?.Time ?? new Date().toISOString(),
          txHash: t.Transaction?.Hash ?? "",
          blockNumber: parseInt(t.Block?.Number ?? "0"),
        });
      }

      // Also query receives (buys)
      const dataRecv = await queryBitquery(`
        {
          EVM(dataset: realtime, network: matic) {
            Transfers(
              where: {
                Transfer: {
                  Currency: {
                    SmartContract: { is: "${CTF_CONTRACT}" }
                  }
                  Receiver: { in: [${addrList}] }
                }
                Block: { Time: { after: "${since}" } }
              }
              orderBy: { descending: Block_Time }
              limit: { count: 50 }
            ) {
              Transfer {
                Sender
                Receiver
                Currency { SmartContract }
                Amount
              }
              Transaction { Hash }
              Block { Number Time }
            }
          }
        }
      `);

      const recvs = dataRecv?.EVM?.Transfers ?? [];
      for (const t of recvs) {
        allTrades.push({
          traderAddress: t.Transfer?.Receiver?.toLowerCase() ?? "",
          conditionId: "",
          tokenId: t.Transfer?.Currency?.SmartContract ?? "",
          side: "BUY",
          size: parseFloat(t.Transfer?.Amount ?? "0"),
          price: 0,
          timestamp: t.Block?.Time ?? new Date().toISOString(),
          txHash: t.Transaction?.Hash ?? "",
          blockNumber: parseInt(t.Block?.Number ?? "0"),
        });
      }
    }

    return allTrades;
  } catch (err) {
    console.warn(`[bitquery] Failed to fetch trader trades: ${err}`);
    return [];
  }
}

/**
 * Fetch whale trades (large trades) across all Polymarket markets.
 */
export async function fetchWhaleTrades(
  minSizeUsd = 10000,
  sinceMinutes = 60
): Promise<BitqueryWhaleTrade[]> {
  if (!getAccessToken()) return [];

  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();

  try {
    const data = await queryBitquery(`
      {
        EVM(dataset: realtime, network: matic) {
          DEXTrades(
            where: {
              Trade: {
                Dex: {
                  SmartContract: {
                    is: "${CTF_EXCHANGE}"
                  }
                }
                Buy: {
                  Amount: { gt: "${minSizeUsd}" }
                }
              }
              Block: { Time: { after: "${since}" } }
            }
            orderBy: { descending: Trade_Buy_Amount }
            limit: { count: 50 }
          ) {
            Trade {
              Buyer
              Seller
              Buy {
                Currency { SmartContract }
                Amount
                Price
              }
            }
            Transaction { Hash }
            Block { Number Time }
          }
        }
      }
    `);

    const trades = data?.EVM?.DEXTrades ?? [];
    return trades.map((t: any) => {
      const amount = parseFloat(t.Trade?.Buy?.Amount ?? "0");
      const price = parseFloat(t.Trade?.Buy?.Price ?? "0");
      return {
        traderAddress: t.Trade?.Buyer ?? "",
        conditionId: t.Trade?.Buy?.Currency?.SmartContract ?? "",
        tokenId: t.Trade?.Buy?.Currency?.SmartContract ?? "",
        side: "BUY" as const,
        size: amount,
        price,
        timestamp: t.Block?.Time ?? new Date().toISOString(),
        txHash: t.Transaction?.Hash ?? "",
        blockNumber: parseInt(t.Block?.Number ?? "0"),
        totalValueUsd: amount * price,
      };
    });
  } catch (err) {
    console.warn(`[bitquery] Failed to fetch whale trades: ${err}`);
    return [];
  }
}

/**
 * Fetch recent trade volume for a specific token.
 */
export async function fetchTokenVolume(
  tokenId: string,
  sinceMinutes = 60
): Promise<{ buyVolume: number; sellVolume: number; tradeCount: number }> {
  if (!getAccessToken()) return { buyVolume: 0, sellVolume: 0, tradeCount: 0 };

  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();

  try {
    const data = await queryBitquery(`
      {
        EVM(dataset: realtime, network: matic) {
          buys: DEXTrades(
            where: {
              Trade: {
                Buy: { Currency: { SmartContract: { is: "${tokenId}" } } }
              }
              Block: { Time: { after: "${since}" } }
            }
          ) {
            count
            sum(of: Trade_Buy_Amount)
          }
          sells: DEXTrades(
            where: {
              Trade: {
                Sell: { Currency: { SmartContract: { is: "${tokenId}" } } }
              }
              Block: { Time: { after: "${since}" } }
            }
          ) {
            count
            sum(of: Trade_Sell_Amount)
          }
        }
      }
    `);

    return {
      buyVolume: parseFloat(data?.EVM?.buys?.[0]?.sum ?? "0"),
      sellVolume: parseFloat(data?.EVM?.sells?.[0]?.sum ?? "0"),
      tradeCount: (parseInt(data?.EVM?.buys?.[0]?.count ?? "0") + parseInt(data?.EVM?.sells?.[0]?.count ?? "0")),
    };
  } catch {
    return { buyVolume: 0, sellVolume: 0, tradeCount: 0 };
  }
}

/**
 * Check if Bitquery API is available.
 */
export function isBitqueryAvailable(): boolean {
  return !!getAccessToken();
}

export { CTF_EXCHANGE, CTF_CONTRACT, NEG_RISK_CTF_EXCHANGE };

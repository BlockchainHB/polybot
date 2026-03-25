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

function getApiKey(): string {
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
  const apiKey = getApiKey();
  if (!apiKey) return null;

  return withRetry(async () => {
    const res = await fetch(BITQUERY_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
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
  if (!getApiKey() || addresses.length === 0) return [];

  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
  const addrList = addresses.map((a) => `"${a.toLowerCase()}"`).join(", ");

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
              }
              any: [
                { Trade: { Buyer: { in: [${addrList}] } } }
                { Trade: { Seller: { in: [${addrList}] } } }
              ]
              Block: { Time: { after: "${since}" } }
            }
            orderBy: { descending: Block_Time }
            limit: { count: 100 }
          ) {
            Trade {
              Buyer
              Seller
              Buy {
                Currency { SmartContract }
                Amount
                Price
              }
              Sell {
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
      const buyer = t.Trade?.Buyer?.toLowerCase() ?? "";
      const seller = t.Trade?.Seller?.toLowerCase() ?? "";
      const isBuyer = addresses.some((a) => a.toLowerCase() === buyer);

      return {
        traderAddress: isBuyer ? buyer : seller,
        conditionId: t.Trade?.Buy?.Currency?.SmartContract ?? "",
        tokenId: t.Trade?.Buy?.Currency?.SmartContract ?? "",
        side: isBuyer ? "BUY" as const : "SELL" as const,
        size: parseFloat(t.Trade?.Buy?.Amount ?? "0"),
        price: parseFloat(t.Trade?.Buy?.Price ?? t.Trade?.Sell?.Price ?? "0"),
        timestamp: t.Block?.Time ?? new Date().toISOString(),
        txHash: t.Transaction?.Hash ?? "",
        blockNumber: parseInt(t.Block?.Number ?? "0"),
      };
    });
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
  if (!getApiKey()) return [];

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
  if (!getApiKey()) return { buyVolume: 0, sellVolume: 0, tradeCount: 0 };

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
  return !!getApiKey();
}

export { CTF_EXCHANGE, CTF_CONTRACT, NEG_RISK_CTF_EXCHANGE };

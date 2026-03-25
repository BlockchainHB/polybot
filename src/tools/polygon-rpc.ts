/**
 * Polygon RPC Client — Direct On-Chain Monitoring via QuickNode/Alchemy
 *
 * Watches Polymarket CTF contracts for trade events in real-time.
 * Fastest possible detection (direct RPC, no middleware).
 * Also used to verify trader positions on-chain.
 */

import { withRetry } from "@/src/lib/retry";

// Polymarket contract addresses on Polygon
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";

// Event signatures (keccak256 hashes)
// OrderFilled(bytes32,address,address,uint256,uint256,uint256,uint256)
const ORDER_FILLED_TOPIC = "0x4bc990e3ed5a758e04ef1a35dfeb0e5188cbdd79e0496a431a6e4c868f4771ce";
// TransferSingle(address,address,address,uint256,uint256)
const TRANSFER_SINGLE_TOPIC = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";

function getRpcUrl(): string {
  return process.env.QUICKNODE_RPC_URL || process.env.ALCHEMY_RPC_URL || "";
}

// ---- Types ----

export interface OnChainTrade {
  traderAddress: string;
  tokenId: string;
  side: "BUY" | "SELL";
  size: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  logIndex: number;
}

export interface OnChainBalance {
  tokenId: string;
  balance: number;
}

// ---- Low-level RPC Helpers ----

async function rpcCall(method: string, params: any[]): Promise<any> {
  const url = getRpcUrl();
  if (!url) throw new Error("No RPC URL configured");

  return withRetry(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!res.ok) throw new Error(`RPC error: ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`RPC error: ${json.error.message}`);
    return json.result;
  }, { label: `rpc-${method}`, maxRetries: 2 });
}

function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

function padAddress(address: string): string {
  return "0x" + address.toLowerCase().replace("0x", "").padStart(64, "0");
}

// ---- API Functions ----

/**
 * Fetch recent OrderFilled events for specific trader addresses.
 * Queries the CTF Exchange contract logs directly.
 */
export async function fetchRecentTraderEvents(
  addresses: string[],
  fromBlock: "latest" | number = "latest",
  blockRange = 500 // ~15 minutes of Polygon blocks
): Promise<OnChainTrade[]> {
  const url = getRpcUrl();
  if (!url || addresses.length === 0) return [];

  try {
    // Get current block number
    let latestBlock: number;
    if (fromBlock === "latest") {
      const blockHex = await rpcCall("eth_blockNumber", []);
      latestBlock = hexToNumber(blockHex);
    } else {
      latestBlock = fromBlock;
    }

    const startBlock = latestBlock - blockRange;

    // Query TransferSingle events from CTF contract filtered by trader addresses
    // TransferSingle(operator, from, to, id, value)
    // We look for transfers TO our tracked addresses (buys) or FROM them (sells)
    const trades: OnChainTrade[] = [];

    for (const addr of addresses) {
      // Buys: transfers TO the address
      const buyLogs = await rpcCall("eth_getLogs", [{
        fromBlock: "0x" + startBlock.toString(16),
        toBlock: "0x" + latestBlock.toString(16),
        address: CTF_CONTRACT,
        topics: [
          TRANSFER_SINGLE_TOPIC,
          null, // operator (any)
          null, // from (any)
          padAddress(addr), // to = our trader
        ],
      }]);

      for (const log of (buyLogs ?? [])) {
        const tokenId = log.topics?.[3] ? "0x" + BigInt(log.topics[3]).toString(16) : "";
        const size = log.data ? hexToNumber(log.data.slice(0, 66)) / 1e6 : 0; // USDC decimals

        trades.push({
          traderAddress: addr,
          tokenId,
          side: "BUY",
          size,
          txHash: log.transactionHash ?? "",
          blockNumber: hexToNumber(log.blockNumber ?? "0"),
          timestamp: Date.now(), // Will be refined from block timestamp
          logIndex: hexToNumber(log.logIndex ?? "0"),
        });
      }

      // Sells: transfers FROM the address
      const sellLogs = await rpcCall("eth_getLogs", [{
        fromBlock: "0x" + startBlock.toString(16),
        toBlock: "0x" + latestBlock.toString(16),
        address: CTF_CONTRACT,
        topics: [
          TRANSFER_SINGLE_TOPIC,
          null, // operator (any)
          padAddress(addr), // from = our trader
          null, // to (any)
        ],
      }]);

      for (const log of (sellLogs ?? [])) {
        const tokenId = log.topics?.[3] ? "0x" + BigInt(log.topics[3]).toString(16) : "";
        const size = log.data ? hexToNumber(log.data.slice(0, 66)) / 1e6 : 0;

        trades.push({
          traderAddress: addr,
          tokenId,
          side: "SELL",
          size,
          txHash: log.transactionHash ?? "",
          blockNumber: hexToNumber(log.blockNumber ?? "0"),
          timestamp: Date.now(),
          logIndex: hexToNumber(log.logIndex ?? "0"),
        });
      }
    }

    return trades;
  } catch (err) {
    console.warn(`[polygon-rpc] Failed to fetch trader events: ${err}`);
    return [];
  }
}

/**
 * Fetch on-chain token balance for a trader.
 * Calls balanceOf on the CTF contract.
 */
export async function fetchTokenBalance(
  traderAddress: string,
  tokenId: string
): Promise<number> {
  const url = getRpcUrl();
  if (!url) return 0;

  try {
    // balanceOf(address,uint256) selector: 0x00fdd58e
    const data = "0x00fdd58e"
      + traderAddress.toLowerCase().replace("0x", "").padStart(64, "0")
      + BigInt(tokenId).toString(16).padStart(64, "0");

    const result = await rpcCall("eth_call", [{
      to: CTF_CONTRACT,
      data,
    }, "latest"]);

    return hexToNumber(result) / 1e6; // USDC decimals
  } catch {
    return 0;
  }
}

/**
 * Fetch multiple token balances for a trader.
 */
export async function fetchTraderBalances(
  traderAddress: string,
  tokenIds: string[]
): Promise<OnChainBalance[]> {
  const results: OnChainBalance[] = [];

  // Batch to avoid rate limits
  const BATCH = 10;
  for (let i = 0; i < tokenIds.length; i += BATCH) {
    const batch = tokenIds.slice(i, i + BATCH);
    const balances = await Promise.allSettled(
      batch.map((tid) => fetchTokenBalance(traderAddress, tid))
    );

    balances.forEach((r, idx) => {
      const balance = r.status === "fulfilled" ? r.value : 0;
      if (balance > 0) {
        results.push({ tokenId: batch[idx], balance });
      }
    });
  }

  return results;
}

/**
 * Get the latest block number.
 */
export async function getLatestBlock(): Promise<number> {
  try {
    const hex = await rpcCall("eth_blockNumber", []);
    return hexToNumber(hex);
  } catch {
    return 0;
  }
}

/**
 * Check if RPC is available.
 */
export function isRpcAvailable(): boolean {
  return !!getRpcUrl();
}

export { CTF_EXCHANGE, CTF_CONTRACT, NEG_RISK_CTF_EXCHANGE };

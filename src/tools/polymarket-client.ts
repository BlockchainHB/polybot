import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import { requireEnv } from "@/src/lib/env";
import { withRetry } from "@/src/lib/retry";
import type { OrderbookSummary } from "@/src/types";

const HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;

export async function initClient(): Promise<ClobClient> {
  const privateKey = requireEnv("POLYMARKET_PRIVATE_KEY");
  const signer = new Wallet(privateKey);

  // Derive API credentials
  const tempClient = new ClobClient(HOST, CHAIN_ID, signer);
  const apiCreds = await withRetry(() => tempClient.createOrDeriveApiKey(), {
    label: "derive-api-key",
  });

  const funderAddress = process.env.POLYMARKET_FUNDER_ADDRESS || signer.address;

  const client = new ClobClient(
    HOST,
    CHAIN_ID,
    signer,
    {
      key: requireEnv("POLYMARKET_API_KEY"),
      secret: requireEnv("POLYMARKET_API_SECRET"),
      passphrase: requireEnv("POLYMARKET_API_PASSPHRASE"),
    },
    0, // EOA signature type
    funderAddress
  );

  return client;
}

export async function placeMarketOrder(
  client: ClobClient,
  tokenId: string,
  side: Side,
  size: number
): Promise<unknown> {
  return withRetry(
    () =>
      client.createAndPostOrder(
        {
          tokenID: tokenId,
          price: side === Side.BUY ? 0.99 : 0.01,
          size,
          side,
        },
        { tickSize: "0.01", negRisk: false },
        OrderType.GTC
      ),
    { label: `place-market-order-${tokenId}` }
  );
}

export async function getOrderbook(
  client: ClobClient,
  tokenId: string
): Promise<OrderbookSummary> {
  const book = await withRetry(() => client.getOrderBook(tokenId), {
    label: `get-orderbook-${tokenId}`,
  });

  const bids = book.bids ?? [];
  const asks = book.asks ?? [];

  const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : 0;
  const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : 1;
  const spread = bestAsk - bestBid;
  const midpoint = (bestBid + bestAsk) / 2;

  const bidDepth = bids.reduce((sum: number, b: { size: string }) => sum + parseFloat(b.size), 0);
  const askDepth = asks.reduce((sum: number, a: { size: string }) => sum + parseFloat(a.size), 0);

  return {
    tokenId,
    bestBid,
    bestAsk,
    spread,
    spreadPercent: midpoint > 0 ? (spread / midpoint) * 100 : 0,
    midpoint,
    bidDepth,
    askDepth,
  };
}

export async function getOpenOrders(client: ClobClient): Promise<unknown[]> {
  return withRetry(() => client.getOpenOrders(), {
    label: "get-open-orders",
  });
}

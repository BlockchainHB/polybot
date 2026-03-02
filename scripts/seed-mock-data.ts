import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    console.error("NEXT_PUBLIC_CONVEX_URL env variable is required");
    process.exit(1);
  }

  const client = new ConvexHttpClient(url);
  const now = Date.now();
  const cycleId = `cycle-${now}`;

  console.log("Seeding mock agent activity...\n");

  // --- 1. Seed mock agent actions (simulates a full pipeline run) ---
  const actions: Array<{
    type: "scan" | "filter" | "screen" | "research" | "trade" | "position_refresh" | "error";
    summary: string;
    details: any;
    offsetMs: number;
  }> = [
    {
      type: "scan",
      summary: "Scanned 87 trending markets from Polymarket",
      details: { marketsFound: 87, source: "gamma-api" },
      offsetMs: -900_000, // 15 min ago
    },
    {
      type: "filter",
      summary: "Filtered 87 → 14 markets (min volume $10k, >24h to close)",
      details: { before: 87, after: 14, rules: ["volume >= $10k", "endDate > 24h", "not in existing positions"] },
      offsetMs: -870_000,
    },
    {
      type: "screen",
      summary: "LLM screened 14 → 5 candidates",
      details: {
        candidates: [
          { question: "Will Bitcoin exceed $120k by June 2026?", confidence: 0.78 },
          { question: "Will the Fed cut rates in Q2 2026?", confidence: 0.72 },
          { question: "Will Ethereum flip Bitcoin market cap by 2027?", confidence: 0.65 },
          { question: "Will US GDP growth exceed 3% in 2026?", confidence: 0.61 },
          { question: "Will SpaceX Starship complete orbital flight by April 2026?", confidence: 0.58 },
        ],
      },
      offsetMs: -840_000,
    },
    {
      type: "research",
      summary: "Completed research on 'Will Bitcoin exceed $120k by June 2026?'",
      details: {
        question: "Will Bitcoin exceed $120k by June 2026?",
        toolCalls: 4,
        synthesisLength: 1842,
        tools: ["search_web", "search_social_sentiment", "get_orderbook", "ask_perplexity"],
      },
      offsetMs: -780_000,
    },
    {
      type: "research",
      summary: "Completed research on 'Will the Fed cut rates in Q2 2026?'",
      details: {
        question: "Will the Fed cut rates in Q2 2026?",
        toolCalls: 3,
        synthesisLength: 1456,
        tools: ["search_web", "ask_perplexity", "get_orderbook"],
      },
      offsetMs: -720_000,
    },
    {
      type: "research",
      summary: "Completed research on 'Will Ethereum flip Bitcoin market cap by 2027?'",
      details: {
        question: "Will Ethereum flip Bitcoin market cap by 2027?",
        toolCalls: 3,
        synthesisLength: 1230,
        tools: ["search_web", "search_social_sentiment", "get_orderbook"],
      },
      offsetMs: -660_000,
    },
    {
      type: "trade",
      summary: "[DRY RUN] buy_yes $5.00 on 'Will Bitcoin exceed $120k by June 2026?' @ 0.42",
      details: {
        action: "buy_yes",
        size: 5,
        price: 0.42,
        confidence: 0.78,
        reasoning: "Strong institutional inflows, ETF momentum, and halving cycle suggest upside probability is underpriced at 42%.",
      },
      offsetMs: -600_000,
    },
    {
      type: "trade",
      summary: "[DRY RUN] buy_yes $4.00 on 'Will the Fed cut rates in Q2 2026?' @ 0.55",
      details: {
        action: "buy_yes",
        size: 4,
        price: 0.55,
        confidence: 0.72,
        reasoning: "Labor market softening and CPI trending down. Market pricing 55% seems low given recent Fed commentary.",
      },
      offsetMs: -570_000,
    },
    {
      type: "trade",
      summary: "Skipped 'Will Ethereum flip Bitcoin market cap by 2027?' — insufficient edge",
      details: {
        action: "skip",
        reasoning: "Market is pricing this at 8%, which seems reasonable given ETH/BTC ratio trends. No clear mispricing found.",
      },
      offsetMs: -540_000,
    },
    {
      type: "position_refresh",
      summary: "Refreshed 2 open positions",
      details: { conditionIds: ["0xabc123", "0xdef456"], pricesUpdated: true },
      offsetMs: -300_000, // 5 min ago
    },
  ];

  for (const a of actions) {
    await client.mutation(api.agentActions.logAction, {
      type: a.type,
      summary: a.summary,
      details: a.details,
      timestamp: now + a.offsetMs,
      cycleId,
    });
    console.log(`  [${a.type}] ${a.summary}`);
  }

  // --- 2. Seed mock positions ---
  console.log("\nSeeding mock positions...\n");

  const positions = [
    {
      conditionId: "0xabc123",
      question: "Will Bitcoin exceed $120k by June 2026?",
      tokenId: "tok-btc-yes-001",
      side: "yes" as const,
      size: 12,
      avgEntryPrice: 0.42,
      currentPrice: 0.48,
      unrealizedPnl: 0.72,
      status: "open" as const,
      openedAt: now - 86_400_000 * 2,
      slug: "bitcoin-120k-june-2026",
    },
    {
      conditionId: "0xdef456",
      question: "Will the Fed cut rates in Q2 2026?",
      tokenId: "tok-fed-yes-002",
      side: "yes" as const,
      size: 8,
      avgEntryPrice: 0.55,
      currentPrice: 0.61,
      unrealizedPnl: 0.48,
      status: "open" as const,
      openedAt: now - 86_400_000,
      slug: "fed-cut-rates-q2-2026",
    },
    {
      conditionId: "0x111aaa",
      question: "Will Ethereum reach $10k by end of 2026?",
      tokenId: "tok-eth-yes-003",
      side: "yes" as const,
      size: 10,
      avgEntryPrice: 0.18,
      currentPrice: 0.22,
      unrealizedPnl: 0.40,
      status: "closed" as const,
      openedAt: now - 86_400_000 * 10,
      closedAt: now - 86_400_000 * 3,
      slug: "ethereum-10k-2026",
    },
    {
      conditionId: "0x222bbb",
      question: "Will US enter recession in 2026?",
      tokenId: "tok-recession-no-004",
      side: "no" as const,
      size: 5,
      avgEntryPrice: 0.72,
      currentPrice: 0.80,
      unrealizedPnl: 0.40,
      status: "closed" as const,
      openedAt: now - 86_400_000 * 14,
      closedAt: now - 86_400_000 * 5,
      slug: "us-recession-2026",
    },
    {
      conditionId: "0x333ccc",
      question: "Will Trump win 2024 presidential election?",
      tokenId: "tok-trump-yes-005",
      side: "yes" as const,
      size: 15,
      avgEntryPrice: 0.52,
      currentPrice: 1.0,
      unrealizedPnl: 7.20,
      status: "resolved" as const,
      openedAt: now - 86_400_000 * 120,
      closedAt: now - 86_400_000 * 30,
      slug: "trump-2024",
    },
  ];

  for (const p of positions) {
    await client.mutation(api.positions.openPosition, {
      conditionId: p.conditionId,
      question: p.question,
      tokenId: p.tokenId,
      side: p.side,
      size: p.size,
      avgEntryPrice: p.avgEntryPrice,
      currentPrice: p.currentPrice,
      unrealizedPnl: p.unrealizedPnl,
      openedAt: p.openedAt,
      slug: p.slug,
    });
    // If closed/resolved, update status
    if (p.status !== "open" && p.closedAt) {
      // We need to get the position ID - query by conditionId
      // For simplicity, we'll use closePosition after a brief moment
    }
    console.log(`  [${p.status}] ${p.question} (${p.side} @ ${p.avgEntryPrice})`);
  }

  // --- 3. Seed mock trades ---
  console.log("\nSeeding mock trades...\n");

  const trades = [
    {
      conditionId: "0xabc123",
      question: "Will Bitcoin exceed $120k by June 2026?",
      tokenId: "tok-btc-yes-001",
      side: "buy_yes" as const,
      size: 5,
      price: 0.42,
      confidence: 0.78,
      reasoning: "Strong institutional inflows, ETF momentum, and halving cycle suggest upside probability is underpriced.",
      status: "dry_run" as const,
      executedAt: now - 86_400_000 * 2,
    },
    {
      conditionId: "0xabc123",
      question: "Will Bitcoin exceed $120k by June 2026?",
      tokenId: "tok-btc-yes-001",
      side: "buy_yes" as const,
      size: 7,
      price: 0.44,
      confidence: 0.75,
      reasoning: "Follow-up buy — on-chain metrics still bullish, accumulation pattern intact.",
      status: "dry_run" as const,
      executedAt: now - 86_400_000,
    },
    {
      conditionId: "0xdef456",
      question: "Will the Fed cut rates in Q2 2026?",
      tokenId: "tok-fed-yes-002",
      side: "buy_yes" as const,
      size: 4,
      price: 0.55,
      confidence: 0.72,
      reasoning: "Labor market softening and CPI trending down.",
      status: "dry_run" as const,
      executedAt: now - 86_400_000,
    },
    {
      conditionId: "0xdef456",
      question: "Will the Fed cut rates in Q2 2026?",
      tokenId: "tok-fed-yes-002",
      side: "buy_yes" as const,
      size: 4,
      price: 0.58,
      confidence: 0.70,
      reasoning: "Fed governor dovish comments reinforced the thesis.",
      status: "dry_run" as const,
      executedAt: now - 43_200_000,
    },
    {
      conditionId: "0x111aaa",
      question: "Will Ethereum reach $10k by end of 2026?",
      tokenId: "tok-eth-yes-003",
      side: "buy_yes" as const,
      size: 10,
      price: 0.18,
      confidence: 0.65,
      reasoning: "ETH/BTC ratio historically low. L2 adoption accelerating.",
      status: "filled" as const,
      executedAt: now - 86_400_000 * 10,
    },
    {
      conditionId: "0x222bbb",
      question: "Will US enter recession in 2026?",
      tokenId: "tok-recession-no-004",
      side: "buy_no" as const,
      size: 5,
      price: 0.72,
      confidence: 0.68,
      reasoning: "Strong consumer spending and job market data counter recession fears.",
      status: "filled" as const,
      executedAt: now - 86_400_000 * 14,
    },
    {
      conditionId: "0x333ccc",
      question: "Will Trump win 2024 presidential election?",
      tokenId: "tok-trump-yes-005",
      side: "buy_yes" as const,
      size: 15,
      price: 0.52,
      confidence: 0.74,
      reasoning: "Polling momentum and prediction market consensus shifting.",
      status: "filled" as const,
      executedAt: now - 86_400_000 * 120,
    },
    {
      conditionId: "0x444ddd",
      question: "Will SpaceX Starship complete orbital flight by April 2026?",
      tokenId: "tok-spacex-yes-006",
      side: "buy_yes" as const,
      size: 3,
      price: 0.65,
      confidence: 0.58,
      reasoning: "Recent test success, but timeline risk remains.",
      status: "rejected" as const,
      executedAt: now - 600_000,
    },
  ];

  for (const t of trades) {
    await client.mutation(api.trades.recordTrade, t);
    console.log(`  [${t.status}] ${t.side} $${t.size} on '${t.question}' @ ${t.price}`);
  }

  // --- 4. Fetch live markets from Gamma API and seed into Convex ---
  console.log("\nFetching live markets from Polymarket Gamma API...\n");

  const res = await fetch(
    "https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=20&order=volume24hr&ascending=false"
  );

  if (!res.ok) {
    console.error(`Gamma API error: ${res.status} ${res.statusText}`);
  } else {
    const markets: any[] = await res.json();

    for (const m of markets) {
      const outcomes = typeof m.outcomePrices === "string"
        ? JSON.parse(m.outcomePrices)
        : m.outcomePrices ?? [];

      const yesPrice = outcomes[0] ? parseFloat(outcomes[0]) : undefined;
      const noPrice = outcomes[1] ? parseFloat(outcomes[1]) : undefined;

      if (!m.conditionId || !m.question) continue;

      await client.mutation(api.markets.upsertMarket, {
        conditionId: m.conditionId,
        question: m.question,
        slug: m.slug ?? "",
        volume: m.volumeNum ?? parseFloat(m.volume ?? "0"),
        liquidity: m.liquidityNum ?? parseFloat(m.liquidity ?? "0"),
        endDate: m.endDate ?? "",
        lastChecked: now,
        yesPrice,
        noPrice,
        negRisk: m.negRisk ?? false,
      });
      console.log(`  ${m.question} (vol: $${Math.round(m.volumeNum ?? 0).toLocaleString()})`);
    }
  }

  console.log("\nDone! Mock activity + live markets seeded.");
}

main().catch((err) => {
  console.error("Failed to seed mock data:", err);
  process.exit(1);
});

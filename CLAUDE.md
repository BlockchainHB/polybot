# Polymarket Copy-Trading Bot

Autonomous Polymarket trading bot focused on **short-term price trading** and **elite copy-trading**. Copy-trade validation uses a single DeepSeek V3.2 call. Multi-source data from Falcon H-Score API, The Graph, Bitquery, and Alchemy.

## Trading Philosophy

This bot **trades the price, not the outcome**. It buys when price momentum is favorable and exits via take-profit, stop-loss, or copy-exit — not by waiting for market resolution. Copy-trading is the primary strategy.

## Tech Stack

- **Frontend**: Next.js 15 (App Router, Turbopack), React 19, TailwindCSS
- **Backend**: Convex (real-time database + serverless functions)
- **LLM (Copy Trade)**: DeepSeek V3.2 (`deepseek/deepseek-v3.2`) — single model, $0.26/M input
- **LLM (Chat Fast)**: Grok 4.20 Beta via OpenRouter (`x-ai/grok-4.20-beta`) — tool calling
- **LLM (Chat Heavy)**: GPT-5.4 via OpenRouter (`openai/gpt-5.4`) — complex analysis
- **LLM (Agent Pipeline)**: Grok 4.20 Multi-Agent Beta (`x-ai/grok-4.20-multi-agent-beta`) — NO tool calling
- **LLM (Research/Tools)**: DeepSeek V3.2 (`deepseek/deepseek-v3.2`) — tool calling, cheapest
- **Markets**: Polymarket CLOB Client (Polygon, chain 137) + Gamma API
- **Streaming**: AI SDK v6 (`ai` + `@ai-sdk/react` + `@ai-sdk/openai-compatible`) with `streamText`, `stopWhen`, `useChat`

## Data Sources (Multi-Source with Fallback)

The copy trading engine uses multiple data sources with automatic fallback:

| Source | API | Used For | Fallback Priority |
|--------|-----|----------|-------------------|
| **Falcon API** | `narrative.agent.heisenberg.so` | H-Score leaderboard (agent 584), Wallet 360 (agent 581), trades (agent 556) | 1st (primary) |
| **The Graph** | Polymarket subgraph on Polygon | On-chain win rates from redemption data (ground truth) | 2nd |
| **Bitquery** | `streaming.bitquery.io` (v2 GraphQL) | Real-time trade detection, whale trades | 1st for activity |
| **Alchemy** | Polygon PoS RPC | Direct on-chain CTF contract event monitoring | 2nd for activity |
| **Polymarket Data API** | `data-api.polymarket.com` | Leaderboard, trader activity, positions | Last resort |
| **Polymarket Gamma API** | `gamma-api.polymarket.com` | Market data, search, events | Always used |
| **Polymarket CLOB API** | `clob.polymarket.com` | Orderbook, midpoint prices, order execution | Always used |

### Fallback Chains
- **Leaderboard**: Falcon H-Score (agent 584) → Data API
- **Win rates**: Falcon Wallet 360 (agent 581) → The Graph (on-chain) → Data API heuristic
- **Trader activity**: Bitquery narrows active traders → Data API polls only those for full details
- **Trader stats**: Falcon Wallet 360 → Data API

### Falcon API (Heisenberg)
Single endpoint: `POST https://narrative.agent.heisenberg.so/api/v2/semantic/retrieve/parameterized`
Auth: `Authorization: Bearer <FALCON_API_KEY>`
Switch data by changing `agent_id`:
- **584** — H-Score Leaderboard (filters bots, lucky streaks, wash traders)
- **581** — Wallet 360 (60+ metrics per wallet: PnL, ROI, win rate, drawdown, Sharpe)
- **556** — Trade feed (historical trades by wallet, market, direction, time)
- **579** — PnL Leaderboard (official Polymarket ranking)
- **574** — Markets (search/filter by volume, slug, date)
Full docs: https://prediction.heisenberg.so/prediction_market_api_context.md

All sources are optional — the system gracefully degrades to the Polymarket Data API if no third-party keys are configured.

## Copy-Trade Engine v4

### Pipeline (every 3 min, or 30s in 24/7 mode)
1. **Discover** top traders via multi-source leaderboard (Falcon → Data API)
2. **Scan** trader activity via multi-source detection (Bitquery → RPC → Data API)
3. **Deduplicate** trades across cycles via composite keys
4. **Detect exits** — mirror when tracked traders sell your positions
5. **Generate signals** with conviction scoring and market validation
6. **Validate** via single DeepSeek V3.2 call (not 4-model ensemble)
7. **Fresh price** fetch from CLOB midpoint before execution
8. **Execute** with price drift protection (skip if >5% drift)

### Key Features
- **Conviction scoring** — weighs signals by trader's position size relative to portfolio
- **Market validation** — checks liquidity (>$500), time-to-close (>1hr), extreme prices before entering
- **Fresh price execution** — fetches CLOB midpoint right before trade, not stale trader price
- **Deduplication** — filters already-processed trades across cycles via composite keys
- **Price drift protection** — skips trades if price moved >5% since signal detected
- **On-chain win rates** — ground truth from The Graph subgraph redemptions
- **Single-model validation** — DeepSeek V3.2 only (replaced 4-model ensemble)
- **Copy-trade-only mode** — disables autonomous research pipeline
- **24/7 continuous mode** — self-scheduling loop every 30s (toggle from UI)
- **API usage tracking** — every API call tracked with service, latency, success/failure

### Scoring Weights
| Factor | Weight | Description |
|--------|--------|-------------|
| ROI | 30% | Profit / volume (capital efficiency) |
| Real Win Rate | 25% | From Falcon/Subgraph/heuristic |
| Consistency | 20% | Sharpe-like: mean return / stddev |
| Volume | 10% | Proves conviction (log-normalized) |
| Recency | 15% | 7d ranking matters most |

All scores get exponential time decay (half-life: 7 days of inactivity).

## Model Architecture

- **Copy-trade cycle** uses **only DeepSeek V3.2** ($0.26/M) — single call for signal validation
- **Chat route** (`app/api/chat/route.ts`) uses **multi-model routing**:
  - Fast queries → `x-ai/grok-4.20-beta`
  - Complex queries → `openai/gpt-5.4`
- **Agent pipeline** (disabled in copy-only mode) uses 4-model ensemble for validation:
  - `deepseek/deepseek-v3.2`, `google/gemini-3-flash-preview`, `openai/gpt-5.4`, `anthropic/claude-sonnet-4-6`
- All models accessed through **single OpenRouter API key**

## Project Structure

```
polybot/
├── app/
│   ├── page.tsx                    # Dashboard (KPIs, P&L chart, markets)
│   ├── copy-trade/page.tsx         # 5-tab copy trade dashboard (overview, traders, signals, activity, log)
│   ├── chat/page.tsx               # Chat UI with Streamdown rendering
│   ├── simulator/page.tsx          # Bot simulator
│   ├── markets/                    # Market browser + detail views
│   ├── positions/page.tsx          # Open positions + trade history
│   ├── activity/                   # Agent cycle history
│   ├── settings/page.tsx           # Config + wallet + API usage tracking
│   └── api/chat/route.ts           # Streaming chat API (5 Polymarket tools)
├── convex/
│   ├── schema.ts                   # Database schema (15 tables)
│   ├── agentRun.ts                 # Agent + copy-trade cycles + auto-exit
│   ├── apiUsage.ts                 # API usage tracking (per-service daily counters)
│   ├── trackedTraders.ts           # Traders + signals + performance + dedup keys
│   ├── positions.ts                # Position CRUD (TP/SL/exitReason/copiedFrom)
│   ├── trades.ts                   # Trade CRUD
│   ├── agentActions.ts             # Pipeline action logging + ensemble votes
│   ├── wallet.ts                   # Mock/real wallet (deduct/credit/reconcile)
│   ├── config.ts                   # Key-value config store
│   ├── analytics.ts                # Daily/weekly performance metrics
│   ├── botSimulator.ts             # Bot simulation backend
│   ├── markets.ts                  # Market data queries
│   └── crons.ts                    # 5 scheduled jobs
├── src/
│   ├── agent/
│   │   ├── copy-trader.ts          # Copy-trading engine v4 (multi-source, conviction)
│   │   ├── pipeline.ts             # 6-stage autonomous trading pipeline
│   │   ├── prompts.ts              # LLM prompts (price-trading focused)
│   │   ├── market-scorer.ts        # Short-term market filtering
│   │   └── risk-manager.ts         # Risk checks
│   ├── llm/
│   │   ├── openrouter.ts           # OpenRouter provider (with request/response logging)
│   │   ├── multi-model-provider.ts # Ensemble + ChatRouter (with logging)
│   │   └── types.ts                # LLM interface types
│   ├── tools/
│   │   ├── data-source-manager.ts  # Unified multi-source abstraction with fallback chains
│   │   ├── falcon-api.ts           # Falcon API client (pre-computed trader stats)
│   │   ├── polymarket-subgraph.ts  # The Graph subgraph client (on-chain win rates)
│   │   ├── bitquery-client.ts      # Bitquery GraphQL client (real-time trade feeds)
│   │   ├── polygon-rpc.ts          # Alchemy/QuickNode RPC client (on-chain events)
│   │   ├── polymarket-data-api.ts  # Data API (leaderboard, activity, positions)
│   │   ├── polymarket-scanner.ts   # Gamma API (trending markets)
│   │   ├── polymarket-client.ts    # CLOB client (orders, orderbook)
│   │   ├── polymarket-ws.ts        # WebSocket client (real-time prices)
│   │   ├── tool-registry.ts        # LLM tool definitions
│   │   ├── firecrawl-search.ts     # Web search
│   │   ├── perplexity-search.ts    # Real-time Q&A
│   │   └── apify-scraper.ts        # Social sentiment
│   ├── lib/
│   │   ├── retry.ts                # Retry with automatic API usage tracking
│   │   ├── env.ts                  # Environment variable helpers
│   │   └── utils.ts                # cn() and misc utilities
│   └── types/index.ts              # All shared TypeScript types
└── scripts/
    ├── setup-wallet.ts             # Generate/import wallet
    ├── derive-api-keys.ts          # Derive CLOB API keys
    ├── seed-config.ts              # Seed default config + mock wallet
    └── seed-mock-data.ts           # Seed mock data
```

## Copy Trade Dashboard (Frontend)

The copy trade page (`/copy-trade`) has 5 tabs:

1. **Overview** — open copy positions with P&L, recent bot activity (with model/latency badges), trader copy performance table with data source badges
2. **Traders** — full table: score, ROI, win rate, on-chain win rate (blue), max drawdown (red), PnL, copy P&L, copy count/win rate, data source badge (Falcon/Graph/Data API), status, enable/disable/remove
3. **Signals** — every signal with side, size, price, trader count, consensus, score, reasoning, status
4. **Activity** — raw trader activity feed with copy status
5. **Bot Log** — expandable log entries showing full details JSON (model, latency, validations, cycle data)

Top of page: quick controls (start/pause, copy-only, 24/7, dry-run), status badges, 8-stat KPI strip (balance, P&L, open copies, win rate, traders, signals, API calls today, LLM model), data sources status bar with live call counts and latency.

## Settings Page

- **Mock Wallet** — initialize, reset, view balance/invested/P&L/trade count
- **API Usage** — per-service table: today + 7-day call counts, avg latency, error rate
- **Bot Configuration** — max trade size, max exposure, min confidence, model ID, run interval, bot enabled, copy trade only, copy trade 24/7, dry run

## Trading Modes

### 1. Copy-Trading (PRIMARY — every 3 min or 30s in 24/7)
Multi-source pipeline with single-model validation. See "Copy-Trade Engine v4" above.

### 2. Autonomous Research Trading (every 10 min — disabled in copy-only mode)
Pipeline: Scan → Filter → LLM Screen → Deep Research (tools via DeepSeek) → Trade Decision → 4-Model Ensemble → Execute

### 3. Auto-Exit System (every 2 min)
- **Take profit**: 12% gain → auto-sell
- **Stop loss**: 10% loss → auto-cut
- **Time stop**: 3-day max hold
- **Copy exit**: mirrors when tracked trader sells

## Cron Jobs

| Job | Interval | Function |
|-----|----------|----------|
| Autonomous agent cycle | 10 min | `runAgentCycle` |
| Copy-trade cycle | 3 min (or 30s in 24/7) | `runCopyTradeCycle` |
| Trader leaderboard refresh | 4 hours | `refreshTrackedTraders` |
| Position refresh + auto-exit | 2 min | `refreshPositions` |
| Daily analytics | Midnight UTC | `computeDailyAnalytics` |

## Database Tables (Convex)

`trades`, `positions` (TP/SL/copiedFrom), `trackedTraders` (ROI/consistency/copyPnl/onChainWinRate/maxDrawdown/dataSource), `traderActivity`, `traderPerformance`, `copyTradeSignals`, `agentActions`, `markets`, `analytics`, `config`, `wallet`, `ensembleVotes`, `whaleAlerts`, `convergenceSignals`, `apiUsage`

## Environment Variables

Required:
```
NEXT_PUBLIC_CONVEX_URL=       # Convex deployment URL
OPENROUTER_API_KEY=           # For all LLM access (single key)
CONVEX_DEPLOYMENT=            # Convex deployment identifier
```

Copy trade data sources (all optional, graceful fallback):
```
FALCON_API_KEY=               # Falcon API (narrative.agent.heisenberg.so) — H-Score traders
THEGRAPH_API_KEY=             # The Graph subgraph API key — on-chain win rates
BITQUERY_API_KEY=             # Bitquery v2 streaming API — real-time trade feeds
ALCHEMY_RPC_URL=              # Alchemy Polygon PoS RPC — on-chain event monitoring
# or QUICKNODE_RPC_URL=       # QuickNode alternative
```

For live trading:
```
POLYMARKET_PRIVATE_KEY=       # Wallet private key
POLYMARKET_API_KEY=           # CLOB API key
POLYMARKET_API_SECRET=        # CLOB API secret
POLYMARKET_API_PASSPHRASE=    # CLOB API passphrase
```

Optional research tools:
```
FIRECRAWL_API_KEY=            # Web search
PERPLEXITY_API_KEY=           # Real-time Q&A
APIFY_API_TOKEN=              # Social sentiment
```

## Polymarket Contract Addresses (Polygon PoS, Chain 137)

| Contract | Address |
|----------|---------|
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
| Conditional Tokens (CTF) | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` |
| NegRisk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |

## Dev Server Logging

Every LLM call logs to terminal:
```
[LLM] ➜ deepseek/deepseek-v3.2 | temp=0.1 | max_tokens=1000 | prompt: "Quick-validate..."
[LLM] ✓ deepseek/deepseek-v3.2 | 1243ms | tokens: 450→120 (570) | response: "{"validations":..."
```

Copy trade cycle milestones:
```
[COPY TRADE] Cycle copy-xxx started | balance: $487.50
[COPY TRADE] Step 1: Loading tracked traders...
[DATA SOURCES] Active: falcon, subgraph, bitquery, alchemy, data_api
[DATA] Leaderboard from Falcon: 50 traders
[DATA] Win rate for 0x1234... from Subgraph (on-chain): 62%
[COPY TRADE] Step 4: LLM validation for 2 signals...
[COPY TRADE] ✓ [DRY] buy_yes "Will Bitcoin..." | $8.50 @ 62.3c | trader: whale_trader
```

## Commands

```bash
npm run dev              # Start Next.js dev server
npx convex dev           # Start Convex backend (must run alongside dev)
npm run setup-wallet     # Generate wallet + derive API credentials
npm run seed-config      # Seed default config + initialize mock wallet
npm run build            # Production build
```

## API Usage Tracking

Every `withRetry` call automatically tracks API usage via a callback registered at the start of each Convex action. Data stored in `apiUsage` table: one row per service per day with call count, success/failure, total latency. Visible on Settings page and Copy Trade dashboard.

## Key Design Decisions

- **Copy-trading is primary** — 3-min scan cycle, exit mirroring, per-trader P&L tracking
- **Single LLM for copy trades** — DeepSeek V3.2 only, traders are the edge not the AI
- **Multi-source data** — Falcon → Subgraph → Bitquery → RPC → Data API fallback chain
- **Conviction scoring** — trader portfolio % weights signal strength
- **Fresh price execution** — CLOB midpoint fetched right before trade
- **Price trading, not resolution betting** — buy low, sell high, don't hold to expiry
- **Dry run mode** ON by default — simulates trades without real orders
- **API usage tracking** — built into retry utility, zero call-site changes
- **All third-party APIs optional** — system works with just Polymarket's APIs

## Known Issues

- Grok 4.20 Multi-Agent Beta does NOT support tool calling through OpenRouter
- Polymarket Data API leaderboard requires `/v1/` prefix and specific param names
- LLMs return markdown-wrapped JSON even with `response_format: { type: "json_object" }` — always use `stripCodeFences()` before `JSON.parse`
- Falcon API is a single POST endpoint with `agent_id` — not REST-style paths
- Bitquery v2 uses Bearer token auth via `streaming.bitquery.io/graphql` — token expires every 24h
- Bitquery returns on-chain transfers (no conditionId/price) — always enriched via Data API
- The Graph subgraph requires API key from https://thegraph.com/studio/apikeys/
- Trader refresh disables all old traders before upserting new Falcon-sourced ones

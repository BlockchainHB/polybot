import type { LLMToolDefinition } from "@/src/types";
import type { ClobClient } from "@polymarket/clob-client";
import { searchWeb } from "./firecrawl-search";
import { searchSocialSentiment } from "./apify-scraper";
import { askPerplexity } from "./perplexity-search";
import { getOrderbook } from "./polymarket-client";
import { fetchMarketByCondition } from "./polymarket-scanner";

export interface ToolDeps {
  polyClient: ClobClient;
}

export const TOOL_DEFINITIONS: LLMToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search for recent news, articles, and information about a topic.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          limit: { type: "number", description: "Max results to return (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_social_sentiment",
      description: "Get Twitter/social media sentiment and recent posts about a topic.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The topic to search for" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_perplexity",
      description:
        "Ask a real-time question and get an answer with sources. Best for factual questions about current events.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question to ask" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orderbook",
      description: "Get the current orderbook (bids, asks, spread) for a Polymarket token.",
      parameters: {
        type: "object",
        properties: {
          token_id: { type: "string", description: "The token ID to get the orderbook for" },
        },
        required: ["token_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market_details",
      description:
        "Get details for a Polymarket market by its condition ID, including tokens, volume, and liquidity.",
      parameters: {
        type: "object",
        properties: {
          condition_id: { type: "string", description: "The condition ID of the market" },
        },
        required: ["condition_id"],
      },
    },
  },
];

export async function executeToolCall(
  name: string,
  args: Record<string, any>,
  deps: ToolDeps
): Promise<string> {
  switch (name) {
    case "search_web": {
      const results = await searchWeb(args.query, args.limit);
      return JSON.stringify(results);
    }
    case "search_social_sentiment": {
      const result = await searchSocialSentiment(args.query);
      return JSON.stringify(result);
    }
    case "ask_perplexity": {
      const result = await askPerplexity(args.question);
      return JSON.stringify(result);
    }
    case "get_orderbook": {
      const result = await getOrderbook(deps.polyClient, args.token_id);
      return JSON.stringify(result);
    }
    case "get_market_details": {
      const result = await fetchMarketByCondition(args.condition_id);
      return JSON.stringify(result);
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

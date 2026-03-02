import { requireEnv } from "@/src/lib/env";
import { withRetry } from "@/src/lib/retry";
import type { SocialSentimentResult } from "@/src/types";

const ACTOR_ID = "apify/twitter-scraper";
const APIFY_BASE = "https://api.apify.com/v2";

function neutralFallback(query: string): SocialSentimentResult {
  return {
    platform: "twitter",
    postCount: 0,
    sentiment: "neutral",
    summary: `Could not retrieve social sentiment for "${query}".`,
    topPosts: [],
  };
}

export async function searchSocialSentiment(query: string): Promise<SocialSentimentResult> {
  const token = requireEnv("APIFY_API_TOKEN");

  try {
    // Start the actor run
    const runResponse = await withRetry(
      async () => {
        const res = await fetch(
          `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}&waitForFinish=120`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              searchTerms: [query],
              maxTweets: 20,
              sort: "Latest",
            }),
          }
        );
        if (!res.ok) throw new Error(`Apify run error: ${res.status} ${res.statusText}`);
        return res.json() as Promise<any>;
      },
      { label: "apify-start-run", maxRetries: 2 }
    );

    const datasetId = runResponse?.data?.defaultDatasetId;
    if (!datasetId) return neutralFallback(query);

    // Fetch dataset items
    const items = await withRetry(
      async () => {
        const res = await fetch(
          `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=20`
        );
        if (!res.ok) throw new Error(`Apify dataset error: ${res.status}`);
        return res.json() as Promise<any[]>;
      },
      { label: "apify-fetch-dataset", maxRetries: 2 }
    );

    if (!items || items.length === 0) return neutralFallback(query);

    const topPosts = items
      .sort((a, b) => (b.likeCount ?? 0) + (b.retweetCount ?? 0) - (a.likeCount ?? 0) - (a.retweetCount ?? 0))
      .slice(0, 5)
      .map((item) => ({
        text: item.text ?? item.full_text ?? "",
        engagement: (item.likeCount ?? 0) + (item.retweetCount ?? 0) + (item.replyCount ?? 0),
      }));

    // Simple sentiment heuristic based on engagement patterns
    const totalEngagement = topPosts.reduce((s, p) => s + p.engagement, 0);
    const avgEngagement = items.length > 0 ? totalEngagement / items.length : 0;

    return {
      platform: "twitter",
      postCount: items.length,
      sentiment: "mixed",
      summary: `Found ${items.length} tweets about "${query}" with avg engagement of ${Math.round(avgEngagement)}. Sentiment analysis requires LLM interpretation of content.`,
      topPosts,
    };
  } catch (error) {
    console.error("[apify-scraper] Failed to fetch social sentiment:", error);
    return neutralFallback(query);
  }
}

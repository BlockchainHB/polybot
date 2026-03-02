import { requireEnv } from "@/src/lib/env";
import { withRetry } from "@/src/lib/retry";
import type { WebSearchResult } from "@/src/types";

export async function searchWeb(query: string, limit = 5): Promise<WebSearchResult[]> {
  const apiKey = requireEnv("FIRECRAWL_API_KEY");

  const data = await withRetry(
    async () => {
      const res = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query, limit }),
      });
      if (!res.ok) throw new Error(`Firecrawl error: ${res.status} ${res.statusText}`);
      return res.json() as Promise<any>;
    },
    { label: "firecrawl-search" }
  );

  const results: WebSearchResult[] = (data.data ?? data.results ?? []).map((item: any) => ({
    title: item.title ?? item.metadata?.title ?? "",
    url: item.url ?? "",
    snippet: item.description ?? item.markdown?.slice(0, 300) ?? "",
  }));

  return results;
}

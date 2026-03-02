import OpenAI from "openai";
import { requireEnv } from "@/src/lib/env";
import { withRetry } from "@/src/lib/retry";
import type { PerplexityResult } from "@/src/types";

export async function askPerplexity(question: string): Promise<PerplexityResult> {
  const apiKey = requireEnv("PERPLEXITY_API_KEY");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  const response = await withRetry(
    () =>
      client.chat.completions.create({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a research assistant. Provide concise, factual answers with source references.",
          },
          { role: "user", content: question },
        ],
      }),
    { label: "perplexity-search", maxRetries: 2 }
  );

  const message = response.choices[0]?.message;
  const citations = (response as any).citations ?? [];

  return {
    answer: message?.content ?? "No answer returned.",
    sources: citations.length > 0 ? citations : [],
  };
}

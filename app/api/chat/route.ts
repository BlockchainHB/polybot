import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, smoothStream, UIMessage, convertToModelMessages } from "ai";

export const maxDuration = 30;

const openrouter = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openrouter("x-ai/grok-4.1-fast"),
    system:
      "You are Grok 4.1 Fast, a Polymarket trading assistant powered by the x-ai/grok-4.1-fast model via OpenRouter. You help users understand prediction markets, analyze market conditions, discuss trading strategies, and interpret market data. Be concise and actionable in your responses. If asked what model you are, say you are Grok 4.1 Fast.",
    messages: await convertToModelMessages(messages),
    experimental_transform: smoothStream({ chunking: "word" }),
  });

  return result.toUIMessageStreamResponse();
}

"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef, FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";

export default function ChatPage() {
  const { messages, sendMessage, status } = useChat({
    api: "/api/chat",
  } as any);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  }

  return (
    <div className="mx-auto max-w-5xl flex h-[calc(100vh-2rem)] flex-col gap-4">
      <h1 className="text-2xl font-bold shrink-0">Chat</h1>

      <Card className="flex flex-1 flex-col overflow-hidden">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Send a message to start chatting with Grok.
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-4 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-accent text-accent-foreground prose prose-invert prose-sm max-w-none"
                )}
              >
                {msg.role === "assistant"
                  ? msg.parts
                      ?.filter((p) => p.type === "text")
                      .map((p, i) => (
                        <Streamdown
                          key={i}
                          mode={status === "streaming" && i === msg.parts!.filter((x) => x.type === "text").length - 1 ? "streaming" : "static"}
                        >
                          {p.text}
                        </Streamdown>
                      )) ?? <Streamdown mode="static">{(msg as any).content}</Streamdown>
                  : msg.parts
                      ?.filter((p) => p.type === "text")
                      .map((p, i) => (
                        <span key={i}>{p.text}</span>
                      )) ?? (msg as any).content}
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {status === "submitted" && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Polymarket..."
            className="flex-1 rounded-md border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <Button type="submit" size="sm" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

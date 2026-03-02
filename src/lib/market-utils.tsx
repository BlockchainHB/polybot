import { ArrowUpRight, ArrowDownRight, Flame, BarChart3, Droplets, Sparkles } from "lucide-react";
import { cn } from "@/src/lib/utils";

/* ---------- types ---------- */
export interface LiveMarket {
  id: string;
  conditionId: string;
  question: string;
  slug: string;
  description: string;
  image: string;
  isMulti: boolean;
  marketCount: number;
  yesPrice: number | null;
  noPrice: number | null;
  topOutcomes: { label: string; price: number; volume: number }[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  lastTradePrice: number | null;
  oneHourPriceChange: number | null;
  oneDayPriceChange: number | null;
  oneWeekPriceChange: number | null;
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate: string;
  createdAt: string;
  featured: boolean;
  isNew: boolean;
  competitive: number;
  tags: { label: string; slug: string }[];
  series: { title: string; slug: string } | null;
  commentCount: number;
}

export type SortOption = "volume24hr" | "volume" | "liquidity" | "createdAt";

export const sorts: { value: SortOption; label: string; icon: React.ElementType }[] = [
  { value: "volume24hr", label: "Trending", icon: Flame },
  { value: "volume", label: "Popular", icon: BarChart3 },
  { value: "liquidity", label: "Liquid", icon: Droplets },
  { value: "createdAt", label: "New", icon: Sparkles },
];

/* ---------- helpers ---------- */
export function pct(v: number) {
  const p = v * 100;
  if (p >= 99.5) return ">99";
  if (p <= 0.5) return "<1";
  return p >= 10 ? p.toFixed(0) : p.toFixed(1);
}

export function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value === null || value === 0) return null;
  const up = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-green-400" : "text-red-400", className)}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {(Math.abs(value) * 100).toFixed(1)}%
    </span>
  );
}

export function timeUntil(dateStr: string) {
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms < 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  if (d > 30) return `${Math.floor(d / 30)}mo`;
  if (d > 0) return `${d}d`;
  const h = Math.floor(ms / 3_600_000);
  return `${h}h`;
}

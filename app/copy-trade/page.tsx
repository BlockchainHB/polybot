"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  TrendingUp,
  Signal,
  Trophy,
  Eye,
  EyeOff,
  Trash2,
  Activity,
  Wallet,
  CircleDot,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  Database,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useState } from "react";

// ---- Helpers ----

function formatUSD(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function scoreColor(score: number) {
  if (score > 0.7) return "text-green-400";
  if (score > 0.4) return "text-yellow-400";
  return "text-muted-foreground";
}

function pnlColor(n: number) {
  if (n > 0) return "text-green-400";
  if (n < 0) return "text-red-400";
  return "text-muted-foreground";
}

const SOURCE_COLORS: Record<string, string> = {
  falcon: "text-purple-400 border-purple-400/30",
  subgraph: "text-blue-400 border-blue-400/30",
  bitquery: "text-cyan-400 border-cyan-400/30",
  onchain: "text-orange-400 border-orange-400/30",
  data_api: "text-muted-foreground border-border",
};

const SOURCE_LABELS: Record<string, string> = {
  falcon: "Falcon",
  subgraph: "Graph",
  bitquery: "Bitquery",
  onchain: "On-Chain",
  data_api: "Data API",
  openrouter: "DeepSeek",
  gamma_api: "Gamma",
  clob_api: "CLOB",
  alchemy: "Alchemy",
};

// ---- Main Page ----

export default function CopyTradePage() {
  const traders = useQuery(api.trackedTraders.listTraders);
  const signals = useQuery(api.trackedTraders.listSignals, { status: undefined });
  const recentActivity = useQuery(api.trackedTraders.recentTraderActivity, { limit: 50 });
  const traderPerformance = useQuery(api.trackedTraders.listTraderPerformance);
  const positions = useQuery(api.positions.openPositions);
  const wallet = useQuery(api.wallet.getWallet);
  const allConfig = useQuery(api.config.getAllConfig);
  const actions = useQuery(api.agentActions.recentActions, { limit: 50 });
  const todayApiUsage = useQuery(api.apiUsage.getTodaySummary);

  const toggleTrader = useMutation(api.trackedTraders.toggleTrader);
  const removeTrader = useMutation(api.trackedTraders.removeTrader);
  const setConfig = useMutation(api.config.setConfig);

  const [tab, setTab] = useState<"overview" | "traders" | "signals" | "activity" | "log">("overview");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Config
  const configMap: Record<string, string> = {};
  if (allConfig) {
    for (const entry of allConfig) configMap[entry.key] = entry.value;
  }
  const isEnabled = configMap["enabled"] === "true";
  const isCopyOnly = configMap["copyTradeOnly"] === "true";
  const is247 = configMap["copyTrade247"] === "true";
  const isDryRun = configMap["dryRun"] === "true";

  // Derived
  const enabledTraders = traders?.filter((t) => t.enabled) ?? [];
  const disabledTraders = traders?.filter((t) => !t.enabled) ?? [];
  const copyPositions = positions?.filter((p) => (p as any).copiedFrom) ?? [];
  const totalUnrealizedPnl = copyPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const executedSignals = signals?.filter((s) => s.status === "executed") ?? [];
  const skippedSignals = signals?.filter((s) => s.status === "skipped") ?? [];
  const closedPerf = traderPerformance?.filter((p) => p.status === "closed") ?? [];
  const totalCopyPnl = closedPerf.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const copyWins = closedPerf.filter((p) => (p.pnl ?? 0) > 0).length;
  const copyWinRate = closedPerf.length > 0 ? copyWins / closedPerf.length : 0;

  const copyActions = actions?.filter(
    (a) =>
      a.type === "copy_trade_scan" ||
      a.type === "copy_trade_execute" ||
      a.type === "copy_exit" ||
      a.type === "error"
  ) ?? [];

  // API usage today
  const totalApiCalls = todayApiUsage?.reduce((s, r) => s + r.totalCalls, 0) ?? 0;

  // Data source breakdown from traders
  const sourceCounts: Record<string, number> = {};
  if (traders) {
    for (const t of traders) {
      const src = (t as any).dataSource ?? "data_api";
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }
  }

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: Activity },
    { key: "traders" as const, label: "Traders", icon: Users },
    { key: "signals" as const, label: "Signals", icon: Signal },
    { key: "activity" as const, label: "Activity", icon: Zap },
    { key: "log" as const, label: "Bot Log", icon: Clock },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Copy Trade Bot
        </h1>
        <div className="flex items-center gap-2">
          {isDryRun && (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">DRY RUN</Badge>
          )}
          {is247 && (
            <Badge variant="outline" className="text-purple-400 border-purple-400/30">24/7</Badge>
          )}
          {isCopyOnly && (
            <Badge variant="outline" className="text-blue-400 border-blue-400/30">COPY ONLY</Badge>
          )}
          <Badge variant={isEnabled ? "default" : "secondary"} className={isEnabled ? "bg-green-600" : ""}>
            {isEnabled ? "LIVE" : "PAUSED"}
          </Badge>
        </div>
      </div>

      {/* Quick Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={isEnabled ? "destructive" : "default"} size="sm"
          onClick={() => setConfig({ key: "enabled", value: isEnabled ? "false" : "true" })}>
          {isEnabled ? "Pause Bot" : "Start Bot"}
        </Button>
        <Button variant="outline" size="sm"
          onClick={() => setConfig({ key: "copyTradeOnly", value: isCopyOnly ? "false" : "true" })}
          className={isCopyOnly ? "border-blue-400/50 text-blue-400" : ""}>
          {isCopyOnly ? "Copy Only: ON" : "Copy Only: OFF"}
        </Button>
        <Button variant="outline" size="sm"
          onClick={() => setConfig({ key: "copyTrade247", value: is247 ? "false" : "true" })}
          className={is247 ? "border-purple-400/50 text-purple-400" : ""}>
          {is247 ? "24/7: ON (30s)" : "24/7: OFF (3min)"}
        </Button>
        <Button variant="outline" size="sm"
          onClick={() => setConfig({ key: "dryRun", value: isDryRun ? "false" : "true" })}
          className={isDryRun ? "border-yellow-400/50 text-yellow-400" : "border-green-400/50 text-green-400"}>
          {isDryRun ? "Dry Run: ON" : "LIVE TRADING"}
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-lg font-bold tabular-nums text-green-400">{wallet ? formatUSD(wallet.balance) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Realized P&L</p>
            <p className={`text-lg font-bold tabular-nums ${pnlColor(totalCopyPnl)}`}>
              {totalCopyPnl >= 0 ? "+" : ""}{formatUSD(totalCopyPnl)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Open Copies</p>
            <p className="text-lg font-bold tabular-nums">{copyPositions.length}</p>
            <p className={`text-xs ${pnlColor(totalUnrealizedPnl)}`}>
              {totalUnrealizedPnl >= 0 ? "+" : ""}{formatUSD(totalUnrealizedPnl)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className={`text-lg font-bold tabular-nums ${copyWinRate >= 0.5 ? "text-green-400" : copyWinRate > 0 ? "text-yellow-400" : "text-muted-foreground"}`}>
              {closedPerf.length > 0 ? `${(copyWinRate * 100).toFixed(0)}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Traders</p>
            <p className="text-lg font-bold tabular-nums">{enabledTraders.length}</p>
            <p className="text-xs text-muted-foreground">{disabledTraders.length} disabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Signals</p>
            <p className="text-lg font-bold tabular-nums text-green-400">{executedSignals.length}</p>
            <p className="text-xs text-muted-foreground">{skippedSignals.length} skipped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">API Calls Today</p>
            <p className="text-lg font-bold tabular-nums">{totalApiCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">LLM</p>
            <p className="text-lg font-bold tabular-nums text-cyan-400">DeepSeek</p>
            <p className="text-xs text-muted-foreground">v3.2</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Sources Status Bar */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className="text-muted-foreground flex items-center gap-1">
          <Database className="h-3 w-3" /> Data Sources:
        </span>
        {todayApiUsage && todayApiUsage.length > 0 ? (
          todayApiUsage.map((u) => (
            <Badge key={u.service} variant="outline" className={`text-xs ${SOURCE_COLORS[u.service] ?? ""}`}>
              {SOURCE_LABELS[u.service] ?? u.service}: {u.totalCalls} calls
              {u.totalCalls > 0 && <span className="ml-1 opacity-60">{Math.round(u.totalLatencyMs / u.totalCalls)}ms avg</span>}
            </Badge>
          ))
        ) : (
          <>
            <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/30">Falcon</Badge>
            <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">The Graph</Badge>
            <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/30">Bitquery</Badge>
            <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/30">Alchemy</Badge>
            <Badge variant="outline" className="text-xs">Data API</Badge>
            <span className="text-muted-foreground">(waiting for first cycle)</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ==================== OVERVIEW TAB ==================== */}
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Open Copy Positions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDot className="h-4 w-4" /> Open Copy Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!positions ? <Skeleton count={3} /> : copyPositions.length === 0 ? (
                <Empty icon={CircleDot} msg="No open copy positions" />
              ) : (
                <div className="space-y-2">
                  {copyPositions.map((pos) => (
                    <div key={pos._id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{pos.question}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Badge variant="outline" className={`text-xs ${pos.side === "yes" ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}>
                              {pos.side.toUpperCase()}
                            </Badge>
                            <span>{formatUSD(pos.size)} @ {(pos.avgEntryPrice * 100).toFixed(1)}c</span>
                            <span>Now: {(pos.currentPrice * 100).toFixed(1)}c</span>
                            {(pos as any).copiedFrom && (
                              <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/30">
                                copied
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-mono font-bold text-sm ${pnlColor(pos.unrealizedPnl)}`}>
                            {pos.unrealizedPnl >= 0 ? "+" : ""}{formatUSD(pos.unrealizedPnl)}
                          </p>
                          <p className="text-xs text-muted-foreground">{timeAgo(pos.openedAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Bot Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!actions ? <Skeleton count={5} /> : copyActions.length === 0 ? (
                <Empty icon={Activity} msg="No copy trade activity yet" />
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {copyActions.slice(0, 20).map((action) => {
                    const details = action.details as any;
                    return (
                      <div key={action._id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                        <LogIcon type={action.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{action.summary}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-muted-foreground">{timeAgo(action.timestamp)}</span>
                            {details?.model && (
                              <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/30">{details.model.split("/").pop()}</Badge>
                            )}
                            {details?.latencyMs && (
                              <span className="text-muted-foreground">{details.latencyMs}ms</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trader Copy Performance */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Trader Copy Performance (Your P&L)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!traders ? <Skeleton count={3} /> : <PerfTable traders={enabledTraders} />}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== TRADERS TAB ==================== */}
      {tab === "traders" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="h-5 w-5" /> All Tracked Traders ({traders?.length ?? 0})
              </span>
              {Object.keys(sourceCounts).length > 0 && (
                <div className="flex items-center gap-1.5">
                  {Object.entries(sourceCounts).map(([src, count]) => (
                    <Badge key={src} variant="outline" className={`text-xs ${SOURCE_COLORS[src] ?? ""}`}>
                      {SOURCE_LABELS[src] ?? src}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!traders ? <Skeleton count={8} /> : traders.length === 0 ? (
              <Empty icon={Users} msg="No traders tracked yet. Enable the bot to discover top traders." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 px-1.5">#</th>
                      <th className="text-left py-2 px-1.5">Trader</th>
                      <th className="text-right py-2 px-1.5">Score</th>
                      <th className="text-right py-2 px-1.5">ROI</th>
                      <th className="text-right py-2 px-1.5">Win Rate</th>
                      <th className="text-right py-2 px-1.5">On-Chain WR</th>
                      <th className="text-right py-2 px-1.5">Drawdown</th>
                      <th className="text-right py-2 px-1.5">PnL</th>
                      <th className="text-right py-2 px-1.5">Copy P&L</th>
                      <th className="text-right py-2 px-1.5">Copies</th>
                      <th className="text-center py-2 px-1.5">Source</th>
                      <th className="text-right py-2 px-1.5">Status</th>
                      <th className="text-right py-2 px-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {traders.map((trader, idx) => {
                      const t = trader as any;
                      return (
                        <tr key={trader.address} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-1.5 text-muted-foreground text-xs">#{idx + 1}</td>
                          <td className="py-2 px-1.5">
                            <span className="font-medium">{trader.username}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              {trader.address.slice(0, 6)}...{trader.address.slice(-4)}
                            </span>
                          </td>
                          <td className={`py-2 px-1.5 text-right font-mono font-bold ${scoreColor(t.decayedScore ?? trader.compositeScore)}`}>
                            {(t.decayedScore ?? trader.compositeScore).toFixed(3)}
                          </td>
                          <td className="py-2 px-1.5 text-right font-mono">
                            {t.roi != null ? `${(t.roi * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="py-2 px-1.5 text-right font-mono">
                            {t.realWinRate != null ? `${(t.realWinRate * 100).toFixed(0)}%` : `${(trader.winRate * 100).toFixed(0)}%`}
                          </td>
                          <td className="py-2 px-1.5 text-right font-mono">
                            {t.onChainWinRate != null ? (
                              <span className="text-blue-400">{(t.onChainWinRate * 100).toFixed(0)}%</span>
                            ) : "—"}
                          </td>
                          <td className="py-2 px-1.5 text-right font-mono">
                            {t.maxDrawdown != null ? (
                              <span className="text-red-400">{(t.maxDrawdown * 100).toFixed(1)}%</span>
                            ) : "—"}
                          </td>
                          <td className={`py-2 px-1.5 text-right ${pnlColor(trader.pnl)}`}>
                            {formatUSD(trader.pnl)}
                          </td>
                          <td className={`py-2 px-1.5 text-right font-mono font-bold ${pnlColor(t.copyPnl ?? 0)}`}>
                            {t.copyPnl != null ? `${t.copyPnl >= 0 ? "+" : ""}${formatUSD(t.copyPnl)}` : "—"}
                          </td>
                          <td className="py-2 px-1.5 text-right text-muted-foreground text-xs">
                            {t.copyTradeCount ?? 0}
                            {t.copyWinCount != null && t.copyTradeCount ? (
                              <span className="ml-0.5">({((t.copyWinCount / t.copyTradeCount) * 100).toFixed(0)}%W)</span>
                            ) : null}
                          </td>
                          <td className="py-2 px-1.5 text-center">
                            <Badge variant="outline" className={`text-xs ${SOURCE_COLORS[t.dataSource ?? "data_api"] ?? ""}`}>
                              {SOURCE_LABELS[t.dataSource ?? "data_api"] ?? "API"}
                            </Badge>
                          </td>
                          <td className="py-2 px-1.5 text-right">
                            {trader.enabled ? (
                              <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">
                                {t.disabledReason ? t.disabledReason.slice(0, 12) : "off"}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-1.5 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <button onClick={() => toggleTrader({ address: trader.address, enabled: !trader.enabled })}
                                className="p-1 rounded hover:bg-muted" title={trader.enabled ? "Disable" : "Enable"}>
                                {trader.enabled ? <Eye className="h-3.5 w-3.5 text-green-400" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                              </button>
                              <button onClick={() => removeTrader({ address: trader.address })}
                                className="p-1 rounded hover:bg-muted" title="Remove">
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== SIGNALS TAB ==================== */}
      {tab === "signals" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Signal className="h-5 w-5" /> Copy-Trade Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!signals ? <Skeleton count={5} /> : signals.length === 0 ? (
              <Empty icon={Signal} msg="No signals yet. Signals appear when top traders buy the same side of a market." />
            ) : (
              <div className="space-y-2">
                {signals.map((signal) => (
                  <div key={signal._id} className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{signal.question}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                          <Badge variant="outline" className={`text-xs ${signal.side === "buy_yes" ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}>
                            {signal.side === "buy_yes" ? "BUY YES" : "BUY NO"}
                          </Badge>
                          <span className="text-muted-foreground">{formatUSD(signal.suggestedSize)} @ {(signal.price * 100).toFixed(1)}c</span>
                          <span className="text-muted-foreground">{signal.traderCount} trader{signal.traderCount !== 1 ? "s" : ""}</span>
                          <span className="text-muted-foreground">{(signal.consensus * 100).toFixed(0)}% consensus</span>
                          <span className="text-muted-foreground">score: {signal.avgTraderScore.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{signal.reasoning}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusBadge status={signal.status} />
                        <p className="text-xs text-muted-foreground mt-1">{signal.createdAt ? timeAgo(signal.createdAt) : "—"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== ACTIVITY TAB ==================== */}
      {tab === "activity" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5" /> Trader Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recentActivity ? <Skeleton count={8} /> : recentActivity.length === 0 ? (
              <Empty icon={Zap} msg="No trader activity detected yet." />
            ) : (
              <div className="space-y-1.5">
                {recentActivity.map((act) => (
                  <div key={act._id} className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {act.traderAddress.slice(0, 6)}...{act.traderAddress.slice(-4)}
                        </span>
                        <Badge variant="outline" className={`text-xs ${act.side === "buy_yes" ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}`}>
                          {act.side === "buy_yes" ? "BUY YES" : "BUY NO"}
                        </Badge>
                        <span className="text-muted-foreground text-xs">{formatUSD(act.size)}</span>
                        <span className="text-muted-foreground text-xs">@ {(act.price * 100).toFixed(1)}c</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{act.question}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {act.copied && <Badge className="bg-green-600 text-xs">Copied</Badge>}
                      <span className="text-xs text-muted-foreground">{timeAgo(act.detectedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== BOT LOG TAB ==================== */}
      {tab === "log" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5" /> Copy Trade Bot Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!actions ? <Skeleton count={10} /> : copyActions.length === 0 ? (
              <Empty icon={Clock} msg="No bot activity logged yet." />
            ) : (
              <div className="space-y-0.5">
                {copyActions.map((action) => {
                  const details = action.details as any;
                  const isExpanded = expandedLog === String(action._id);
                  return (
                    <div key={action._id} className="border-b border-border/30 last:border-0">
                      <button
                        onClick={() => setExpandedLog(isExpanded ? null : String(action._id))}
                        className="flex items-start gap-3 py-2.5 text-sm w-full text-left hover:bg-muted/30 px-2 rounded"
                      >
                        <LogIcon type={action.type} />
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{action.summary}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs">
                            <span className="text-muted-foreground">{timeAgo(action.timestamp)}</span>
                            {details?.model && (
                              <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/30">
                                {details.model.split("/").pop()}
                              </Badge>
                            )}
                            {details?.latencyMs && (
                              <span className="text-muted-foreground">{details.latencyMs}ms</span>
                            )}
                            {action.cycleId && (
                              <span className="text-muted-foreground font-mono">{action.cycleId}</span>
                            )}
                          </div>
                        </div>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                      </button>
                      {isExpanded && details && (
                        <div className="ml-10 mb-3 p-3 rounded bg-muted/30 text-xs font-mono overflow-x-auto">
                          <pre className="whitespace-pre-wrap text-muted-foreground">
                            {JSON.stringify(details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Shared Components ----

function Skeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

function Empty({ icon: Icon, msg }: { icon: React.ComponentType<{ className?: string }>; msg: string }) {
  return (
    <div className="text-center py-10 text-muted-foreground">
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

function LogIcon({ type }: { type: string }) {
  switch (type) {
    case "copy_trade_execute": return <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />;
    case "copy_exit": return <ArrowUpRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />;
    case "error": return <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />;
    default: return <CircleDot className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "executed": return <Badge className="bg-green-600 text-xs">Executed</Badge>;
    case "pending": return <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-xs">Pending</Badge>;
    case "skipped": return <Badge variant="secondary" className="text-xs">Skipped</Badge>;
    case "expired": return <Badge variant="secondary" className="text-muted-foreground text-xs">Expired</Badge>;
    default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function PerfTable({ traders }: { traders: any[] }) {
  const sorted = [...traders].filter((t) => (t.copyTradeCount ?? 0) > 0).sort((a, b) => (b.copyPnl ?? 0) - (a.copyPnl ?? 0));

  if (sorted.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">No copy trade data yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="text-left py-2 px-2">Trader</th>
            <th className="text-right py-2 px-2">Your Copy P&L</th>
            <th className="text-right py-2 px-2">Copies</th>
            <th className="text-right py-2 px-2">Copy WR</th>
            <th className="text-right py-2 px-2">Score</th>
            <th className="text-right py-2 px-2">ROI</th>
            <th className="text-center py-2 px-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const wr = t.copyTradeCount > 0 ? (t.copyWinCount ?? 0) / t.copyTradeCount : 0;
            return (
              <tr key={t.address} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 px-2 font-medium">{t.username}</td>
                <td className={`py-2 px-2 text-right font-mono font-bold ${pnlColor(t.copyPnl ?? 0)}`}>
                  {(t.copyPnl ?? 0) >= 0 ? "+" : ""}{formatUSD(t.copyPnl ?? 0)}
                </td>
                <td className="py-2 px-2 text-right">{t.copyTradeCount ?? 0}</td>
                <td className={`py-2 px-2 text-right ${wr >= 0.5 ? "text-green-400" : "text-red-400"}`}>{(wr * 100).toFixed(0)}%</td>
                <td className={`py-2 px-2 text-right font-mono ${scoreColor(t.decayedScore ?? t.compositeScore)}`}>{(t.decayedScore ?? t.compositeScore).toFixed(3)}</td>
                <td className="py-2 px-2 text-right font-mono">{t.roi != null ? `${(t.roi * 100).toFixed(1)}%` : "—"}</td>
                <td className="py-2 px-2 text-center">
                  <Badge variant="outline" className={`text-xs ${SOURCE_COLORS[t.dataSource ?? "data_api"] ?? ""}`}>
                    {SOURCE_LABELS[t.dataSource ?? "data_api"] ?? "API"}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

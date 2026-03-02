"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  createChart,
  ColorType,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type ISeriesPrimitive,
} from "lightweight-charts";
import { cn, CHART_COLORS } from "@/src/lib/utils";
import {
  Crosshair,
  TrendingUp,
  Minus,
  Ruler,
  Maximize,
  Minimize,
  Camera,
  Undo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import {
  type ToolType,
  type AnchorPoint,
  TrendLinePrimitive,
  HLinePrimitive,
  FibonacciPrimitive,
  MeasurePrimitive,
  TooltipPrimitive,
} from "@/src/lib/chart-tools";

const periods = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "ALL", days: 0 },
] as const;

const tools: { type: ToolType; icon: typeof Crosshair; label: string; clicks: number }[] = [
  { type: "crosshair", icon: Crosshair, label: "Crosshair", clicks: 0 },
  { type: "trendline", icon: TrendingUp, label: "Trend Line", clicks: 2 },
  { type: "fibonacci", icon: Ruler, label: "Fibonacci", clicks: 2 },
  { type: "hline", icon: Minus, label: "H-Line", clicks: 1 },
  { type: "measure", icon: ZoomIn, label: "Measure", clicks: 2 },
];

// FIB icon placeholder — we reuse Ruler since lucide doesn't have a fib icon

export function PnlAreaChart() {
  const [activePeriod, setActivePeriod] = useState<number>(90);
  const [activeTool, setActiveTool] = useState<ToolType>("crosshair");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawingCount, setDrawingCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const tooltipRef = useRef<TooltipPrimitive | null>(null);
  const drawingsRef = useRef<ISeriesPrimitive<Time>[]>([]);
  const pendingPointRef = useRef<AnchorPoint | null>(null);

  const daily = useQuery(api.analytics.dailyAnalytics, { limit: 90 });

  const data = useMemo(() => {
    if (!daily) return [];
    const all = [...daily].reverse().map((d) => ({
      time: d.date as string,
      value: d.cumulativeReturn,
    }));
    return activePeriod === 0 ? all : all.slice(-activePeriod);
  }, [daily, activePeriod]);

  // ---- Chart lifecycle ----
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: {
        mode: 0,
        vertLine: { visible: true, labelVisible: false },
        horzLine: { visible: true, labelVisible: true },
      },
      handleScroll: true,
      handleScale: true,
    });

    chart.applyOptions({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const isPositive = data.length > 0 && data[data.length - 1].value >= 0;

    const series = chart.addSeries(AreaSeries, {
      lineColor: isPositive ? CHART_COLORS.greenLine : CHART_COLORS.redLine,
      topColor: isPositive ? CHART_COLORS.greenAreaTop : CHART_COLORS.redAreaTop,
      bottomColor: isPositive
        ? CHART_COLORS.greenAreaBottom
        : CHART_COLORS.redAreaBottom,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });

    series.setData(data as any);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    // Attach tooltip primitive
    const tooltip = new TooltipPrimitive();
    series.attachPrimitive(tooltip);
    tooltipRef.current = tooltip;

    // Re-attach any existing drawings (survive period changes)
    for (const d of drawingsRef.current) {
      series.attachPrimitive(d);
    }

    // Crosshair move → tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !param.seriesData) {
        tooltip.hide();
        return;
      }
      const sd = param.seriesData.get(series);
      if (!sd || !("value" in sd)) {
        tooltip.hide();
        return;
      }
      const y = series.priceToCoordinate((sd as any).value);
      if (y === null) {
        tooltip.hide();
        return;
      }
      tooltip.update(param.point.x, y, String(param.time), (sd as any).value);
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      // Detach drawings before removing chart (so they can be re-attached)
      for (const d of drawingsRef.current) {
        try {
          series.detachPrimitive(d);
        } catch {
          // Already detached
        }
      }
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      tooltipRef.current = null;
    };
  }, [data]);

  // ---- Click handler for drawing tools ----
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || activeTool === "crosshair") return;

    const handler = (param: any) => {
      if (!param.time || !param.point) return;

      const price = series.coordinateToPrice(param.point.y);
      if (price === null) return;

      const point: AnchorPoint = { time: param.time, price: Number(price) };
      const toolDef = tools.find((t) => t.type === activeTool);
      if (!toolDef) return;

      if (toolDef.clicks === 1) {
        // Single-click tools (hline)
        let primitive: ISeriesPrimitive<Time>;
        if (activeTool === "hline") {
          primitive = new HLinePrimitive(point.price);
        } else {
          return;
        }
        series.attachPrimitive(primitive);
        drawingsRef.current.push(primitive);
        setDrawingCount((c) => c + 1);
        setActiveTool("crosshair");
      } else if (toolDef.clicks === 2) {
        // Two-click tools
        if (!pendingPointRef.current) {
          pendingPointRef.current = point;
        } else {
          const p1 = pendingPointRef.current;
          const p2 = point;
          pendingPointRef.current = null;

          let primitive: ISeriesPrimitive<Time>;
          if (activeTool === "trendline") {
            primitive = new TrendLinePrimitive(p1, p2);
          } else if (activeTool === "fibonacci") {
            primitive = new FibonacciPrimitive(p1, p2);
          } else if (activeTool === "measure") {
            primitive = new MeasurePrimitive(p1, p2);
          } else {
            return;
          }
          series.attachPrimitive(primitive);
          drawingsRef.current.push(primitive);
          setDrawingCount((c) => c + 1);
          setActiveTool("crosshair");
        }
      }
    };

    chart.subscribeClick(handler);
    return () => {
      chart.unsubscribeClick(handler);
    };
  }, [activeTool, data]);

  // ---- Tool actions ----
  const handleUndo = useCallback(() => {
    const series = seriesRef.current;
    if (!series || drawingsRef.current.length === 0) return;
    const last = drawingsRef.current.pop()!;
    try {
      series.detachPrimitive(last);
    } catch {
      // Already detached
    }
    setDrawingCount((c) => Math.max(0, c - 1));
  }, []);

  const handleClearAll = useCallback(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const d of drawingsRef.current) {
      try {
        series.detachPrimitive(d);
      } catch {
        // Already detached
      }
    }
    drawingsRef.current = [];
    setDrawingCount(0);
  }, []);

  const handleScreenshot = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const canvas = chart.takeScreenshot();
    const link = document.createElement("a");
    link.download = `pnl-chart-${new Date().toISOString().split("T")[0]}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const handleZoomIn = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const mid = (range.from + range.to) / 2;
    const span = (range.to - range.from) * 0.35;
    chart.timeScale().setVisibleLogicalRange({ from: mid - span, to: mid + span });
  }, []);

  const handleZoomOut = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const mid = (range.from + range.to) / 2;
    const span = (range.to - range.from) * 0.75;
    chart.timeScale().setVisibleLogicalRange({ from: mid - span, to: mid + span });
  }, []);

  const handleResetZoom = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  // Listen for ESC exiting fullscreen
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Reset pending point when tool changes
  useEffect(() => {
    pendingPointRef.current = null;
  }, [activeTool]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "rounded-lg border bg-card",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0"
      )}
    >
      {/* Header row: title + period selector */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Cumulative P&L
        </h3>
        <div className="flex gap-1 rounded-md bg-muted p-0.5">
          {periods.map((p) => (
            <button
              key={p.label}
              onClick={() => setActivePeriod(p.days)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activePeriod === p.days
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-px px-4 pb-2">
        {/* Drawing tools */}
        <div className="flex items-center gap-px rounded-md bg-muted p-0.5">
          {tools.map((t) => (
            <button
              key={t.type}
              onClick={() => setActiveTool(t.type)}
              title={t.label}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                activeTool === t.type
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <div className="mx-1.5 h-4 w-px bg-border" />

        {/* Zoom controls */}
        <div className="flex items-center gap-px rounded-md bg-muted p-0.5">
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Zoom"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mx-1.5 h-4 w-px bg-border" />

        {/* Actions */}
        <div className="flex items-center gap-px rounded-md bg-muted p-0.5">
          <button
            onClick={handleUndo}
            disabled={drawingCount === 0}
            title="Undo Last Drawing"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              drawingCount === 0
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClearAll}
            disabled={drawingCount === 0}
            title="Clear All Drawings"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              drawingCount === 0
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleScreenshot}
            title="Screenshot"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {isFullscreen ? (
              <Minimize className="h-3.5 w-3.5" />
            ) : (
              <Maximize className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Active tool hint */}
        {activeTool !== "crosshair" && (
          <span className="ml-3 text-xs text-muted-foreground">
            {pendingPointRef.current
              ? "Click second point..."
              : `${tools.find((t) => t.type === activeTool)?.label}: click to place`}
          </span>
        )}
      </div>

      {/* Chart area */}
      {daily === undefined ? (
        <div className="mx-4 mb-4 h-[240px] animate-pulse rounded bg-muted" />
      ) : data.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          No P&L data yet
        </div>
      ) : (
        <div
          ref={containerRef}
          className={cn(
            "px-1 pb-1",
            isFullscreen ? "h-[calc(100vh-110px)]" : "h-[240px]",
            activeTool !== "crosshair" && "cursor-crosshair"
          )}
        />
      )}
    </div>
  );
}

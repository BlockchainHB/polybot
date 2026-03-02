"use client";

import { useRef, useEffect, memo } from "react";
import { createChart, ColorType, AreaSeries } from "lightweight-charts";
import { CHART_COLORS } from "@/src/lib/utils";

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

function MiniSparklineInner({
  data,
  width = 60,
  height = 24,
  color = CHART_COLORS.greenLine,
}: MiniSparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "transparent",
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: { mode: 0 },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: color === CHART_COLORS.greenLine ? CHART_COLORS.greenAreaTop
        : color === CHART_COLORS.redLine ? CHART_COLORS.redAreaTop
        : `${color}66`,
      bottomColor: "transparent",
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    series.setData(
      data.map((value, i) => ({
        time: (i + 1) as unknown as import("lightweight-charts").UTCTimestamp,
        value,
      }))
    );

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, width, height, color]);

  if (data.length === 0) return null;

  return <div ref={containerRef} style={{ width, height }} />;
}

export const MiniSparkline = memo(MiniSparklineInner);

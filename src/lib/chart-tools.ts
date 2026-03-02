import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  ISeriesPrimitiveAxisView,
  IChartApiBase,
  ISeriesApi,
  SeriesType,
  Time,
  AutoscaleInfo,
  Logical,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ToolType =
  | "crosshair"
  | "trendline"
  | "fibonacci"
  | "hline"
  | "measure";

export interface AnchorPoint {
  time: Time;
  price: number;
}

const TOOL_COLORS = {
  trendline: "#3b82f6",
  fibonacci: "#a78bfa",
  hline: "#f59e0b",
  measure: "#06b6d4",
  label: "#e2e8f0",
  labelBg: "rgba(30,41,59,0.85)",
} as const;

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  hpr: number,
  vpr: number,
  opts?: { align?: CanvasTextAlign; bg?: boolean; color?: string; fontSize?: number }
) {
  const fontSize = (opts?.fontSize ?? 11) * hpr;
  ctx.font = `${fontSize}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = opts?.align ?? "left";
  ctx.textBaseline = "middle";

  if (opts?.bg) {
    const m = ctx.measureText(text);
    const pad = 4 * hpr;
    const tx = opts?.align === "right" ? x - m.width - pad : x - pad;
    ctx.fillStyle = TOOL_COLORS.labelBg;
    ctx.fillRect(tx, y - fontSize / 2 - pad / 2, m.width + pad * 2, fontSize + pad);
  }

  ctx.fillStyle = opts?.color ?? TOOL_COLORS.label;
  ctx.fillText(text, x, y);
}

// ---------------------------------------------------------------------------
// 1) Trend Line
// ---------------------------------------------------------------------------

class TrendLineRenderer implements IPrimitivePaneRenderer {
  constructor(
    private x1: number,
    private y1: number,
    private x2: number,
    private y2: number
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        const ax = this.x1 * hpr;
        const ay = this.y1 * vpr;
        const bx = this.x2 * hpr;
        const by = this.y2 * vpr;

        ctx.save();
        ctx.strokeStyle = TOOL_COLORS.trendline;
        ctx.lineWidth = 2 * hpr;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Anchor dots
        for (const [px, py] of [[ax, ay], [bx, by]] as const) {
          ctx.beginPath();
          ctx.arc(px, py, 4 * hpr, 0, Math.PI * 2);
          ctx.fillStyle = TOOL_COLORS.trendline;
          ctx.fill();
        }
        ctx.restore();
      }
    );
  }
}

class TrendLinePaneView implements IPrimitivePaneView {
  constructor(
    private _chart: IChartApiBase<Time>,
    private _series: ISeriesApi<SeriesType, Time>,
    private _p1: AnchorPoint,
    private _p2: AnchorPoint
  ) {}

  zOrder() {
    return "top" as const;
  }

  renderer(): IPrimitivePaneRenderer | null {
    const ts = this._chart.timeScale();
    const x1 = ts.timeToCoordinate(this._p1.time);
    const y1 = this._series.priceToCoordinate(this._p1.price);
    const x2 = ts.timeToCoordinate(this._p2.time);
    const y2 = this._series.priceToCoordinate(this._p2.price);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return new TrendLineRenderer(x1, y1, x2, y2);
  }
}

export class TrendLinePrimitive implements ISeriesPrimitive<Time> {
  private _chart!: IChartApiBase<Time>;
  private _series!: ISeriesApi<SeriesType, Time>;
  private _requestUpdate!: () => void;

  constructor(private _p1: AnchorPoint, private _p2: AnchorPoint) {}

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {}

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return [new TrendLinePaneView(this._chart, this._series, this._p1, this._p2)];
  }
}

// ---------------------------------------------------------------------------
// 2) Horizontal Line
// ---------------------------------------------------------------------------

class HLineRenderer implements IPrimitivePaneRenderer {
  constructor(
    private _y: number,
    private _width: number,
    private _price: number
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        const y = this._y * vpr;
        const w = this._width * hpr;

        ctx.save();
        ctx.strokeStyle = TOOL_COLORS.hline;
        ctx.lineWidth = 1.5 * hpr;
        ctx.setLineDash([6 * hpr, 4 * hpr]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        // Price label
        const label = this._price.toFixed(2) + "%";
        drawText(ctx, label, w - 8 * hpr, y - 10 * vpr, hpr, vpr, {
          align: "right",
          bg: true,
          color: TOOL_COLORS.hline,
        });

        ctx.restore();
      }
    );
  }
}

class HLinePaneView implements IPrimitivePaneView {
  constructor(
    private _chart: IChartApiBase<Time>,
    private _series: ISeriesApi<SeriesType, Time>,
    private _price: number
  ) {}

  zOrder() {
    return "top" as const;
  }

  renderer(): IPrimitivePaneRenderer | null {
    const y = this._series.priceToCoordinate(this._price);
    if (y === null) return null;
    const { width } = this._chart.paneSize();
    return new HLineRenderer(y, width, this._price);
  }
}

export class HLinePrimitive implements ISeriesPrimitive<Time> {
  private _chart!: IChartApiBase<Time>;
  private _series!: ISeriesApi<SeriesType, Time>;
  private _requestUpdate!: () => void;

  constructor(private _price: number) {}

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {}
  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return [new HLinePaneView(this._chart, this._series, this._price)];
  }
}

// ---------------------------------------------------------------------------
// 3) Fibonacci Retracement
// ---------------------------------------------------------------------------

class FibonacciRenderer implements IPrimitivePaneRenderer {
  constructor(
    private _levels: { ratio: number; y: number; price: number }[],
    private _x1: number,
    private _x2: number,
    private _width: number
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        ctx.save();

        const levels = this._levels;
        const w = this._width * hpr;

        // Draw fills between levels
        for (let i = 0; i < levels.length - 1; i++) {
          const y1 = levels[i].y * vpr;
          const y2 = levels[i + 1].y * vpr;
          ctx.fillStyle =
            i % 2 === 0
              ? "rgba(167, 139, 250, 0.06)"
              : "rgba(167, 139, 250, 0.03)";
          ctx.fillRect(0, Math.min(y1, y2), w, Math.abs(y2 - y1));
        }

        // Draw level lines and labels
        for (const level of levels) {
          const y = level.y * vpr;

          ctx.strokeStyle = TOOL_COLORS.fibonacci;
          ctx.lineWidth = 1 * hpr;
          ctx.globalAlpha = level.ratio === 0 || level.ratio === 1 ? 0.8 : 0.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          ctx.globalAlpha = 1;

          // Label
          const pct = (level.ratio * 100).toFixed(1);
          const label = `${pct}%  (${level.price.toFixed(2)})`;
          drawText(ctx, label, 8 * hpr, y - 8 * vpr, hpr, vpr, {
            bg: true,
            color: TOOL_COLORS.fibonacci,
            fontSize: 10,
          });
        }

        // Vertical anchor lines
        const x1 = this._x1 * hpr;
        const x2 = this._x2 * hpr;
        const topY = levels[0].y * vpr;
        const botY = levels[levels.length - 1].y * vpr;

        ctx.strokeStyle = TOOL_COLORS.fibonacci;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1 * hpr;
        ctx.setLineDash([4 * hpr, 4 * hpr]);
        for (const x of [x1, x2]) {
          ctx.beginPath();
          ctx.moveTo(x, Math.min(topY, botY));
          ctx.lineTo(x, Math.max(topY, botY));
          ctx.stroke();
        }

        ctx.restore();
      }
    );
  }
}

class FibonacciPaneView implements IPrimitivePaneView {
  constructor(
    private _chart: IChartApiBase<Time>,
    private _series: ISeriesApi<SeriesType, Time>,
    private _p1: AnchorPoint,
    private _p2: AnchorPoint
  ) {}

  zOrder() {
    return "bottom" as const;
  }

  renderer(): IPrimitivePaneRenderer | null {
    const ts = this._chart.timeScale();
    const x1 = ts.timeToCoordinate(this._p1.time);
    const x2 = ts.timeToCoordinate(this._p2.time);
    if (x1 === null || x2 === null) return null;

    const highPrice = Math.max(this._p1.price, this._p2.price);
    const lowPrice = Math.min(this._p1.price, this._p2.price);
    const diff = highPrice - lowPrice;

    const levels = FIB_LEVELS.map((ratio) => {
      const price = highPrice - diff * ratio;
      const y = this._series.priceToCoordinate(price);
      return { ratio, y: y ?? 0, price };
    });

    const { width } = this._chart.paneSize();
    return new FibonacciRenderer(levels, x1, x2, width);
  }
}

export class FibonacciPrimitive implements ISeriesPrimitive<Time> {
  private _chart!: IChartApiBase<Time>;
  private _series!: ISeriesApi<SeriesType, Time>;
  private _requestUpdate!: () => void;

  constructor(private _p1: AnchorPoint, private _p2: AnchorPoint) {}

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {}
  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return [new FibonacciPaneView(this._chart, this._series, this._p1, this._p2)];
  }

  autoscaleInfo(): AutoscaleInfo | null {
    const highPrice = Math.max(this._p1.price, this._p2.price);
    const lowPrice = Math.min(this._p1.price, this._p2.price);
    return { priceRange: { minValue: lowPrice, maxValue: highPrice } };
  }
}

// ---------------------------------------------------------------------------
// 4) Measure Tool
// ---------------------------------------------------------------------------

class MeasureRenderer implements IPrimitivePaneRenderer {
  constructor(
    private _x1: number,
    private _y1: number,
    private _x2: number,
    private _y2: number,
    private _p1: AnchorPoint,
    private _p2: AnchorPoint
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        const ax = this._x1 * hpr;
        const ay = this._y1 * vpr;
        const bx = this._x2 * hpr;
        const by = this._y2 * vpr;

        ctx.save();

        // Shaded rectangle
        ctx.fillStyle = "rgba(6, 182, 212, 0.08)";
        ctx.fillRect(
          Math.min(ax, bx),
          Math.min(ay, by),
          Math.abs(bx - ax),
          Math.abs(by - ay)
        );

        // Border
        ctx.strokeStyle = TOOL_COLORS.measure;
        ctx.lineWidth = 1 * hpr;
        ctx.setLineDash([4 * hpr, 3 * hpr]);
        ctx.strokeRect(
          Math.min(ax, bx),
          Math.min(ay, by),
          Math.abs(bx - ax),
          Math.abs(by - ay)
        );

        // Diagonal
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5 * hpr;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Dots
        for (const [px, py] of [[ax, ay], [bx, by]] as const) {
          ctx.beginPath();
          ctx.arc(px, py, 3.5 * hpr, 0, Math.PI * 2);
          ctx.fillStyle = TOOL_COLORS.measure;
          ctx.fill();
        }

        // Measurement label
        const priceDiff = this._p2.price - this._p1.price;
        const pctChange =
          this._p1.price !== 0
            ? ((priceDiff / Math.abs(this._p1.price)) * 100).toFixed(2)
            : "0.00";
        const sign = priceDiff >= 0 ? "+" : "";
        const label = `${sign}${priceDiff.toFixed(2)}  (${sign}${pctChange}%)`;

        const midX = (ax + bx) / 2;
        const midY = Math.min(ay, by) - 14 * vpr;

        drawText(ctx, label, midX, midY, hpr, vpr, {
          align: "center",
          bg: true,
          color: TOOL_COLORS.measure,
        });

        ctx.restore();
      }
    );
  }
}

class MeasurePaneView implements IPrimitivePaneView {
  constructor(
    private _chart: IChartApiBase<Time>,
    private _series: ISeriesApi<SeriesType, Time>,
    private _p1: AnchorPoint,
    private _p2: AnchorPoint
  ) {}

  zOrder() {
    return "top" as const;
  }

  renderer(): IPrimitivePaneRenderer | null {
    const ts = this._chart.timeScale();
    const x1 = ts.timeToCoordinate(this._p1.time);
    const y1 = this._series.priceToCoordinate(this._p1.price);
    const x2 = ts.timeToCoordinate(this._p2.time);
    const y2 = this._series.priceToCoordinate(this._p2.price);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return new MeasureRenderer(x1, y1, x2, y2, this._p1, this._p2);
  }
}

export class MeasurePrimitive implements ISeriesPrimitive<Time> {
  private _chart!: IChartApiBase<Time>;
  private _series!: ISeriesApi<SeriesType, Time>;
  private _requestUpdate!: () => void;

  constructor(private _p1: AnchorPoint, private _p2: AnchorPoint) {}

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {}
  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return [new MeasurePaneView(this._chart, this._series, this._p1, this._p2)];
  }
}

// ---------------------------------------------------------------------------
// 5) Crosshair Tooltip (enhanced)
// ---------------------------------------------------------------------------

class TooltipRenderer implements IPrimitivePaneRenderer {
  constructor(
    private _x: number,
    private _y: number,
    private _time: string,
    private _value: number,
    private _width: number
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        const x = this._x * hpr;
        const y = this._y * vpr;

        ctx.save();

        // Dot on the line
        ctx.beginPath();
        ctx.arc(x, y, 5 * hpr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.8)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5 * hpr;
        ctx.stroke();

        // Tooltip box
        const sign = this._value >= 0 ? "+" : "";
        const line1 = this._time;
        const line2 = `${sign}${this._value.toFixed(2)}%`;

        const fontSize = 11 * hpr;
        ctx.font = `600 ${fontSize}px -apple-system, system-ui, sans-serif`;
        const w1 = ctx.measureText(line1).width;
        const w2 = ctx.measureText(line2).width;
        const boxW = Math.max(w1, w2) + 16 * hpr;
        const boxH = 38 * vpr;
        const pad = 8 * hpr;

        // Position tooltip (flip if near edge)
        let tx = x + 12 * hpr;
        if (tx + boxW > this._width * hpr) tx = x - boxW - 12 * hpr;
        const ty = y - boxH / 2;

        // Background
        ctx.fillStyle = TOOL_COLORS.labelBg;
        ctx.beginPath();
        ctx.roundRect(tx, ty, boxW, boxH, 4 * hpr);
        ctx.fill();
        ctx.strokeStyle = "rgba(148,163,184,0.2)";
        ctx.lineWidth = 1 * hpr;
        ctx.stroke();

        // Text
        ctx.fillStyle = "#94a3b8";
        ctx.font = `${10 * hpr}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(line1, tx + pad, ty + 4 * vpr);

        ctx.fillStyle = this._value >= 0 ? "#22c55e" : "#ef4444";
        ctx.font = `600 ${fontSize}px -apple-system, system-ui, sans-serif`;
        ctx.fillText(line2, tx + pad, ty + 18 * vpr);

        ctx.restore();
      }
    );
  }
}

class TooltipPaneView implements IPrimitivePaneView {
  constructor(
    private _x: number,
    private _y: number,
    private _time: string,
    private _value: number,
    private _width: number
  ) {}

  zOrder() {
    return "top" as const;
  }

  renderer(): IPrimitivePaneRenderer {
    return new TooltipRenderer(
      this._x,
      this._y,
      this._time,
      this._value,
      this._width
    );
  }
}

export class TooltipPrimitive implements ISeriesPrimitive<Time> {
  private _chart!: IChartApiBase<Time>;
  private _series!: ISeriesApi<SeriesType, Time>;
  private _requestUpdate!: () => void;
  private _x = 0;
  private _y = 0;
  private _time = "";
  private _value = 0;
  private _visible = false;

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {}
  updateAllViews(): void {}

  update(x: number, y: number, time: string, value: number) {
    this._x = x;
    this._y = y;
    this._time = time;
    this._value = value;
    this._visible = true;
    this._requestUpdate();
  }

  hide() {
    this._visible = false;
    this._requestUpdate();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    if (!this._visible) return [];
    const { width } = this._chart.paneSize();
    return [new TooltipPaneView(this._x, this._y, this._time, this._value, width)];
  }
}

import { useId } from "react";
import type { Tone } from "../ui/Primitives";
import { cn } from "../../lib/cn";

const TONE_COLOR: Record<Tone, string> = {
  neutral: "var(--text-muted)",
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  violet: "var(--violet)",
};

export function Sparkline({
  data,
  tone = "accent",
  width = 120,
  height = 36,
  className,
}: {
  data: number[];
  tone?: Tone;
  width?: number;
  height?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const points = data.map((value, index) => {
    const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * width;
    const y = height - 3 - ((value - min) / range) * (height - 8);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const color = TONE_COLOR[tone];
  return (
    <svg className={cn("sparkline", className)} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 ? (
        <circle cx={points[points.length - 1]![0]} cy={points[points.length - 1]![1]} r="2.4" fill={color} />
      ) : null}
    </svg>
  );
}

export function BarList({
  items,
  className,
  max,
}: {
  items: Array<{ label: string; value: number; tone?: Tone }>;
  className?: string;
  max?: number;
}) {
  const ceiling = Math.max(1, max ?? Math.max(...items.map((item) => item.value)));
  return (
    <div className={cn("bar-list", className)}>
      {items.map((item) => (
        <div className="bar-list__row" key={item.label}>
          <span className="bar-list__label">{item.label}</span>
          <span className="bar-list__track">
            <span
              className={cn("bar-list__fill", `bar-list__fill--${item.tone ?? "accent"}`)}
              style={{ width: `${Math.max(2, (item.value / ceiling) * 100)}%` }}
            />
          </span>
          <span className="bar-list__value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  segments,
  size = 132,
  thickness = 12,
  center,
  sublabel,
}: {
  segments: Array<{ label: string; value: number; tone: Tone }>;
  size?: number;
  thickness?: number;
  center?: string;
  sublabel?: string;
}) {
  const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        {segments.map((segment) => {
          const length = (segment.value / total) * circumference;
          const dash = `${Math.max(0, length - 3)} ${circumference}`;
          const element = (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={TONE_COLOR[segment.tone]}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += length;
          return element;
        })}
      </svg>
      <div className="donut__center">
        <strong>{center ?? total}</strong>
        {sublabel ? <span>{sublabel}</span> : null}
      </div>
    </div>
  );
}

export function MiniBars({ data, tone = "accent" }: { data: number[]; tone?: Tone }) {
  const max = Math.max(1, ...data);
  return (
    <span className="mini-bars" aria-hidden>
      {data.map((value, index) => (
        <span
          key={index}
          className={cn("mini-bars__bar", `mini-bars__bar--${tone}`)}
          style={{ height: `${Math.max(12, (value / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

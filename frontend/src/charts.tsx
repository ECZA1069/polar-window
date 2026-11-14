import type { MouseEvent } from "react";
import { Iv } from "./store";

const W = 720;
const fmtT = (ms: number) => new Date(ms).toISOString().slice(5, 16).replace("T", " ");

type Line = { values: number[]; color: string; label: string };
type Props = {
  t: number[];
  lines: Line[];
  bands?: { iv: Iv[]; color: string }[];
  cursor?: number;
  onPick?: (ms: number) => void;
  unit?: string;
  height?: number;
  yMin?: number;
  yMax?: number;
  zeroLine?: boolean;
};

export function Chart({
  t,
  lines,
  bands = [],
  cursor,
  onPick,
  unit = "",
  height = 118,
  yMin,
  yMax,
  zeroLine,
}: Props) {
  if (!t.length) return null;
  const all = lines.flatMap((l) => l.values);
  let lo = yMin ?? Math.min(...all),
    hi = yMax ?? Math.max(...all);
  if (hi - lo < 1e-6) {
    hi = lo + 1;
  }
  const pad = (hi - lo) * 0.08;
  lo = yMin ?? lo - pad;
  hi = yMax ?? hi + pad;
  const L = 46,
    R = 12,
    T = 8,
    B = 20,
    H = height;
  const x0 = t[0],
    x1 = t[t.length - 1];
  const X = (ms: number) => L + ((ms - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  
  const click = (e: MouseEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const b = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * W;
    onPick(Math.round(x0 + Math.min(1, Math.max(0, (px - L) / (W - L - R))) * (x1 - x0)));
  };
  
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" onClick={click} role="img">
      <defs>
        <linearGradient id="cursorGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Interval shaded bands (e.g., sunlit or dark intervals) */}
      {bands.flatMap((b, bi) =>
        b.iv.map((i, k) => (
          <rect
            key={`${bi}-${k}`}
            x={X(Math.max(i.start_ms, x0))}
            y={T}
            width={Math.max(0.75, X(Math.min(i.end_ms, x1)) - X(Math.max(i.start_ms, x0)))}
            height={H - T - B}
            fill={b.color}
            opacity={0.15}
          />
        ))
      )}

      {/* Y-axis grid lines and labels */}
      {[0, 0.5, 1].map((f) => {
        const v = lo + f * (hi - lo);
        return (
          <g key={f}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="grid" />
            <text x={L - 6} y={Y(v) + 3} textAnchor="end" className="axis">
              {v.toFixed(Math.abs(hi - lo) < 10 ? 1 : 0)}
            </text>
          </g>
        );
      })}

      {/* Zero line */}
      {zeroLine && lo < 0 && hi > 0 && <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} className="zero" />}

      {/* X-axis time ticks */}
      {ticks.map((f) => (
        <text
          key={f}
          x={X(x0 + f * (x1 - x0))}
          y={H - 5}
          textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
          className="axis"
        >
          {fmtT(x0 + f * (x1 - x0))}
        </text>
      ))}

      {/* Data curves */}
      {lines.map((l) => (
        <polyline
          key={l.label}
          fill="none"
          stroke={l.color}
          strokeWidth={1.8}
          points={l.values.map((v, i) => `${X(t[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}
          style={{ filter: `drop-shadow(0 0 4px ${l.color}33)` }}
        />
      ))}

      {/* Current Simulation Cursor indicator */}
      {cursor !== undefined && cursor >= x0 && cursor <= x1 && (
        <g>
          <line x1={X(cursor)} x2={X(cursor)} y1={T} y2={H - B} className="cursor" />
          <circle cx={X(cursor)} cy={T + 4} r={3} fill="var(--cyan)" />
        </g>
      )}

      {/* Unit tag in top-left */}
      <text x={L + 6} y={T + 11} className="axis" fill="var(--cyan)" fontWeight="600">
        {unit}
      </text>
    </svg>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="lg">
      {items.map((i) => (
        <span key={i.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <i style={{ background: i.color, boxShadow: `0 0 6px ${i.color}66` }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

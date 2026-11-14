import { Fragment } from "react";
import { useSim } from "./store";

const SUN_COLOR = "#fbbf24", EARTH_COLOR = "#00f0ff", AXIS_COLOR = "#818cf8";

function Dome({ items }: { items: { label: string; el: number; az: number; color: string }[] }) {
  const C = 110, R = 90;
  // Sky chart convention: zenith at centre, horizon at the rim, north up, east left.
  const pos = (el: number, az: number) => {
    const r = (R * (90 - Math.max(el, 0))) / 90, a = (az * Math.PI) / 180;
    return [C - r * Math.sin(a), C - r * Math.cos(a)];
  };
  return (
    <svg viewBox="0 0 220 220" className="dome" role="img" aria-label="Sky dome radar">
      <defs>
        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0, 240, 255, 0.08)" />
          <stop offset="70%" stopColor="rgba(0, 240, 255, 0.02)" />
          <stop offset="100%" stopColor="rgba(3, 6, 13, 0.4)" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R} fill="url(#radarGlow)" />
      {[0, 30, 60].map((e) => (
        <circle
          key={e}
          cx={C}
          cy={C}
          r={(R * (90 - e)) / 90}
          stroke={e === 0 ? "rgba(0, 240, 255, 0.45)" : "rgba(56, 189, 248, 0.15)"}
          strokeWidth={e === 0 ? 1.5 : 1}
          strokeDasharray={e === 0 ? undefined : "3 3"}
          fill="none"
        />
      ))}
      {/* Reticle Crosshairs */}
      <line x1={C} x2={C} y1={C - R} y2={C + R} stroke="rgba(56, 189, 248, 0.2)" strokeWidth={1} />
      <line x1={C - R} x2={C + R} y1={C} y2={C} stroke="rgba(56, 189, 248, 0.2)" strokeWidth={1} />
      
      {/* Cardinal Labels */}
      <text x={C} y={C - R - 5} textAnchor="middle" fill="var(--cyan)" fontSize="9" fontFamily="var(--font-mono)" fontWeight="700">N</text>
      <text x={C} y={C + R + 13} textAnchor="middle" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-mono)">S</text>
      <text x={C - R - 6} y={C + 3} textAnchor="end" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-mono)">E</text>
      <text x={C + R + 6} y={C + 3} textAnchor="start" fill="var(--text-dim)" fontSize="9" fontFamily="var(--font-mono)">W</text>
      
      {/* Zenith Center Point */}
      <circle cx={C} cy={C} r={2.5} fill="var(--cyan)" />
      <text x={C + 6} y={C - 5} fill="var(--text-dim)" fontSize="8.5" fontFamily="var(--font-mono)">zenith</text>
      
      {/* Projected Celestial Items */}
      {items.map((it) => {
        const [x, y] = pos(it.el, it.az);
        const below = it.el < 0;
        return (
          <g key={it.label}>
            {/* Glow halo */}
            {!below && <circle cx={x} cy={y} r={9} fill={it.color} opacity={0.2} />}
            <circle
              cx={x}
              cy={y}
              r={4.5}
              fill={below ? "transparent" : it.color}
              stroke={it.color}
              strokeWidth={1.5}
              strokeDasharray={below ? "2 2" : undefined}
            />
            <text
              x={x + 7}
              y={y + 3}
              fontSize="9"
              fontFamily="var(--font-mono)"
              fontWeight="600"
              fill={it.color}
            >
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Strip({ items }: { items: { label: string; el: number; az: number; color: string }[] }) {
  const W = 280, H = 100, lo = -15, hi = Math.max(15, Math.ceil(Math.max(...items.map((i) => i.el)) / 5) * 5);
  const X = (az: number) => (az / 360) * (W - 24) + 12;
  const Y = (el: number) => 12 + (1 - (Math.min(hi, Math.max(lo, el)) - lo) / (hi - lo)) * (H - 26);
  
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" style={{ width: "100%", height: "auto" }} role="img" aria-label="Elevation versus azimuth">
      {/* Shaded Below-Horizon Area */}
      <rect x={12} y={Y(0)} width={W - 24} height={H - 12 - Y(0)} fill="rgba(3, 7, 16, 0.75)" />
      
      {/* Geometric Horizon Line */}
      <line x1={12} x2={W - 12} y1={Y(0)} y2={Y(0)} stroke="var(--cyan)" strokeWidth={1.2} strokeDasharray="4 2" />
      
      {[0, 90, 180, 270, 360].map((a) => (
        <text key={a} x={X(a)} y={H - 2} textAnchor="middle" fill="var(--text-dim)" fontSize="8.5" fontFamily="var(--font-mono)">
          {a}°
        </text>
      ))}
      <text x={14} y={Y(0) - 4} fill="var(--cyan)" fontSize="8.5" fontFamily="var(--font-mono)">
        HORIZON 0°
      </text>
      {items.map((it) => (
        <g key={it.label}>
          <circle cx={X(it.az)} cy={Y(it.el)} r={3.5} fill={it.color} />
          <text
            x={X(it.az) + 5}
            y={Y(it.el) - 3}
            fill={it.color}
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fontWeight="600"
          >
            {it.label} {it.el >= 0 ? `+${it.el.toFixed(1)}°` : `${it.el.toFixed(1)}°`}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function HorizonDome() {
  const g = useSim((s) => s.geometry);
  if (!g) return <p className="hint">Waiting for SPICE geometry calculation...</p>;
  
  const axisEnd = g.axis.north.elevation_deg > g.axis.south.elevation_deg
    ? (["Axis N", g.axis.north] as const)
    : (["Axis S", g.axis.south] as const);
    
  const items = [
    { label: "Sun", el: g.sun.elevation_deg, az: g.sun.azimuth_deg, color: SUN_COLOR },
    { label: "Earth", el: g.earth.elevation_deg, az: g.earth.azimuth_deg, color: EARTH_COLOR },
    { label: axisEnd[0], el: axisEnd[1].elevation_deg, az: axisEnd[1].azimuth_deg, color: AXIS_COLOR },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <Dome items={items} />
      <Strip items={items} />
    </div>
  );
}

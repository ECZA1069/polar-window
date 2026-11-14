import { useState } from "react";
import { useSim, Iv } from "./store";
import { Chart, Legend } from "./charts";
import { post, iso, stepMinutes } from "./api";

const dt = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
const hrs = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(1)} h`);
const Loading = () => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "16px 0", color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
    <span className="status-indicator-dot connecting" />
    <span>COMPUTING SPICE ORBITAL GEOMETRY...</span>
  </div>
);

function Err() {
  const e = useSim((s) => s.analysisError);
  return e ? (
    <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "4px", padding: "8px 12px", color: "var(--rose)", fontSize: "11px", fontFamily: "var(--font-mono)", margin: "6px 0" }}>
      ERROR: {e}
    </div>
  ) : null;
}

export function TimelinePanel() {
  const s = useSim();
  const tl = s.timeline;
  const setPreset = (p: "1" | "7" | "30") => s.set({ windowPreset: p, windowHours: Number(p) * 24 });
  
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10.5px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase" }}>WINDOW:</span>
          {(["1", "7", "30"] as const).map((p) => (
            <button
              key={p}
              className={`btn-site-chip ${s.windowPreset === p ? "active" : ""}`}
              onClick={() => setPreset(p)}
              style={{ padding: "3px 8px" }}
            >
              {p === "1" ? "24 HOURS" : `${p} DAYS`}
            </button>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "6px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>CUSTOM:</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={s.windowHours}
              onChange={(e) => s.set({ windowPreset: "custom", windowHours: Math.min(1440, Math.max(1, Number(e.target.value) || 1)) })}
              style={{ width: "55px", background: "rgba(4,8,16,0.8)", border: "1px solid var(--line-subtle)", borderRadius: "3px", color: "#fff", padding: "2px 5px", fontSize: "10.5px", fontFamily: "var(--font-mono)" }}
            />
            <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>HRS</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            className="btn-header"
            onClick={() => s.set({ windowStartMs: s.utcMs })}
            style={{ fontSize: "10px", padding: "3px 8px" }}
          >
            SYNC WINDOW TO TIME
          </button>
          <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            FROM {dt(s.windowStartMs)} UTC · STEP {stepMinutes(s.windowHours)}M
          </span>
        </div>
      </div>

      <Err />
      {!tl && !s.analysisError && <Loading />}
      
      {tl && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", margin: "6px 0 10px" }}>
            <div className="metric-box">
              <span className="metric-title">GEOMETRIC SUNLIGHT</span>
              <span className="metric-val amber">{tl.stats.sunlit_pct.toFixed(1)}<span className="unit">%</span></span>
            </div>
            <div className="metric-box">
              <span className="metric-title">LONGEST CONTINUOUS LIGHT</span>
              <span className="metric-val">{hrs(tl.stats.longest_sunlit_h)}</span>
            </div>
            <div className="metric-box">
              <span className="metric-title">LONGEST CONTINUOUS DARK</span>
              <span className="metric-val">{hrs(tl.stats.longest_dark_h)}</span>
            </div>
            <div className="metric-box">
              <span className="metric-title">DARK ECLIPSE INTERVALS</span>
              <span className="metric-val cyan">{tl.dark.length}</span>
            </div>
          </div>

          <div className="chart-container-box">
            <div className="chart-header-row">
              <span>SOLAR ELEVATION ANGLE (REL. GEOMETRIC HORIZON)</span>
              <Legend items={[{ color: "#fbbf24", label: "Sun elevation" }]} />
            </div>
            <Chart
              t={tl.t_ms}
              unit="DEG"
              zeroLine
              lines={[{ values: tl.sun_elev_deg, color: "#fbbf24", label: "Sun" }]}
              bands={[{ iv: tl.sunlit, color: "#fbbf24" }]}
              cursor={s.utcMs}
              onPick={(ms) => s.set({ utcMs: ms })}
            />
          </div>

          <div className="chart-container-box">
            <div className="chart-header-row">
              <span>EARTH ELEVATION ANGLE & GEOMETRIC LOS</span>
              <Legend items={[{ color: "#00f0ff", label: "Earth elevation" }]} />
            </div>
            <Chart
              t={tl.t_ms}
              unit="DEG"
              zeroLine
              lines={[{ values: tl.earth_elev_deg, color: "#00f0ff", label: "Earth" }]}
              bands={[{ iv: tl.earth_visible, color: "#00f0ff" }]}
              cursor={s.utcMs}
              onPick={(ms) => s.set({ utcMs: ms })}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function PowerPanel() {
  const s = useSim();
  const pw = s.power, tl = s.timeline;

  return (
    <div>
      <Err />
      {!pw && !s.analysisError && <Loading />}
      {pw && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", margin: "6px 0 10px" }}>
            <div className="metric-box">
              <span className="metric-title">TOTAL ENERGY GENERATED</span>
              <span className="metric-val emerald">
                {pw.summary.energy_generated_wh >= 1000 ? `${(pw.summary.energy_generated_wh / 1000).toFixed(2)} kWh` : `${pw.summary.energy_generated_wh.toFixed(0)} Wh`}
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-title">TOTAL ENERGY DEMAND</span>
              <span className="metric-val">
                {pw.summary.energy_load_wh >= 1000 ? `${(pw.summary.energy_load_wh / 1000).toFixed(2)} kWh` : `${pw.summary.energy_load_wh.toFixed(0)} Wh`}
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-title">LOWEST BATTERY RESERVE</span>
              <span className={`metric-val ${(pw.summary.min_battery_pct ?? 0) < 20 ? "rose" : "amber"}`}>
                {pw.summary.min_battery_pct !== null ? `${pw.summary.min_battery_pct.toFixed(0)}%` : "–"}
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-title">HOURS LOAD UNMET</span>
              <span className={`metric-val ${pw.summary.hours_load_unmet > 0 ? "rose" : "emerald"}`}>
                {hrs(pw.summary.hours_load_unmet)}
              </span>
            </div>
          </div>

          <div className="chart-container-box">
            <div className="chart-header-row">
              <span>SOLAR ARRAY GENERATION (WATTS)</span>
              <Legend items={[{ color: "#fbbf24", label: "Generated power" }]} />
            </div>
            <Chart
              t={pw.t_ms}
              unit="W"
              yMin={0}
              lines={[{ values: pw.power_w, color: "#fbbf24", label: "P" }]}
              bands={tl ? [{ iv: tl.dark, color: "#000" }] : []}
              cursor={s.utcMs}
              onPick={(ms) => s.set({ utcMs: ms })}
            />
          </div>

          <div className="chart-container-box">
            <div className="chart-header-row">
              <span>BATTERY STATE OF CHARGE (WATT-HOURS)</span>
              <Legend items={[{ color: "#34d399", label: "Stored energy" }]} />
            </div>
            <Chart
              t={pw.t_ms}
              unit="WH"
              yMin={0}
              yMax={pw.panel.battery_wh}
              lines={[{ values: pw.battery_wh, color: "#34d399", label: "SOC" }]}
              cursor={s.utcMs}
              onPick={(ms) => s.set({ utcMs: ms })}
            />
          </div>
        </>
      )}
    </div>
  );
}

const Row = ({ iv }: { iv: Iv }) => (
  <tr>
    <td style={{ fontFamily: "var(--font-mono)" }}>{dt(iv.start_ms)}{iv.clipped_start ? " *" : ""}</td>
    <td style={{ fontFamily: "var(--font-mono)" }}>{dt(iv.end_ms)}{iv.clipped_end ? " *" : ""}</td>
    <td style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)", fontWeight: 600 }}>{hrs(iv.duration_h)}</td>
  </tr>
);

export function CommsPanel() {
  const s = useSim();
  const c = s.comms;

  return (
    <div>
      <Err />
      {!c && !s.analysisError && <Loading />}
      {c && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", margin: "6px 0 10px" }}>
            <div className="metric-box">
              <span className="metric-title">EARTH VISIBILITY FRACTION</span>
              <span className="metric-val cyan">{c.earth_visible_pct.toFixed(1)}<span className="unit">%</span></span>
            </div>
            <div className="metric-box">
              <span className="metric-title">LONGEST CONTACT WINDOW</span>
              <span className="metric-val">{hrs(c.longest_window_h)}</span>
            </div>
            <div className="metric-box">
              <span className="metric-title">TOTAL DIRECT WINDOWS</span>
              <span className="metric-val emerald">{c.windows.length}</span>
            </div>
          </div>

          {c.windows.length === 0 ? (
            <p style={{ color: "var(--amber)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
              NO DIRECT LINE-OF-SIGHT: Earth remains below geometric horizon for this observation window.
            </p>
          ) : (
            <div className="scroll" style={{ background: "rgba(4,8,16,0.7)", border: "1px solid var(--line-glass)", borderRadius: "4px" }}>
              <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line-subtle)", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "10px" }}>
                    <th style={{ padding: "6px 10px" }}>AOS (UTC)</th>
                    <th style={{ padding: "6px 10px" }}>LOS (UTC)</th>
                    <th style={{ padding: "6px 10px" }}>WINDOW DURATION</th>
                  </tr>
                </thead>
                <tbody>
                  {c.windows.map((w, i) => (
                    <Row key={i} iv={w} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "6px" }}>
            * Asterisk indicates window clipped by the observation boundaries. Calculations assume direct geometric LOS without terrain obstruction.
          </p>
        </>
      )}
    </div>
  );
}

type Row2 = {
  label: string;
  sunlit_pct: number;
  longest_dark_h: number;
  mean_power_w: number;
  energy_generated_wh: number;
  earth_visible_pct: number;
  longest_earth_window_h: number;
  elevation_m?: number;
  slope_deg?: number;
};

export function ComparePanel() {
  const s = useSim();
  const [sel, setSel] = useState<string[]>(["__current", "pole"]);
  const [rows, setRows] = useState<Row2[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = [
    { id: "__current", label: `Active (${s.lat.toFixed(2)}°, ${s.lon.toFixed(2)}°E)`, lat: s.lat, lon: s.lon },
    ...s.sites.map((x) => ({ id: x.id, label: x.name, lat: x.lat, lon: x.lon })),
  ];

  const toggle = (id: string) =>
    setSel((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 4 ? [...c, id] : c));

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const locations = options.filter((o) => sel.includes(o.id)).map((o) => ({ label: o.label, lat: o.lat, lon: o.lon }));
      const j = await post("/api/sites/compare", {
        start_utc: iso(s.windowStartMs),
        hours: s.windowHours,
        step_min: stepMinutes(s.windowHours),
        locations,
        panel: s.panel,
      });
      setRows(j.data.rows);
    } catch (e: any) {
      setErr(e.message);
      setRows(null);
    }
    setBusy(false);
  };

  const bar = (v: number, max: number, c: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ width: "80px", height: "6px", background: "rgba(15,23,42,0.8)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (v / (max || 1)) * 100)}%`, height: "100%", background: c, boxShadow: `0 0 6px ${c}66` }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>{v.toFixed(1)}</span>
    </div>
  );

  const maxP = Math.max(1, ...(rows ?? []).map((r) => r.mean_power_w));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>SELECT 2–4 TARGET SITES:</span>
          <button
            className="btn-header"
            disabled={sel.length < 2 || busy}
            onClick={run}
            style={{ borderColor: "var(--cyan)", color: "var(--cyan)", fontWeight: 600 }}
          >
            {busy ? "CALCULATING MATRIX..." : "EXECUTE COMPARISON"}
          </button>
        </div>
        <span style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          WINDOW: {s.windowHours}H · STEP {stepMinutes(s.windowHours)}M
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
        {options.map((o) => (
          <label key={o.id} className={`btn-site-chip ${sel.includes(o.id) ? "active" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <input type="checkbox" checked={sel.includes(o.id)} onChange={() => toggle(o.id)} style={{ margin: 0 }} />
            {o.label}
          </label>
        ))}
      </div>

      {err && <div style={{ color: "var(--rose)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>{err}</div>}

      {rows && (
        <div className="scroll" style={{ background: "rgba(4,8,16,0.7)", border: "1px solid var(--line-glass)", borderRadius: "4px" }}>
          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line-subtle)", color: "var(--text-dim)", fontSize: "10px", textTransform: "uppercase" }}>
                <th style={{ padding: "6px 8px" }}>SITE</th>
                <th style={{ padding: "6px 8px" }}>SUNLIT %</th>
                <th style={{ padding: "6px 8px" }}>MAX DARK</th>
                <th style={{ padding: "6px 8px" }}>MEAN POWER (W)</th>
                <th style={{ padding: "6px 8px" }}>EARTH VIS %</th>
                <th style={{ padding: "6px 8px" }}>MAX COMMS</th>
                <th style={{ padding: "6px 8px" }}>DEM ELEV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "5px 8px", fontWeight: 600, color: "#fff" }}>{r.label}</td>
                  <td style={{ padding: "5px 8px" }}>{bar(r.sunlit_pct, 100, "#fbbf24")}</td>
                  <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono)" }}>{hrs(r.longest_dark_h)}</td>
                  <td style={{ padding: "5px 8px" }}>{bar(r.mean_power_w, maxP, "#34d399")}</td>
                  <td style={{ padding: "5px 8px" }}>{bar(r.earth_visible_pct, 100, "#00f0ff")}</td>
                  <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono)" }}>{hrs(r.longest_earth_window_h)}</td>
                  <td style={{ padding: "5px 8px", color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
                    {r.elevation_m !== undefined && r.elevation_m !== null ? `${r.elevation_m >= 0 ? "+" : ""}${r.elevation_m.toFixed(0)} m` : "n/a"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function LandingPanel() {
  const s = useSim();
  const geo = s.geometry;
  const ev = geo?.landing_evaluation;
  const recommendations = s.landingRecommendations;
  const loading = s.landingLoading;

  const navigateToSite = (rec: any) => {
    s.set({ siteId: rec.id, lat: rec.lat, lon: rec.lon });
    if (rec.lat <= -80) s.setView("south");
    else if (rec.lat >= 80) s.setView("north");
    else s.setView("free");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "13px", fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.08em" }}>
            AUTONOMOUS LUNAR LANDING SITE EVALUATOR
          </div>
          <div style={{ fontSize: "10.5px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            MULTI-CRITERIA EVALUATION · NASA LRO LOLA TOPOGRAPHY + SPICE EPHEMERIDES · VACUUM HORIZON
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="card-badge emerald">NASA LOLA CALIBRATED</span>
          <span className="card-badge">VACUUM (NO REFRACTION)</span>
        </div>
      </div>

      {/* Active Coordinate Landing Assessment Banner */}
      <div
        style={{
          background: "rgba(6, 12, 24, 0.85)",
          border: `1px solid ${ev ? ev.badge_color : "var(--line-strong)"}`,
          borderRadius: "6px",
          padding: "12px 14px",
          marginBottom: "12px",
          boxShadow: `0 4px 20px ${ev ? ev.badge_color + "22" : "rgba(0,0,0,0.5)"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="card-badge" style={{ background: ev ? ev.badge_color + "22" : undefined, color: ev?.badge_color, borderColor: ev?.badge_color }}>
                {ev ? ev.status : "CALCULATING"}
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                {s.siteId ? s.sites.find((x) => x.id === s.siteId)?.name : `Coordinates (${s.lat.toFixed(2)}°, ${s.lon.toFixed(2)}°E)`}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "8px" }}>
              {ev?.recommendation ?? "Evaluating multi-spectral surface hazards, terrain slope angles, and direct communications visibility."}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "10.5px", fontFamily: "var(--font-mono)" }}>
              <span style={{ color: "var(--text-dim)" }}>
                LOLA ELEVATION: <b style={{ color: "#fff" }}>{geo?.elevation_m !== undefined ? `${geo.elevation_m >= 0 ? "+" : ""}${geo.elevation_m.toFixed(0)} m` : "–"}</b>
              </span>
              <span style={{ color: "var(--text-dim)" }}>
                TERRAIN SLOPE: <b style={{ color: (geo?.slope_deg ?? 0) <= 5 ? "var(--emerald)" : "var(--amber)" }}>{geo?.slope_deg?.toFixed(1) ?? "–"}°</b> (Touchdown threshold &lt; 5°)
              </span>
              <span style={{ color: "var(--text-dim)" }}>
                HORIZON DIP: <b style={{ color: "var(--cyan)" }}>{geo?.horizon_dip_deg?.toFixed(2) ?? "–"}°</b> (Vacuum Horizon)
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 16px", background: "rgba(4,8,16,0.8)", border: "1px solid var(--line-glass)", borderRadius: "6px" }}>
            <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase" }}>
              SUITABILITY INDEX
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 800, color: ev?.badge_color ?? "var(--cyan)", textShadow: `0 0 12px ${ev?.badge_color}66` }}>
              {ev ? `${ev.suitability_score.toFixed(1)}%` : "–"}
            </span>
            <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
              {ev?.grade ?? "EVALUATING"}
            </span>
          </div>
        </div>

        {/* Breakdown Progress Bars */}
        {ev && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "2px" }}>
                <span>SLOPE & SAFETY</span>
                <span style={{ color: "#fff" }}>{ev.breakdown.slope_safety_score}%</span>
              </div>
              <div style={{ height: "4px", background: "rgba(15,23,42,0.9)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${ev.breakdown.slope_safety_score}%`, height: "100%", background: "var(--emerald)" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "2px" }}>
                <span>SOLAR ILLUMINATION</span>
                <span style={{ color: "#fff" }}>{ev.breakdown.solar_power_score}%</span>
              </div>
              <div style={{ height: "4px", background: "rgba(15,23,42,0.9)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${ev.breakdown.solar_power_score}%`, height: "100%", background: "var(--amber)" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "2px" }}>
                <span>EARTH DTE COMMS</span>
                <span style={{ color: "#fff" }}>{ev.breakdown.earth_comms_score}%</span>
              </div>
              <div style={{ height: "4px", background: "rgba(15,23,42,0.9)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${ev.breakdown.earth_comms_score}%`, height: "100%", background: "var(--cyan)" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginBottom: "2px" }}>
                <span>THERMAL / ALTITUDE</span>
                <span style={{ color: "#fff" }}>{ev.breakdown.thermal_score}%</span>
              </div>
              <div style={{ height: "4px", background: "rgba(15,23,42,0.9)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: `${ev.breakdown.thermal_score}%`, height: "100%", background: "var(--blue)" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ranked Candidate Landing Regions Grid */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)", marginBottom: "6px" }}>
        NASA ARTEMIS III & GLOBAL LUNAR CANDIDATE REGIONS (RANKED BY SUITABILITY):
      </div>

      {loading && !recommendations && <Loading />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px", maxHeight: "190px", overflowY: "auto", paddingRight: "4px" }}>
        {(recommendations ?? s.sites).map((rec: any) => {
          const isCurrent = s.siteId === rec.id;
          return (
            <div
              key={rec.id}
              style={{
                background: isCurrent ? "rgba(0, 240, 255, 0.08)" : "rgba(6, 12, 23, 0.75)",
                border: isCurrent ? "1px solid var(--cyan)" : "1px solid var(--line-glass)",
                borderRadius: "5px",
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "6px",
                transition: "all 0.18s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "12px", fontWeight: 700, color: "#fff" }}>
                    {rec.name}
                  </div>
                  <div style={{ fontSize: "9.5px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {rec.lat.toFixed(2)}°S, {rec.lon.toFixed(1)}°E · {rec.category ?? "Landing Candidate"}
                  </div>
                </div>
                {rec.suitability_score !== undefined && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: rec.badge_color ?? "var(--cyan)",
                      background: "rgba(4,8,16,0.8)",
                      padding: "2px 6px",
                      borderRadius: "3px",
                      border: `1px solid ${rec.badge_color ?? "var(--cyan)"}44`,
                    }}
                  >
                    {rec.suitability_score.toFixed(0)}%
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", fontSize: "9.5px", fontFamily: "var(--font-mono)", background: "rgba(3,7,15,0.6)", padding: "4px 6px", borderRadius: "3px" }}>
                <div>
                  <span style={{ color: "var(--text-dim)" }}>ELEV: </span>
                  <span style={{ color: "#fff" }}>{rec.elevation_m !== undefined ? `${rec.elevation_m >= 0 ? "+" : ""}${rec.elevation_m.toFixed(0)}m` : "–"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-dim)" }}>SLOPE: </span>
                  <span style={{ color: (rec.slope_deg ?? 0) <= 5 ? "var(--emerald)" : "var(--amber)" }}>{rec.slope_deg?.toFixed(1) ?? "–"}°</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-dim)" }}>PSR: </span>
                  <span style={{ color: "var(--cyan)" }}>{rec.psr_distance_km ? `${rec.psr_distance_km}km` : "–"}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                <span style={{ fontSize: "9px", color: rec.badge_color ?? "var(--emerald)", fontFamily: "var(--font-mono)" }}>
                  {rec.status ?? "RECOMMENDED"}
                </span>
                <button
                  className="btn-site-chip"
                  style={{
                    padding: "2px 8px",
                    fontSize: "9.5px",
                    background: isCurrent ? "var(--cyan)" : undefined,
                    color: isCurrent ? "#03060d" : "var(--cyan)",
                    fontWeight: 600,
                  }}
                  onClick={() => navigateToSite(rec)}
                >
                  {isCurrent ? "SELECTED TARGET" : "NAVIGATE SITE ➔"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

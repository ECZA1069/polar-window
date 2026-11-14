import { useEffect } from "react";
import { useSim, Site } from "./store";

export const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

export async function post(path: string, body: unknown) {
  let r: Response;
  try {
    r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Backend not reachable. Start it with: uvicorn app.main:app --port 8000");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = j.detail;
    throw new Error(typeof d === "string" ? d : d?.reason ?? `Backend error ${r.status}`);
  }
  return j;
}

export function stepMinutes(hours: number) {
  return Math.max(5, Math.ceil((hours * 60) / 400 / 5) * 5);
}

export function useBackendHealth() {
  useEffect(() => {
    let stop = false,
      timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await (await fetch("/api/health")).json();
        if (stop) return;
        useSim.getState().set({
          health: j.status === "ok" ? "ok" : "kernels_missing",
          healthMsg: (j.missing_kernels ?? []).join(", "),
        });
        if (j.status === "ok") {
          const s = await (await fetch("/api/sites")).json();
          useSim.getState().set({ sites: s.data as Site[] });
          return;
        }
      } catch {
        if (!stop) useSim.getState().set({ health: "offline" });
      }
      timer = setTimeout(tick, 4000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);
}

// Geometry & LOLA Topography for the single shared simulation timestamp.
export function useGeometry() {
  const utcMs = useSim((s) => s.utcMs),
    lat = useSim((s) => s.lat),
    lon = useSim((s) => s.lon),
    health = useSim((s) => s.health);
  useEffect(() => {
    if (health !== "ok") return;
    let dead = false;
    const t = setTimeout(async () => {
      try {
        const j = await post("/api/simulation/geometry", { utc: iso(utcMs), lat, lon });
        if (!dead)
          useSim.getState().set({
            geometry: j.data,
            geoError: null,
            notes: j.notes,
            calcMs: j.calc_ms,
          });
      } catch (e: any) {
        if (!dead) useSim.getState().set({ geometry: null, geoError: e.message });
      }
    }, 150);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [utcMs, lat, lon, health]);
}

// Timeline, power and comms for the observation window at the selected site.
export function useAnalysis() {
  const lat = useSim((s) => s.lat),
    lon = useSim((s) => s.lon),
    ws = useSim((s) => s.windowStartMs);
  const hours = useSim((s) => s.windowHours),
    panel = useSim((s) => s.panel),
    health = useSim((s) => s.health);
  useEffect(() => {
    if (health !== "ok") return;
    let dead = false;
    useSim.getState().set({ analysisLoading: true });
    const t = setTimeout(async () => {
      const body = { start_utc: iso(ws), hours, step_min: stepMinutes(hours), lat, lon, panel };
      try {
        const [tl, pw, cm] = await Promise.all([
          post("/api/simulation/timeline", body),
          post("/api/simulation/solar-power", body),
          post("/api/simulation/communication-windows", body),
        ]);
        if (!dead)
          useSim.getState().set({
            timeline: tl.data,
            power: pw.data,
            comms: cm.data,
            analysisError: null,
            analysisLoading: false,
          });
      } catch (e: any) {
        if (!dead)
          useSim.getState().set({
            timeline: null,
            power: null,
            comms: null,
            analysisError: e.message,
            analysisLoading: false,
          });
      }
    }, 350);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [lat, lon, ws, hours, panel, health]);
}

// Autonomous Landing Site Recommendations across all candidate sites
export function useLandingRecommendations() {
  const utcMs = useSim((s) => s.utcMs),
    health = useSim((s) => s.health);
  useEffect(() => {
    if (health !== "ok") return;
    let dead = false;
    useSim.getState().set({ landingLoading: true });
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/landing/recommendations?utc=${encodeURIComponent(iso(utcMs))}`);
        const j = await r.json();
        if (!dead && j.data?.recommendations) {
          useSim.getState().set({
            landingRecommendations: j.data.recommendations,
            landingLoading: false,
          });
        }
      } catch {
        if (!dead) useSim.getState().set({ landingLoading: false });
      }
    }, 300);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [utcMs, health]);
}

import { create } from "zustand";

export type Body = {
  elevation_deg: number;
  azimuth_deg: number;
  range_km: number;
  geometrically_above_horizon?: boolean;
};

export type Axis = { elevation_deg: number; azimuth_deg: number };

export type LandingEvaluation = {
  suitability_score: number;
  grade: string;
  status: string;
  badge_color: string;
  recommendation: string;
  is_recommended?: boolean;
  breakdown: {
    slope_safety_score: number;
    solar_power_score: number;
    earth_comms_score: number;
    thermal_score: number;
  };
  terrain: {
    elevation_m: number;
    slope_deg: number;
    roughness: number;
    horizon_dip_deg: number;
    atmospheric_refraction_deg: number;
    nearest_calibrated_site: string;
  };
};

export type Geometry = {
  sun_dir_moon_me: number[];
  earth_dir_moon_me: number[];
  sun: Body;
  earth: Body;
  axis: { north: Axis; south: Axis };
  sun_radius_deg: number;
  elevation_m?: number;
  slope_deg?: number;
  roughness?: number;
  horizon_dip_deg?: number;
  atmospheric_refraction_deg?: number;
  terrain_source?: string;
  nearest_site?: string;
  landing_evaluation?: LandingEvaluation;
  lola?: {
    elevation_m: number;
    slope_deg: number;
    roughness_m?: number;
    horizon_dip_deg: number;
    sun_effective_elev_deg?: number;
    terrain_horizon_elevation_deg?: number;
    psr_proximity_km?: number;
    is_psr?: boolean;
  };
};

export type Site = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region?: string;
  category?: string;
  official_landing_site: boolean;
  elevation_status: string;
  elevation_m?: number;
  slope_deg?: number;
  roughness?: number;
  sunlit_fraction?: number;
  earth_vis_fraction?: number;
  psr_distance_km?: number;
  hazard_rating?: string;
  description?: string;
};

export type Iv = {
  start_ms: number;
  end_ms: number;
  duration_h: number;
  clipped_start: boolean;
  clipped_end: boolean;
};

export type Timeline = {
  t_ms: number[];
  sun_elev_deg: number[];
  earth_elev_deg: number[];
  sunlit: Iv[];
  dark: Iv[];
  earth_visible: Iv[];
  stats: {
    sunlit_pct: number;
    longest_sunlit_h: number;
    longest_dark_h: number;
    earth_visible_pct: number;
    longest_earth_window_h: number;
    earth_window_count: number;
    span_h: number;
  };
  terrain?: {
    elevation_m: number;
    slope_deg: number;
    roughness: number;
    horizon_dip_deg: number;
  };
};

export type Power = {
  t_ms: number[];
  power_w: number[];
  battery_wh: number[];
  irradiance_w_m2: number[];
  summary: {
    energy_generated_wh: number;
    energy_load_wh: number;
    mean_power_w: number;
    peak_power_w: number;
    min_battery_pct: number | null;
    hours_load_unmet: number;
  };
  panel: PanelParams;
};

export type Comms = { windows: Iv[]; earth_visible_pct: number; longest_window_h: number };

export type PanelParams = {
  area_m2: number;
  efficiency: number;
  tilt_deg: number;
  azimuth_deg: number;
  losses_pct: number;
  battery_wh: number;
  load_w: number;
  initial_soc_pct: number;
};

export type View = "free" | "south" | "north" | "rover";
export type Health = "connecting" | "ok" | "kernels_missing" | "offline";
export type Layers = {
  texture: boolean;
  relief: boolean;
  graticule: boolean;
  terminator: boolean;
  markers: boolean;
  craters: boolean;
  indicators: boolean;
  axis: boolean;
};

export type Tab = "timeline" | "power" | "comms" | "compare" | "landing";

export type RoverSim = {
  active: boolean;
  x: number;
  z: number;
  heading: number;
  speedKmh: number;
  distanceM: number;
  pitchDeg: number;
  rollDeg: number;
  headlights: boolean;
  showReseau: boolean;
  cameraMode: "chase" | "cockpit" | "drone";
};

type State = {
  utcMs: number;
  playing: boolean;
  speed: number;
  lat: number;
  lon: number;
  siteId: string | null;
  sites: Site[];
  windowStartMs: number;
  windowHours: number;
  windowPreset: "1" | "7" | "30" | "custom";
  panel: PanelParams;
  layers: Layers;
  tab: Tab;
  health: Health;
  healthMsg: string;
  geometry: Geometry | null;
  geoError: string | null;
  notes: string[];
  calcMs: number | null;
  timeline: Timeline | null;
  power: Power | null;
  comms: Comms | null;
  analysisError: string | null;
  analysisLoading: boolean;
  landingRecommendations: any[] | null;
  landingLoading: boolean;
  view: View;
  viewNonce: number;
  fullscreen: boolean;
  toggleFullscreen: () => void;
  rover: RoverSim;
  setRover: (r: Partial<RoverSim>) => void;
  set: (p: Partial<State>) => void;
  selectSite: (id: string) => void;
  setCoords: (lat: number, lon: number) => void;
  setPanel: (p: Partial<PanelParams>) => void;
  toggleLayer: (k: keyof Layers) => void;
  setView: (v: View) => void;
};

export const useSim = create<State>((set, get) => ({
  utcMs: Date.UTC(2026, 10, 9, 0, 0, 0),
  playing: false,
  speed: 3600,
  lat: -89.44, // Shackleton Connecting Ridge default (NASA Artemis candidate)
  lon: 222.5,
  siteId: "shackleton-connecting-ridge",
  sites: [],
  windowStartMs: Date.UTC(2026, 10, 9, 0, 0, 0),
  windowHours: 168,
  windowPreset: "7",
  panel: {
    area_m2: 10,
    efficiency: 0.28,
    tilt_deg: 0,
    azimuth_deg: 0,
    losses_pct: 15,
    battery_wh: 2000,
    load_w: 100,
    initial_soc_pct: 50,
  },
  layers: {
    texture: true,
    relief: true,
    graticule: false,
    terminator: true,
    markers: true,
    craters: true,
    indicators: true,
    axis: true,
  },
  tab: "timeline",
  health: "connecting",
  healthMsg: "",
  geometry: null,
  geoError: null,
  notes: [],
  calcMs: null,
  timeline: null,
  power: null,
  comms: null,
  analysisError: null,
  analysisLoading: false,
  landingRecommendations: null,
  landingLoading: false,
  view: "south",
  viewNonce: 0,
  fullscreen: false,
  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
  rover: {
    active: false,
    x: 0,
    z: 14,
    heading: 0,
    speedKmh: 0,
    distanceM: 0,
    pitchDeg: 0,
    rollDeg: 0,
    headlights: true,
    showReseau: true,
    cameraMode: "chase",
  },
  setRover: (r) => set((s) => ({ rover: { ...s.rover, ...r } })),
  set: (p) => set(p as any),
  selectSite: (id) => {
    const s = get().sites.find((x) => x.id === id);
    if (s) set({ siteId: id, lat: s.lat, lon: s.lon });
  },
  setCoords: (lat, lon) => set({ lat, lon, siteId: null }),
  setPanel: (p) => set((s) => ({ panel: { ...s.panel, ...p } })),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1 })),
}));

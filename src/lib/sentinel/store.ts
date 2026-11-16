import { create } from "zustand";
import type {
  TrafficPoint,
  Incident,
  Anomaly,
  KPIs,
  EndpointProfile,
  ForecastResult,
  ModelName,
} from "./types";
import { computeKpis, buildEndpointProfiles } from "./kpis";
import { runIsolationForest } from "./isolation-forest";
import { runForecast } from "./forecast";
import {
  loadBundledTraffic,
  loadBundledIncidents,
  parseTrafficCsv,
  parseIncidentsCsv,
} from "./csv";

interface SentinelState {
  traffic: TrafficPoint[];
  incidents: Incident[];
  trafficSource: "bundled" | "uploaded";
  incidentsSource: "bundled" | "uploaded";
  trafficMessage: string;
  incidentsMessage: string;
  contaminationOverview: number;
  contaminationHunt: number;
  model: ModelName;
  horizon: number;
  selectedHost: string | null;
  classificationFilter: string[];
  anomaliesOverview: Anomaly[];
  anomaliesHunt: Anomaly[];
  kpis: KPIs | null;
  endpoints: Record<string, EndpointProfile>;
  forecast: ForecastResult | null;
  loading: boolean;
  ready: boolean;
  error: string | null;

  init: () => Promise<void>;
  setContaminationOverview: (v: number) => void;
  setContaminationHunt: (v: number) => void;
  setModel: (m: ModelName) => void;
  setHorizon: (h: number) => void;
  setSelectedHost: (h: string | null) => void;
  setClassificationFilter: (f: string[]) => void;
  uploadTraffic: (file: File) => Promise<void>;
  uploadIncidents: (file: File) => Promise<void>;
  recompute: () => void;
}

const ALL_CLASSIFICATIONS = [
  "Credential Spraying Spike",
  "Potential Data Exfiltration Drop",
  "C2 Beacon Anomaly",
  "DDoS Surge Pattern",
  "Multi-Vector Statistical Outlier",
];

export const useSentinelStore = create<SentinelState>((set, get) => ({
  traffic: [],
  incidents: [],
  trafficSource: "bundled",
  incidentsSource: "bundled",
  trafficMessage: "Currently showing bundled sample data",
  incidentsMessage: "Currently showing bundled sample data",
  contaminationOverview: 0.12,
  contaminationHunt: 0.12,
  model: "Holt-Winters",
  horizon: 16,
  selectedHost: null,
  classificationFilter: [...ALL_CLASSIFICATIONS],
  anomaliesOverview: [],
  anomaliesHunt: [],
  kpis: null,
  endpoints: {},
  forecast: null,
  loading: true,
  ready: false,
  error: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      const [traffic, incidents] = await Promise.all([
        loadBundledTraffic(),
        loadBundledIncidents(),
      ]);
      set({
        traffic,
        incidents,
        trafficSource: "bundled",
        incidentsSource: "bundled",
        trafficMessage: "Currently showing bundled sample data",
        incidentsMessage: "Currently showing bundled sample data",
        loading: false,
        ready: true,
      });
      get().recompute();
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load sample data",
      });
    }
  },

  setContaminationOverview: (v) => {
    set({ contaminationOverview: v });
    get().recompute();
  },
  setContaminationHunt: (v) => {
    set({ contaminationHunt: v });
    // only recompute hunt anomalies
    const { incidents } = get();
    const anomaliesHunt = runIsolationForest(incidents, v);
    set({ anomaliesHunt });
  },
  setModel: (m) => {
    set({ model: m });
    get().recompute();
  },
  setHorizon: (h) => {
    set({ horizon: h });
    get().recompute();
  },
  setSelectedHost: (h) => set({ selectedHost: h }),
  setClassificationFilter: (f) => set({ classificationFilter: f }),

  uploadTraffic: async (file) => {
    const text = await file.text();
    const result = parseTrafficCsv(text);
    if (!result.ok) {
      set({
        trafficMessage: `Error: ${result.error}. Falling back to bundled data.`,
      });
      // keep existing
      return;
    }
    set({
      traffic: result.data,
      trafficSource: "uploaded",
      trafficMessage: `Using uploaded traffic data (${result.rowCount} rows)`,
    });
    get().recompute();
  },

  uploadIncidents: async (file) => {
    const text = await file.text();
    const result = parseIncidentsCsv(text);
    if (!result.ok) {
      set({
        incidentsMessage: `Error: ${result.error}. Falling back to bundled data.`,
      });
      return;
    }
    set({
      incidents: result.data,
      incidentsSource: "uploaded",
      incidentsMessage: `Using uploaded incident data (${result.rowCount} rows)`,
    });
    get().recompute();
  },

  recompute: () => {
    const {
      traffic,
      incidents,
      contaminationOverview,
      contaminationHunt,
      model,
      horizon,
    } = get();

    if (!incidents.length && !traffic.length) {
      set({ error: "No data loaded. Please upload CSVs." });
      return;
    }

    const anomaliesOverview = runIsolationForest(
      incidents,
      contaminationOverview
    );
    const anomaliesHunt = runIsolationForest(incidents, contaminationHunt);
    const kpis = computeKpis(incidents, anomaliesOverview);
    const endpoints = buildEndpointProfiles(incidents);
    const hosts = Object.keys(endpoints).sort();
    let selectedHost = get().selectedHost;
    if (!selectedHost || !endpoints[selectedHost]) {
      selectedHost = hosts[0] || null;
    }

    let forecast: ForecastResult | null = null;
    if (traffic.length >= 10) {
      forecast = runForecast(traffic, horizon, model);
    }

    set({
      anomaliesOverview,
      anomaliesHunt,
      kpis,
      endpoints,
      selectedHost,
      forecast,
      error: null,
    });
  },
}));

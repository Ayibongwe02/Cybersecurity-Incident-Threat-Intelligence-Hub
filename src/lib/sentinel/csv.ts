import Papa from "papaparse";
import type { TrafficPoint, Incident, Severity } from "./types";

const TRAFFIC_REQUIRED = new Set(["ds", "y"]);
const INCIDENT_REQUIRED = new Set([
  "timestamp",
  "host",
  "payload_size_kb",
  "response_latency_ms",
  "failed_auth_count",
  "bytes_out_mb",
  "request_rate",
  "severity",
  "event_type",
  "source_ip",
  "destination_port",
]);

export interface ParseResult<T> {
  ok: boolean;
  data: T[];
  error?: string;
  rowCount: number;
}

function missingColumns(headers: string[], required: Set<string>): string[] {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  return [...required].filter((c) => !set.has(c.toLowerCase()));
}

export function parseTrafficCsv(text: string): ParseResult<TrafficPoint> {
  if (!text || !text.trim()) {
    return { ok: false, data: [], error: "File is empty", rowCount: 0 };
  }
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length && !parsed.data.length) {
    return {
      ok: false,
      data: [],
      error: parsed.errors[0]?.message || "Parse error",
      rowCount: 0,
    };
  }
  const headers = parsed.meta.fields || [];
  const missing = missingColumns(headers, TRAFFIC_REQUIRED);
  if (missing.length) {
    return {
      ok: false,
      data: [],
      error: `Missing required columns: ${missing.join(", ")}`,
      rowCount: 0,
    };
  }
  const data: TrafficPoint[] = [];
  for (const row of parsed.data) {
    const ds = String(row.ds || row.DS || "").trim();
    const y = Number(row.y ?? row.Y);
    if (!ds || Number.isNaN(y)) continue;
    data.push({ ds, y });
  }
  data.sort((a, b) => a.ds.localeCompare(b.ds));
  return { ok: true, data, rowCount: data.length };
}

export function parseIncidentsCsv(text: string): ParseResult<Incident> {
  if (!text || !text.trim()) {
    return { ok: false, data: [], error: "File is empty", rowCount: 0 };
  }
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length && !parsed.data.length) {
    return {
      ok: false,
      data: [],
      error: parsed.errors[0]?.message || "Parse error",
      rowCount: 0,
    };
  }
  const headers = parsed.meta.fields || [];
  const missing = missingColumns(headers, INCIDENT_REQUIRED);
  if (missing.length) {
    return {
      ok: false,
      data: [],
      error: `Missing required columns: ${missing.join(", ")}`,
      rowCount: 0,
    };
  }
  const data: Incident[] = [];
  for (const row of parsed.data) {
    const severity = String(row.severity || "").toUpperCase() as Severity;
    if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(severity)) continue;
    data.push({
      timestamp: String(row.timestamp || "").trim(),
      host: String(row.host || "").trim(),
      payload_size_kb: Number(row.payload_size_kb) || 0,
      response_latency_ms: Number(row.response_latency_ms) || 0,
      failed_auth_count: Number(row.failed_auth_count) || 0,
      bytes_out_mb: Number(row.bytes_out_mb) || 0,
      request_rate: Number(row.request_rate) || 0,
      severity,
      event_type: String(row.event_type || "").trim(),
      source_ip: String(row.source_ip || "").trim(),
      destination_port: Number(row.destination_port) || 0,
    });
  }
  data.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  return { ok: true, data, rowCount: data.length };
}

export async function loadBundledTraffic(): Promise<TrafficPoint[]> {
  const res = await fetch("/data/threat_forecast.csv");
  const text = await res.text();
  const r = parseTrafficCsv(text);
  return r.data;
}

export async function loadBundledIncidents(): Promise<Incident[]> {
  const res = await fetch("/data/live_incidents.csv");
  const text = await res.text();
  const r = parseIncidentsCsv(text);
  return r.data;
}

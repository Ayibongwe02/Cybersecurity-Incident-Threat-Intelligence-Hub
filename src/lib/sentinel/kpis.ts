import type { Incident, Anomaly, KPIs, EndpointProfile } from "./types";

export function computeKpis(incidents: Incident[], anomalies: Anomaly[]): KPIs {
  const total = incidents.length;
  const critical = incidents.filter((i) => i.severity === "CRITICAL").length;
  const highAmongAnomalies = anomalies.filter((a) => a.severity === "HIGH").length;
  const blocked = incidents
    .filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH")
    .reduce((s, i) => s + i.payload_size_kb, 0);
  const active_mitigations = critical * 3 + highAmongAnomalies;
  const spi = Math.max(
    0,
    Math.min(100, 100 - (critical / Math.max(total, 1)) * 80 - anomalies.length * 0.6)
  );
  const anomaly_rate = Math.round((anomalies.length / Math.max(total, 1)) * 10000) / 100;
  return {
    spi: Math.round(spi * 10) / 10,
    blocked_payloads: Math.round(blocked),
    active_mitigations,
    anomaly_rate,
    total_events: total,
    critical_events: critical,
    anomaly_count: anomalies.length,
  };
}

export function buildEndpointProfiles(incidents: Incident[]): Record<string, EndpointProfile> {
  const byHost = new Map<string, Incident[]>();
  for (const inc of incidents) {
    if (!byHost.has(inc.host)) byHost.set(inc.host, []);
    byHost.get(inc.host)!.push(inc);
  }
  const profiles: Record<string, EndpointProfile> = {};
  for (const [host, grp] of byHost) {
    const sorted = [...grp].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const critical = sorted.filter((i) => i.severity === "CRITICAL").length;
    const high = sorted.filter((i) => i.severity === "HIGH").length;
    const risk = Math.min(99, critical * 22 + high * 12 + sorted.length * 2);
    profiles[host] = {
      risk_score: risk,
      status: risk > 70 ? "CRITICAL" : risk > 40 ? "WARNING" : "NOMINAL",
      total_events: sorted.length,
      critical_events: critical,
      high_events: high,
      data: sorted,
    };
  }
  return profiles;
}

export function classifyAnomaly(row: {
  failed_auth_count: number;
  payload_size_kb: number;
  bytes_out_mb: number;
  response_latency_ms: number;
  request_rate: number;
}): string {
  if (row.failed_auth_count > 20) return "Credential Spraying Spike";
  if (row.payload_size_kb > 10000 && row.bytes_out_mb > 1000)
    return "Potential Data Exfiltration Drop";
  if (row.response_latency_ms > 3000 && row.payload_size_kb > 5000)
    return "C2 Beacon Anomaly";
  if (row.request_rate > 800) return "DDoS Surge Pattern";
  return "Multi-Vector Statistical Outlier";
}

export function riskScore(
  severity: string,
  anomalyScore: number
): number {
  const s = Math.abs(anomalyScore);
  if (severity === "CRITICAL") return Math.min(99, Math.floor(s * 180 + 70));
  if (severity === "HIGH") return Math.min(85, Math.floor(s * 140 + 50));
  return Math.min(65, Math.floor(s * 100 + 30));
}

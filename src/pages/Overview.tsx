import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useSentinelStore } from "../lib/sentinel/store";

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#D9534F",
  HIGH: "#E29578",
  MEDIUM: "#6E8E75",
  LOW: "#8A8474",
};

export function OverviewPage() {
  const kpis = useSentinelStore((s) => s.kpis);
  const incidents = useSentinelStore((s) => s.incidents);
  const contamination = useSentinelStore((s) => s.contaminationOverview);
  const setContamination = useSentinelStore((s) => s.setContaminationOverview);

  if (!incidents.length) {
    return <div className="empty-state">No incident data loaded yet.</div>;
  }

  const sevCounts = SEV_ORDER.map((sev) => ({
    name: sev,
    count: incidents.filter((i) => i.severity === sev).length,
  }));

  const hostAgg = Object.entries(
    incidents.reduce(
      (acc, i) => {
        if (!acc[i.host]) acc[i.host] = { payload: 0, bytes: 0, events: 0 };
        acc[i.host].payload += i.payload_size_kb;
        acc[i.host].bytes += i.bytes_out_mb;
        acc[i.host].events += 1;
        return acc;
      },
      {} as Record<string, { payload: number; bytes: number; events: number }>
    )
  )
    .map(([host, v]) => ({
      host,
      payload: Math.round(v.payload * 10) / 10,
      bytes: Math.round(v.bytes * 10) / 10,
      events: v.events,
    }))
    .sort((a, b) => b.payload - a.payload);

  return (
    <div>
      <h2 className="page-title">Security Posture Overview</h2>
      <p className="page-caption">
        Live KPIs computed from current incident data and anomaly detection.
      </p>

      <div className="slider-row">
        <label>
          Sensitivity (contamination): {contamination.toFixed(2)}
        </label>
        <input
          type="range"
          min={0.05}
          max={0.3}
          step={0.01}
          value={contamination}
          onChange={(e) => setContamination(Number(e.target.value))}
        />
      </div>

      {kpis && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="label">Security Posture Index</div>
            <div className="value">{kpis.spi}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Blocked Payload Volume (KB)</div>
            <div className="value">
              {kpis.blocked_payloads.toLocaleString()}
            </div>
          </div>
          <div className="kpi-card">
            <div className="label">Active Mitigations</div>
            <div className="value">{kpis.active_mitigations}</div>
          </div>
          <div className="kpi-card">
            <div className="label">Anomaly Rate</div>
            <div className="value">{kpis.anomaly_rate}%</div>
          </div>
        </div>
      )}

      <div className="section-heading">Incident Volume by Severity</div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sevCounts}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {sevCounts.map((e) => (
                <Cell key={e.name} fill={SEV_COLORS[e.name]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-heading">Traffic Volume by Host</div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={hostAgg} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="host" tick={{ fontSize: 10 }} width={100} />
            <Tooltip />
            <Bar dataKey="payload" fill="#D9534F" name="Payload KB" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <table className="data-table" style={{ marginTop: "0.75rem" }}>
          <thead>
            <tr>
              <th>Host</th>
              <th>Total Payload KB</th>
              <th>Total Bytes Out MB</th>
              <th>Events</th>
            </tr>
          </thead>
          <tbody>
            {hostAgg.map((h) => (
              <tr key={h.host}>
                <td>{h.host}</td>
                <td>{h.payload.toLocaleString()}</td>
                <td>{h.bytes.toLocaleString()}</td>
                <td>{h.events}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

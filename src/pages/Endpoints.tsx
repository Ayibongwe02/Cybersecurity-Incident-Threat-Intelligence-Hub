import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useSentinelStore } from "../lib/sentinel/store";

export function EndpointsPage() {
  const endpoints = useSentinelStore((s) => s.endpoints);
  const selectedHost = useSentinelStore((s) => s.selectedHost);
  const setSelectedHost = useSentinelStore((s) => s.setSelectedHost);

  const hosts = Object.keys(endpoints).sort();
  const profile = selectedHost ? endpoints[selectedHost] : null;

  if (!hosts.length) {
    return <div className="empty-state">No incident data loaded yet.</div>;
  }

  const chartData =
    profile?.data.map((e) => ({
      t: e.timestamp.slice(0, 16),
      payload: e.payload_size_kb,
      latency: e.response_latency_ms,
    })) || [];

  const recent = profile
    ? [...profile.data].reverse().slice(0, 15)
    : [];

  return (
    <div>
      <h2 className="page-title">Endpoints</h2>
      <p className="page-caption">Per-host risk profile and event timeline.</p>

      <div className="slider-row">
        <label>Host</label>
        <select
          value={selectedHost || ""}
          onChange={(e) => setSelectedHost(e.target.value)}
        >
          {hosts.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      {profile && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="label">Risk Score</div>
              <div className="value">{profile.risk_score}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Status</div>
              <div className="value">
                <span className={`sev-badge sev-${profile.status === "NOMINAL" ? "LOW" : profile.status === "WARNING" ? "HIGH" : "CRITICAL"}`}>
                  {profile.status}
                </span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="label">Total Events</div>
              <div className="value">{profile.total_events}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Critical Events</div>
              <div className="value">{profile.critical_events}</div>
            </div>
          </div>

          <div className="section-heading">Payload & Latency</div>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <XAxis dataKey="t" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="payload"
                  stroke="#D9534F"
                  strokeWidth={2}
                  dot={false}
                  name="Payload (KB)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="latency"
                  stroke="#6E8E75"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  name="Latency (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="section-heading">Recent Events (15)</div>
          <div className="chart-card" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Source IP</th>
                  <th>Port</th>
                  <th>Failed Auth</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e, i) => (
                  <tr key={i}>
                    <td>{e.timestamp}</td>
                    <td>{e.event_type}</td>
                    <td>
                      <span className={`sev-badge sev-${e.severity}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td>{e.source_ip}</td>
                    <td>{e.destination_port}</td>
                    <td>{e.failed_auth_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

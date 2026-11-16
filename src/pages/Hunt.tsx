import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useSentinelStore } from "../lib/sentinel/store";

export function HuntPage() {
  const incidents = useSentinelStore((s) => s.incidents);
  const anomalies = useSentinelStore((s) => s.anomaliesHunt);
  const contamination = useSentinelStore((s) => s.contaminationHunt);
  const setContamination = useSentinelStore((s) => s.setContaminationHunt);
  const filter = useSentinelStore((s) => s.classificationFilter);
  const setFilter = useSentinelStore((s) => s.setClassificationFilter);

  if (incidents.length < 10) {
    return (
      <div className="empty-state">
        Not enough incident data… Need at least 10 rows.
      </div>
    );
  }

  const filtered = anomalies.filter((a) =>
    filter.includes(a.classification)
  );

  const classCounts = Object.entries(
    anomalies.reduce(
      (acc, a) => {
        acc[a.classification] = (acc[a.classification] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  ).map(([name, count]) => ({ name, count }));

  const criticalCount = anomalies.filter((a) => a.severity === "CRITICAL").length;
  const avgRisk =
    anomalies.length > 0
      ? Math.round(
          anomalies.reduce((s, a) => s + a.risk_score, 0) / anomalies.length
        )
      : null;

  const allClasses = [
    "Credential Spraying Spike",
    "Potential Data Exfiltration Drop",
    "C2 Beacon Anomaly",
    "DDoS Surge Pattern",
    "Multi-Vector Statistical Outlier",
  ];

  return (
    <div>
      <h2 className="page-title">Threat Hunting</h2>
      <p className="page-caption">
        Isolation Forest anomaly detection with rule-based classification.
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

      <div className="slider-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <label>Classification filter:</label>
        {allClasses.map((c) => (
          <label key={c} style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input
              type="checkbox"
              checked={filter.includes(c)}
              onChange={(e) => {
                if (e.target.checked) setFilter([...filter, c]);
                else setFilter(filter.filter((x) => x !== c));
              }}
            />
            {c.split(" ").slice(0, 2).join(" ")}
          </label>
        ))}
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Anomalies Detected</div>
          <div className="value">{anomalies.length || "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Critical Severity</div>
          <div className="value">{criticalCount || "—"}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Avg Risk Score</div>
          <div className="value">{avgRisk ?? "—"}</div>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="empty-state">
          No anomalies detected at this sensitivity level.
        </div>
      ) : (
        <>
          <div className="section-heading">Classification Counts</div>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={classCounts}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#D9534F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="section-heading">Anomaly Log</div>
          <div className="chart-card" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Host</th>
                  <th>Classification</th>
                  <th>Severity</th>
                  <th>Risk</th>
                  <th>Payload KB</th>
                  <th>Latency</th>
                  <th>Failed Auth</th>
                  <th>Bytes Out</th>
                  <th>Source IP</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={i}>
                    <td>{a.timestamp}</td>
                    <td>{a.host}</td>
                    <td>{a.classification}</td>
                    <td>
                      <span className={`sev-badge sev-${a.severity}`}>
                        {a.severity}
                      </span>
                    </td>
                    <td>{a.risk_score}</td>
                    <td>{a.payload_size_kb}</td>
                    <td>{a.response_latency_ms}</td>
                    <td>{a.failed_auth_count}</td>
                    <td>{a.bytes_out_mb}</td>
                    <td>{a.source_ip}</td>
                    <td>{a.event_type}</td>
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

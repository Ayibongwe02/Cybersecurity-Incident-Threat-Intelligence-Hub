import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useSentinelStore } from "../lib/sentinel/store";
import type { ModelName } from "../lib/sentinel/types";

export function PredictivePage() {
  const traffic = useSentinelStore((s) => s.traffic);
  const forecast = useSentinelStore((s) => s.forecast);
  const model = useSentinelStore((s) => s.model);
  const horizon = useSentinelStore((s) => s.horizon);
  const setModel = useSentinelStore((s) => s.setModel);
  const setHorizon = useSentinelStore((s) => s.setHorizon);

  if (traffic.length < 10) {
    return (
      <div className="empty-state">
        Need at least 10 traffic rows. Upload a ds, y CSV.
      </div>
    );
  }

  const actual = traffic.map((t) => ({
    date: t.ds,
    actual: Math.round(t.y),
  }));

  const fcPoints =
    forecast?.dates.map((d, i) => ({
      date: d,
      forecast: forecast.forecast[i],
      upper: forecast.upper[i],
      lower: forecast.lower[i],
    })) || [];

  // merge for chart (actual then forecast)
  const chartData = [
    ...actual.map((a) => ({ ...a, forecast: undefined, upper: undefined, lower: undefined })),
    ...fcPoints.map((f) => ({ ...f, actual: undefined })),
  ];

  return (
    <div>
      <h2 className="page-title">Predictive Engine</h2>
      <p className="page-caption">
        Volumetric forecast with backtest metrics and 95% confidence band.
      </p>

      <div className="slider-row">
        <label>Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelName)}
        >
          <option value="Holt-Winters">Holt-Winters</option>
          <option value="ARIMA">ARIMA</option>
        </select>
        <label>Horizon (weeks): {horizon}</label>
        <input
          type="range"
          min={4}
          max={24}
          step={1}
          value={horizon}
          onChange={(e) => setHorizon(Number(e.target.value))}
        />
      </div>

      {forecast && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="label">Backtest RMSE</div>
              <div className="value">{forecast.metrics.rmse.toLocaleString()}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Backtest MAPE</div>
              <div className="value">{forecast.metrics.mape}%</div>
            </div>
          </div>

          <div className="section-heading">Forecast</div>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="rgba(217,83,79,0.12)"
                  name="95% CI"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="#F9F6F0"
                  name=""
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#1A1D20"
                  strokeWidth={2}
                  dot={false}
                  name="Actual"
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#D9534F"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="Forecast"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <details>
            <summary className="section-heading" style={{ cursor: "pointer" }}>
              View forecast table
            </summary>
            <div className="chart-card" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Forecast</th>
                    <th>Lower 95</th>
                    <th>Upper 95</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.dates.map((d, i) => (
                    <tr key={d}>
                      <td>{d}</td>
                      <td>{forecast.forecast[i].toLocaleString()}</td>
                      <td>{forecast.lower[i].toLocaleString()}</td>
                      <td>{forecast.upper[i].toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Crosshair, LayoutDashboard, LineChart, Server, Upload } from "lucide-react";
import { useSentinelStore } from "./lib/sentinel/store";
import { OverviewPage } from "./pages/Overview";
import { EndpointsPage } from "./pages/Endpoints";
import { PredictivePage } from "./pages/Predictive";
import { HuntPage } from "./pages/Hunt";
import "./styles.css";

type Page = "overview" | "endpoints" | "predictive" | "hunt";

const PAGES: {
  id: Page;
  label: string;
  hint: string;
  tlp: "AMBER" | "GREEN" | "RED";
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", label: "Overview", hint: "Posture", tlp: "AMBER", icon: LayoutDashboard },
  { id: "endpoints", label: "Endpoints", hint: "Hosts", tlp: "AMBER", icon: Server },
  { id: "predictive", label: "Forecast", hint: "Engine", tlp: "GREEN", icon: LineChart },
  { id: "hunt", label: "Hunt", hint: "Anomalies", tlp: "RED", icon: Crosshair },
];

const TLP_TEXT = {
  RED: "Not for disclosure — restricted to named recipients",
  AMBER: "Limited disclosure — internal use only",
  GREEN: "Community disclosure — sector peers",
};

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const init = useSentinelStore((s) => s.init);
  const loading = useSentinelStore((s) => s.loading);
  const ready = useSentinelStore((s) => s.ready);
  const trafficMessage = useSentinelStore((s) => s.trafficMessage);
  const incidentsMessage = useSentinelStore((s) => s.incidentsMessage);
  const uploadTraffic = useSentinelStore((s) => s.uploadTraffic);
  const uploadIncidents = useSentinelStore((s) => s.uploadIncidents);

  useEffect(() => {
    init();
  }, [init]);

  const current = PAGES.find((p) => p.id === page)!;

  if (loading) {
    return (
      <div className="boot-screen">
        Initialising sensors…
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-row">
            <span className="brand-mark">CS</span>
            <div>
              <p className="brand-title">Cyber Sentinel</p>
              <p className="brand-sub">Threat intelligence</p>
            </div>
          </div>
          <button
            type="button"
            className="sources-btn"
            onClick={() => setSourcesOpen((v) => !v)}
          >
            <Upload size={16} aria-hidden />
            Sources
          </button>
        </div>
        {sourcesOpen && (
          <div className="sources-panel">
            <div className="sources-grid">
              <label className="upload-block">
                <span>Traffic CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadTraffic(f);
                  }}
                />
                <span className={"msg " + (trafficMessage.startsWith("Error") ? "error" : "ok")}>
                  {trafficMessage}
                </span>
              </label>
              <label className="upload-block">
                <span>Incidents CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadIncidents(f);
                  }}
                />
                <span className={"msg " + (incidentsMessage.startsWith("Error") ? "error" : "ok")}>
                  {incidentsMessage}
                </span>
              </label>
              <p className="sources-help">
                Traffic needs <code>ds</code>, <code>y</code>. Incidents need timestamp, host,
                payload_size_kb, response_latency_ms, failed_auth_count, bytes_out_mb, request_rate,
                severity, event_type, source_ip, destination_port. Uploads stay session-only.
              </p>
            </div>
          </div>
        )}
      </header>

      <nav className="tab-rail" aria-label="Pages">
        <div className="tab-rail-inner">
          {PAGES.map((p) => {
            const Icon = p.icon;
            const active = page === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={"tab-pill" + (active ? " active" : "")}
                onClick={() => setPage(p.id)}
              >
                <Icon size={16} aria-hidden />
                <span className="tab-label">{p.label}</span>
                <span className="tab-hint">{p.hint}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="main">
        <p className={`tlp-banner ${current.tlp}`}>
          TLP:{current.tlp} — {TLP_TEXT[current.tlp]}
        </p>
        {ready && page === "overview" && <OverviewPage />}
        {ready && page === "endpoints" && <EndpointsPage />}
        {ready && page === "predictive" && <PredictivePage />}
        {ready && page === "hunt" && <HuntPage />}
      </main>
    </div>
  );
}

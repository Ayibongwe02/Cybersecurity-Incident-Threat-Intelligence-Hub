export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface TrafficPoint {
  ds: string; // ISO date
  y: number;
}

export interface Incident {
  timestamp: string;
  host: string;
  payload_size_kb: number;
  response_latency_ms: number;
  failed_auth_count: number;
  bytes_out_mb: number;
  request_rate: number;
  severity: Severity;
  event_type: string;
  source_ip: string;
  destination_port: number;
}

export interface Anomaly extends Incident {
  anomaly_score: number;
  is_anomaly: boolean;
  classification: string;
  risk_score: number;
}

export interface EndpointProfile {
  risk_score: number;
  status: "CRITICAL" | "WARNING" | "NOMINAL";
  total_events: number;
  critical_events: number;
  high_events: number;
  data: Incident[];
}

export interface KPIs {
  spi: number;
  blocked_payloads: number;
  active_mitigations: number;
  anomaly_rate: number;
  total_events: number;
  critical_events: number;
  anomaly_count: number;
}

export interface ForecastResult {
  dates: string[];
  forecast: number[];
  upper: number[];
  lower: number[];
  metrics: { rmse: number; mape: number };
}

export type ModelName = "Holt-Winters" | "ARIMA";
export type TLPLevel = "RED" | "AMBER" | "GREEN";

# Cyber Sentinel

Threat intelligence dashboard (React + TypeScript + Vite).

## Features

- **Overview** — Security Posture Index, KPIs, severity & host charts
- **Endpoints** — Per-host risk, payload/latency timeline, event log
- **Forecast** — Holt-Winters / ARIMA with backtest and 95% band
- **Hunt** — Isolation Forest anomalies with rule classification

No accounts. No database. CSV-in / compute-out (session-only uploads).

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Docker

```bash
docker build -t cyber-sentinel .
docker run -p 10000:10000 cyber-sentinel
```

## Data

Bundled samples live in `public/data/`. Replace them from the **Sources** control in the header.

## Analytics notes

- KPI, classification, endpoint risk, and risk-score formulas match the original Streamlit app.
- Holt-Winters, ARIMA, and Isolation Forest are pure TypeScript approximations of statsmodels / scikit-learn.

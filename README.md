# Cyber Sentinel

Threat intelligence dashboard — React 19 + TypeScript + Vite.

Four views: Overview, Endpoints, Forecast, Hunt. No accounts, no database.
Bundled sample CSVs load at start; optional uploads stay session-only.

## Local development

```bash
npm install
npm run dev
```

## Production build (local)

```bash
npm run build
npm start
# serves dist/ on port 10000 (or $PORT)
```

## Docker

```bash
docker build -t cyber-sentinel .
docker run --rm -p 10000:10000 cyber-sentinel
```

Or:

```bash
docker compose up --build
```

Open http://localhost:10000 — health check path is `/`.

## Deploy to Render (free tier)

1. Push this repo to GitHub/GitLab.
2. In [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
   and connect the repo (uses `render.yaml`), **or** create a **Web Service** manually:

   | Setting | Value |
   |---|---|
   | Runtime | **Docker** |
   | Region | Frankfurt (or closest to users) |
   | Instance | Free |
   | Dockerfile path | `./Dockerfile` |
   | Health check path | `/` |

3. No secrets or database are required. Render injects `PORT`; the container
   already binds `0.0.0.0:$PORT`.

4. After the first deploy, the public URL is on the service page. Free instances
   sleep after idle time — the first request after sleep is slow.

### Blueprint file

`render.yaml` is included. Connecting the repo as a Blueprint creates the web
service with the settings above.

## Project layout

```
public/data/          sample CSVs
src/lib/sentinel/     analytics + store
src/pages/            Overview, Endpoints, Predictive, Hunt
Dockerfile            multi-stage Node 22 + serve
render.yaml           Render Blueprint
docker-compose.yml    local container run
```

## Analytics notes

KPI, classification, and risk formulas match the original Streamlit app.
Holt-Winters, ARIMA, and Isolation Forest are pure TypeScript approximations.

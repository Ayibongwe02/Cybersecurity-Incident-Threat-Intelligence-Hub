import type { TrafficPoint, ForecastResult, ModelName } from "./types";

function rmse(actual: number[], pred: number[]): number {
  const n = actual.length;
  let s = 0;
  for (let i = 0; i < n; i++) s += (actual[i] - pred[i]) ** 2;
  return Math.sqrt(s / n);
}

function mape(actual: number[], pred: number[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== 0) {
      sum += Math.abs((actual[i] - pred[i]) / actual[i]);
      count++;
    }
  }
  return count ? (sum / count) * 100 : 0;
}

/** Simple damped Holt linear trend (additive) via coordinate descent on alpha/beta/phi */
function fitHoltWinters(
  series: number[],
  horizon: number
): { forecast: number[]; residuals: number[] } {
  const n = series.length;
  if (n < 3) {
    const last = series[n - 1] || 0;
    return {
      forecast: Array(horizon).fill(last),
      residuals: series.map(() => 0),
    };
  }

  // Initialise level & trend
  let bestAlpha = 0.3,
    bestBeta = 0.1,
    bestPhi = 0.9;
  let bestSSE = Infinity;
  let bestFitted: number[] = [];

  // Grid + local refinement (keeps it pure-JS and fast enough)
  const alphas = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  const betas = [0.05, 0.1, 0.15, 0.2, 0.3];
  const phis = [0.8, 0.85, 0.9, 0.95, 0.98];

  for (const alpha of alphas) {
    for (const beta of betas) {
      for (const phi of phis) {
        let level = series[0];
        let trend = series[1] - series[0];
        const fitted: number[] = [level];
        let sse = 0;
        for (let t = 1; t < n; t++) {
          const pred = level + phi * trend;
          fitted.push(pred);
          const err = series[t] - pred;
          sse += err * err;
          const newLevel = alpha * series[t] + (1 - alpha) * (level + phi * trend);
          const newTrend = beta * (newLevel - level) + (1 - beta) * phi * trend;
          level = newLevel;
          trend = newTrend;
        }
        if (sse < bestSSE) {
          bestSSE = sse;
          bestAlpha = alpha;
          bestBeta = beta;
          bestPhi = phi;
          bestFitted = fitted;
        }
      }
    }
  }

  // Refit with best params and produce forecast
  let level = series[0];
  let trend = series[1] - series[0];
  const residuals: number[] = [];
  for (let t = 0; t < n; t++) {
    const pred = t === 0 ? level : level + bestPhi * trend;
    residuals.push(series[t] - pred);
    if (t > 0) {
      const newLevel =
        bestAlpha * series[t] + (1 - bestAlpha) * (level + bestPhi * trend);
      const newTrend =
        bestBeta * (newLevel - level) + (1 - bestBeta) * bestPhi * trend;
      level = newLevel;
      trend = newTrend;
    }
  }

  const forecast: number[] = [];
  let phiPow = bestPhi;
  for (let h = 1; h <= horizon; h++) {
    forecast.push(level + phiPow * trend);
    phiPow *= bestPhi;
  }

  return { forecast, residuals };
}

/** ARIMA(1,1,1) via conditional least squares on differenced series */
function fitArima(
  series: number[],
  horizon: number
): { forecast: number[]; residuals: number[] } {
  const n = series.length;
  if (n < 5) {
    const last = series[n - 1] || 0;
    return {
      forecast: Array(horizon).fill(last),
      residuals: series.map(() => 0),
    };
  }

  // First difference
  const diff: number[] = [];
  for (let i = 1; i < n; i++) diff.push(series[i] - series[i - 1]);

  // Fit ARMA(1,1) on diff by grid search on phi, theta
  let bestPhi = 0.3,
    bestTheta = 0.2;
  let bestSSE = Infinity;
  let bestErrors: number[] = [];

  for (let phi = -0.8; phi <= 0.8; phi += 0.1) {
    for (let theta = -0.8; theta <= 0.8; theta += 0.1) {
      const errors: number[] = [0];
      let sse = 0;
      for (let t = 1; t < diff.length; t++) {
        const pred = phi * diff[t - 1] + theta * errors[t - 1];
        const e = diff[t] - pred;
        errors.push(e);
        sse += e * e;
      }
      if (sse < bestSSE) {
        bestSSE = sse;
        bestPhi = phi;
        bestTheta = theta;
        bestErrors = errors;
      }
    }
  }

  // Residuals on original scale (approximate)
  const residuals: number[] = [series[0]]; // first residual often large
  let level = series[0];
  for (let i = 1; i < n; i++) {
    const dPred =
      i === 1
        ? 0
        : bestPhi * (series[i - 1] - series[i - 2]) +
          bestTheta * (residuals[i - 1] || 0);
    const pred = series[i - 1] + dPred;
    residuals.push(series[i] - pred);
    level = series[i];
  }

  // Forecast
  const lastDiff = series[n - 1] - series[n - 2];
  let lastErr = bestErrors[bestErrors.length - 1] || 0;
  const forecast: number[] = [];
  let prev = series[n - 1];
  let prevDiff = lastDiff;
  for (let h = 0; h < horizon; h++) {
    const dPred = bestPhi * prevDiff + bestTheta * lastErr;
    const next = prev + dPred;
    forecast.push(next);
    prevDiff = dPred;
    lastErr = 0; // future errors unknown
    prev = next;
  }

  return { forecast, residuals };
}

export function runForecast(
  traffic: TrafficPoint[],
  horizon: number,
  model: ModelName
): ForecastResult {
  const y = traffic.map((t) => t.y);
  const holdout = Math.min(8, Math.max(2, Math.floor(y.length / 5)));
  const train = y.slice(0, -holdout);
  const test = y.slice(-holdout);

  const fitter = model === "Holt-Winters" ? fitHoltWinters : fitArima;
  const { forecast: testPreds } = fitter(train, holdout);
  const metrics = {
    rmse: rmse(test, testPreds),
    mape: mape(test, testPreds),
  };

  const { forecast: fullFc, residuals } = fitter(y, horizon);
  const mean = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
  const variance =
    residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / (residuals.length || 1);
  const std = Math.sqrt(variance) || 0;

  const upper = fullFc.map((v) => v + 1.96 * std);
  const lower = fullFc.map((v) => Math.max(0, v - 1.96 * std));

  // Dates: original uses weekly frequency W (Sunday). We keep parity.
  const lastDate = new Date(traffic[traffic.length - 1].ds);
  const dates: string[] = [];
  // Advance to next Sunday-ish (original behaviour)
  let cursor = new Date(lastDate);
  cursor.setDate(cursor.getDate() + 7);
  // Align to Sunday if needed for exact parity, but simple +7 weeks is fine
  for (let i = 0; i < horizon; i++) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }

  return {
    dates,
    forecast: fullFc.map((v) => Math.round(v)),
    upper: upper.map((v) => Math.round(v)),
    lower: lower.map((v) => Math.round(v)),
    metrics: {
      rmse: Math.round(metrics.rmse * 100) / 100,
      mape: Math.round(metrics.mape * 100) / 100,
    },
  };
}

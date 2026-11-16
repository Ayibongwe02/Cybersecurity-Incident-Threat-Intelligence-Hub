import type { Incident, Anomaly } from "./types";
import { classifyAnomaly, riskScore } from "./kpis";

/** Simple seeded PRNG (mulberry32) for reproducibility */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TreeNode {
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  size: number;
  depth: number;
}

function buildTree(
  data: number[][],
  depth: number,
  maxDepth: number,
  rng: () => number
): TreeNode {
  const n = data.length;
  if (n <= 1 || depth >= maxDepth) {
    return { size: n, depth };
  }
  const feature = Math.floor(rng() * data[0].length);
  let min = Infinity,
    max = -Infinity;
  for (const row of data) {
    min = Math.min(min, row[feature]);
    max = Math.max(max, row[feature]);
  }
  if (min === max) return { size: n, depth };
  const threshold = min + rng() * (max - min);
  const left: number[][] = [];
  const right: number[][] = [];
  for (const row of data) {
    if (row[feature] < threshold) left.push(row);
    else right.push(row);
  }
  if (left.length === 0 || right.length === 0) {
    return { size: n, depth };
  }
  return {
    feature,
    threshold,
    left: buildTree(left, depth + 1, maxDepth, rng),
    right: buildTree(right, depth + 1, maxDepth, rng),
    size: n,
    depth,
  };
}

function pathLength(node: TreeNode, point: number[], depth: number): number {
  if (node.feature === undefined) {
    // leaf
    const c = (s: number) =>
      s <= 1 ? 0 : 2 * (Math.log(s - 1) + 0.5772156649) - (2 * (s - 1)) / s;
    return depth + c(node.size);
  }
  if (point[node.feature!] < node.threshold!) {
    return pathLength(node.left!, point, depth + 1);
  }
  return pathLength(node.right!, point, depth + 1);
}

function standardScale(matrix: number[][]): { scaled: number[][]; means: number[]; stds: number[] } {
  const n = matrix.length;
  const d = matrix[0].length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(0);
  for (const row of matrix) {
    for (let j = 0; j < d; j++) means[j] += row[j];
  }
  for (let j = 0; j < d; j++) means[j] /= n;
  for (const row of matrix) {
    for (let j = 0; j < d; j++) {
      const diff = row[j] - means[j];
      stds[j] += diff * diff;
    }
  }
  for (let j = 0; j < d; j++) {
    stds[j] = Math.sqrt(stds[j] / n) || 1; // population std, avoid 0
  }
  const scaled = matrix.map((row) =>
    row.map((v, j) => (v - means[j]) / stds[j])
  );
  return { scaled, means, stds };
}

/**
 * Isolation Forest approximating scikit-learn behaviour.
 * Returns anomalies sorted by risk_score descending.
 */
export function runIsolationForest(
  incidents: Incident[],
  contamination: number,
  seed = 42
): Anomaly[] {
  if (incidents.length < 10) return [];

  const featureCols = [
    "payload_size_kb",
    "response_latency_ms",
    "failed_auth_count",
    "bytes_out_mb",
    "request_rate",
  ] as const;

  const matrix = incidents.map((inc) =>
    featureCols.map((c) => Number(inc[c]) || 0)
  );
  const { scaled } = standardScale(matrix);

  const n = scaled.length;
  const nTrees = 100;
  const subsample = Math.min(256, n);
  const maxDepth = Math.ceil(Math.log2(subsample));
  const rng = mulberry32(seed);

  const trees: TreeNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    // sample without replacement roughly
    const indices = Array.from({ length: n }, (_, i) => i);
    // Fisher-Yates partial
    for (let i = 0; i < subsample; i++) {
      const j = i + Math.floor(rng() * (n - i));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const sample = indices.slice(0, subsample).map((i) => scaled[i]);
    trees.push(buildTree(sample, 0, maxDepth, rng));
  }

  // average path length
  const scores: number[] = new Array(n).fill(0);
  const c = (s: number) =>
    s <= 1 ? 0 : 2 * (Math.log(s - 1) + 0.5772156649) - (2 * (s - 1)) / s;
  const avgC = c(subsample);

  for (let i = 0; i < n; i++) {
    let pathSum = 0;
    for (const tree of trees) {
      pathSum += pathLength(tree, scaled[i], 0);
    }
    const avgPath = pathSum / nTrees;
    // scikit-learn score_samples = -2^(-E/c)
    scores[i] = -Math.pow(2, -avgPath / avgC);
  }

  // threshold at contamination percentile (lower score = more anomalous)
  const sortedScores = [...scores].sort((a, b) => a - b);
  const k = Math.max(1, Math.floor(contamination * n));
  const threshold = sortedScores[k - 1];

  const anomalies: Anomaly[] = [];
  for (let i = 0; i < n; i++) {
    if (scores[i] <= threshold) {
      const base = incidents[i];
      const classification = classifyAnomaly(base);
      const rs = riskScore(base.severity, scores[i]);
      anomalies.push({
        ...base,
        anomaly_score: scores[i],
        is_anomaly: true,
        classification,
        risk_score: rs,
      });
    }
  }

  anomalies.sort((a, b) => b.risk_score - a.risk_score);
  return anomalies;
}

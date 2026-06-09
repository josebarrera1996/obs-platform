// ── Correlation Analysis ──
// Analyzes correlations between multiple time series (services/metrics).
// Useful for: detecting cascading failures, identifying dependencies,
// finding related services.

export interface CorrelationResult {
  serviceA: string;
  serviceB: string;
  correlation: number; // -1 to 1
  strength: "strong_positive" | "moderate_positive" | "weak" | "moderate_negative" | "strong_negative";
  lag: number; // optimal lag for alignment (in data points)
  pValue: number; // approximate significance (0-1, lower = more significant)
}

export interface CorrelationMatrix {
  services: string[];
  matrix: number[][]; // NxN correlation matrix
  pairs: CorrelationResult[];
  timestamp: string;
}

/**
 * Calculate Pearson correlation between two arrays
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const meanX = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanY = y.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Find optimal lag that maximizes correlation between two series
 * Returns the signed correlation at the optimal lag (preserves direction)
 */
export function findOptimalLag(
  x: number[],
  y: number[],
  maxLag: number = 12
): { lag: number; correlation: number } {
  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let corr: number;

    if (lag >= 0) {
      corr = pearsonCorrelation(x.slice(lag), y);
    } else {
      corr = pearsonCorrelation(x, y.slice(-lag));
    }

    // Compare by absolute value, but preserve sign
    // When correlation is nearly identical (within 0.01), prefer non-negative lag
    const absCorr = Math.abs(corr);
    const absBest = Math.abs(bestCorr);
    if (absCorr > absBest + 0.01 || (Math.abs(absCorr - absBest) <= 0.01 && lag >= 0 && bestLag < 0)) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return { lag: bestLag, correlation: bestCorr };
}

/**
 * Categorize correlation strength
 */
function categorizeCorrelation(r: number): CorrelationResult["strength"] {
  const abs = Math.abs(r);
  if (abs >= 0.7) return r > 0 ? "strong_positive" : "strong_negative";
  if (abs >= 0.4) return r > 0 ? "moderate_positive" : "moderate_negative";
  return "weak";
}

/**
 * Calculate approximate p-value for correlation
 * Uses Student's t-distribution approximation
 */
function approximatePValue(r: number, n: number): number {
  if (n < 3) return 1;
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
  // Very rough approximation of p-value
  const df = n - 2;
  return Math.min(1, 2 / (1 + Math.exp(t * 0.5)));
}

/**
 * Analyze correlations between multiple time series
 */
export function analyzeCorrelations(
  seriesMap: Record<string, number[]>
): CorrelationMatrix {
  const services = Object.keys(seriesMap);
  const n = services.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const pairs: CorrelationResult[] = [];

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // self-correlation

    for (let j = i + 1; j < n; j++) {
      const { lag, correlation } = findOptimalLag(
        seriesMap[services[i]],
        seriesMap[services[j]]
      );

      matrix[i][j] = correlation;
      matrix[j][i] = correlation;

      const minLength = Math.min(
        seriesMap[services[i]].length,
        seriesMap[services[j]].length
      );

      pairs.push({
        serviceA: services[i],
        serviceB: services[j],
        correlation,
        strength: categorizeCorrelation(correlation),
        lag,
        pValue: approximatePValue(correlation, minLength),
      });
    }
  }

  return {
    services,
    matrix,
    pairs,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Find potentially cascading failures from correlation matrix
 * Cascading failures: A→B where B is strongly correlated with A (lagged)
 */
export function findCascadingFailures(
  matrix: CorrelationMatrix
): { source: string; target: string; lag: number; correlation: number }[] {
  const cascading: { source: string; target: string; lag: number; correlation: number }[] = [];

  for (const pair of matrix.pairs) {
    if (pair.lag !== 0 && Math.abs(pair.correlation) > 0.7) {
      // Positive lag means serviceA leads serviceB
      if (pair.lag > 0) {
        cascading.push({
          source: pair.serviceA,
          target: pair.serviceB,
          lag: pair.lag,
          correlation: pair.correlation,
        });
      } else {
        cascading.push({
          source: pair.serviceB,
          target: pair.serviceA,
          lag: -pair.lag,
          correlation: pair.correlation,
        });
      }
    }
  }

  return cascading;
}

/**
 * Find correlation clusters (groups of highly correlated services)
 */
function findCorrelationClusters(
  matrix: CorrelationMatrix
): string[][] {
  const clusters: string[][] = [];
  const visited = new Set<string>();

  for (let i = 0; i < matrix.services.length; i++) {
    if (visited.has(matrix.services[i])) continue;

    const cluster: string[] = [matrix.services[i]];
    visited.add(matrix.services[i]);

    for (let j = i + 1; j < matrix.services.length; j++) {
      if (Math.abs(matrix.matrix[i][j]) > 0.7) {
        cluster.push(matrix.services[j]);
        visited.add(matrix.services[j]);
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Generate human-readable insights from correlation matrix
 */
export function generateCorrelationInsights(
  matrix: CorrelationMatrix
): string[] {
  const insights: string[] = [];

  // Find strongest correlations
  const sortedPairs = [...matrix.pairs].sort(
    (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
  );

  if (sortedPairs.length > 0) {
    const top = sortedPairs[0];
    const direction = top.correlation > 0 ? "positively" : "negatively";
    insights.push(
      `Strongest relationship: ${top.serviceA} and ${top.serviceB} are ${direction} correlated (${top.correlation.toFixed(2)}).`
    );
  }

  // Check for cascading failures
  const cascading = findCascadingFailures(matrix);
  if (cascading.length > 0) {
    insights.push(
      `Potential cascading: ${cascading
        .map((c) => `${c.source} → ${c.target} (lag ${c.lag})`)
        .join(", ")}. Consider implementing circuit breakers.`
    );
  }

  const clusters = findCorrelationClusters(matrix);
  if (clusters.length > 0) {
    insights.push(
      `Correlation clusters found: ${clusters
        .map((c) => c.join(", "))
        .join(" | ")}. These services may share dependencies.`
    );
  }

  return insights;
}

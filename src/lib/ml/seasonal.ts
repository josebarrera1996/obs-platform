// ── Seasonal Decomposition (STL-like) ──
// Decomposes time-series data into trend, seasonal, and residual components.
// This is a TypeScript implementation of a simplified STL (Seasonal-Trend decomposition).

export interface DecompositionResult {
  trend: number[];
  seasonal: number[];
  residual: number[];
  original: number[];
  seasonality: number; // detected period
  strength: {
    trend: number;     // 0-1 how strong the trend component is
    seasonal: number;  // 0-1 how strong the seasonal component is
    residual: number;  // 0-1 how much noise remains
  };
}

/**
 * Auto-detect the dominant period in a time series
 * Uses mean-centered autocorrelation to find the most likely seasonality period
 */
export function detectPeriod(values: number[], maxPeriod: number = 48): number {
  const n = values.length;
  if (n < 4) return 1;

  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  if (variance === 0) return 1;

  let bestPeriod = 1;
  let bestCorrelation = 0;

  const maxP = Math.min(maxPeriod, Math.floor(n / 2) - 1);

  // Store correlations for each period to detect monotonic decrease (trend vs seasonality)
  const correlations: number[] = [0, 0];

  for (let period = 2; period <= maxP; period++) {
    let correlation = 0;
    let count = 0;

    for (let i = 0; i < n - period; i++) {
      correlation += (values[i] - mean) * (values[i + period] - mean);
      count++;
    }

    // Normalize by count * variance to get proper autocorrelation in [-1, 1]
    correlation = count > 0 ? correlation / (count * variance) : 0;
    correlations.push(correlation);

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = period;
    }
  }

  // If best period is 2 and correlation decreases monotonically, it's a trend, not seasonality
  if (bestPeriod === 2 && bestCorrelation > 0) {
    let monotonicDecrease = true;
    for (let p = 2; p < Math.min(maxP, Math.floor(n / 4)); p++) {
      if (correlations[p + 1] >= correlations[p] * 0.95) {
        monotonicDecrease = false;
        break;
      }
    }
    if (monotonicDecrease && bestCorrelation < 0.95) {
      return 1; // Trend, no seasonality
    }
  }

  // Also check: if correlation is high (>0.8) across ALL lags, it's a trend
  let highCorrCount = 0;
  for (let p = 2; p <= Math.min(12, maxP); p++) {
    if (correlations[p] > 0.7) highCorrCount++;
  }
  if (highCorrCount > maxP - 3 && bestCorrelation < 0.95) {
    return 1; // Pervasive high correlation = trend, not seasonality
  }

  return bestPeriod;
}

/**
 * Simple moving average smoothing
 */
function movingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const slice = values.slice(start, end);
    result.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }

  return result;
}

/**
 * Calculate variance (sample variance with Bessel correction)
 */
function variance(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = values.reduce((s, v) => s + v, 0) / n;
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1);
}

/**
 * Decompose a time series into trend, seasonal, and residual components
 *
 * Algorithm:
 * 1. Extract trend using moving average (LOESS-like smoothing)
 * 2. Detrend the series (original - trend)
 * 3. Average detrended values by seasonal position to get seasonal component
 * 4. Residual = original - trend - seasonal
 * 5. Calculate strength using variance ratios
 */
export function decomposeSeasonal(
  values: number[],
  period?: number
): DecompositionResult {
  const n = values.length;
  if (n < 4) {
    return {
      trend: values.map(() => 0),
      seasonal: values.map(() => 0),
      residual: values.map(() => 0),
      original: values,
      seasonality: 1,
      strength: { trend: 0, seasonal: 0, residual: 1 },
    };
  }

  const detectedPeriod = period || detectPeriod(values);
  const trendWindow = Math.max(3, Math.min(detectedPeriod * 2, Math.floor(n / 3)));

  // Step 1: Extract trend using moving average
  const trend = movingAverage(values, trendWindow);

  // Step 2: Detrend
  const detrended = values.map((v, i) => v - trend[i]);

  // Step 3: Seasonal component (average detrended by position)
  const seasonal: number[] = new Array(n).fill(0);
  if (detectedPeriod > 1) {
    const seasonalAverages: number[] = new Array(detectedPeriod).fill(0);
    const seasonalCounts: number[] = new Array(detectedPeriod).fill(0);

    for (let i = 0; i < n; i++) {
      const pos = i % detectedPeriod;
      seasonalAverages[pos] += detrended[i];
      seasonalCounts[pos]++;
    }

    for (let i = 0; i < detectedPeriod; i++) {
      seasonalAverages[i] = seasonalCounts[i] > 0 ? seasonalAverages[i] / seasonalCounts[i] : 0;
    }

    for (let i = 0; i < n; i++) {
      seasonal[i] = seasonalAverages[i % detectedPeriod];
    }

    // Center the seasonal component (zero-mean)
    const seasonalMean = seasonal.reduce((s, v) => s + v, 0) / n;
    for (let i = 0; i < n; i++) {
      seasonal[i] -= seasonalMean;
    }
  }

  // Step 4: Residual = original - trend - seasonal
  const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

  // Step 5: Calculate strength using variance ratios
  // Using Hyndman's approach:
  //   Trend strength = max(0, 1 - Var(residual) / Var(trend + residual))
  //   Seasonal strength = max(0, 1 - Var(residual) / Var(seasonal + residual))
  const varResidual = variance(residual);

  const trendPlusResidual = trend.map((t, i) => t + residual[i]);
  const varTrendPlusResidual = variance(trendPlusResidual);

  const seasonalPlusResidual = seasonal.map((s, i) => s + residual[i]);
  const varSeasonalPlusResidual = variance(seasonalPlusResidual);

  const varOriginal = variance(values);

  const trendStrength =
    varTrendPlusResidual > 0
      ? Math.max(0, 1 - varResidual / varTrendPlusResidual)
      : 0;

  const seasonalStrength =
    varSeasonalPlusResidual > 0
      ? Math.max(0, 1 - varResidual / varSeasonalPlusResidual)
      : 0;

  const residualStrength =
    varOriginal > 0 ? Math.min(1, varResidual / varOriginal) : 1;

  return {
    trend,
    seasonal,
    residual,
    original: values,
    seasonality: detectedPeriod,
    strength: {
      trend: trendStrength,
      seasonal: seasonalStrength,
      residual: residualStrength,
    },
  };
}

/**
 * Check if a time series has strong seasonality
 */
export function hasStrongSeasonality(result: DecompositionResult): boolean {
  return result.strength.seasonal > 0.3 && result.seasonality >= 4;
}

/**
 * Check if a time series has a strong trend
 */
export function hasStrongTrend(result: DecompositionResult): boolean {
  return result.strength.trend > 0.3;
}

/**
 * Check if a time series is mostly noise
 * Lower threshold (0.3) because small-sample random data can show
 * spurious autocorrelation patterns that look like seasonality
 */
export function isMostlyNoise(result: DecompositionResult): boolean {
  return result.strength.residual > 0.3;
}

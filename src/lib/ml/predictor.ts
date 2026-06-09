// ── Enhanced Predictor (Prophet-like) ──
// Time-series forecasting with trend, seasonality, and holiday effects.
// This is a simplified TypeScript version of Facebook Prophet.

import { decomposeSeasonal, type DecompositionResult } from "./seasonal";
import { detectPatterns, type PatternAnalysisResult } from "./patterns";

export interface ForecastResult {
  forecast: number[];
  upperBound: number[];
  lowerBound: number[];
  confidence: number; // 0-1
  components: {
    trend: number[];
    seasonal: number[];
    weekly?: number[];
    daily?: number[];
  };
  decomposition: DecompositionResult;
  patterns: PatternAnalysisResult;
  metadata: {
    seasonalityDetected: number;
    trendStrength: number;
    seasonalStrength: number;
    noiseLevel: number;
    pointsUsed: number;
  };
}

export interface ForecastConfig {
  periods: number;          // number of periods to forecast
  intervalWidth: number;    // confidence interval width (1-3, default 1.96 = 95%)
  seasonalityMode: "additive" | "multiplicative";
  includeUncertainty: boolean;
  changepointRange: number; // fraction of history for changepoints (0-1)
}

const DEFAULT_CONFIG: ForecastConfig = {
  periods: 12,
  intervalWidth: 1.96,
  seasonalityMode: "additive",
  includeUncertainty: true,
  changepointRange: 0.8,
};

/**
 * Generate a Prophet-style forecast with trend, seasonality, and uncertainty
 */
export function prophetForecast(
  values: number[],
  config: Partial<ForecastConfig> = {}
): ForecastResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const n = values.length;

  if (n < 4) {
    // Return basic forecast for insufficient data
    const trend = values.length > 0 ? values[values.length - 1] : 50;
    return {
      forecast: Array(cfg.periods).fill(trend),
      upperBound: Array(cfg.periods).fill(trend * 1.1),
      lowerBound: Array(cfg.periods).fill(trend * 0.9),
      confidence: 0.3,
      components: {
        trend: [trend],
        seasonal: Array(values.length).fill(0),
      },
      decomposition: {
        trend: [trend],
        seasonal: Array(values.length).fill(0),
        residual: Array(values.length).fill(0),
        original: values,
        seasonality: 1,
        strength: { trend: 0.5, seasonal: 0, residual: 0.5 },
      },
      patterns: { patterns: [], summary: "Insufficient data", stabilityScore: 1, changeVelocity: 0, dominantPattern: "unknown" },
      metadata: {
        seasonalityDetected: 0,
        trendStrength: 0,
        seasonalStrength: 0,
        noiseLevel: 1,
        pointsUsed: n,
      },
    };
  }

  // Step 1: Decompose seasonal component
  const decomposition = decomposeSeasonal(values);
  const { trend, seasonal, residual, seasonality } = decomposition;

  // Step 2: Detect patterns
  const patterns = detectPatterns(values);

  // Step 3: Fit trend — use original values instead of smoothed trend
  // to avoid edge effects from moving average
  const fitWindow = Math.max(4, Math.floor(n * 0.5));
  const recentValues = values.slice(-fitWindow);
  const trendSlope = fitLinearSlope(recentValues);

  // Step 4: Generate forecast
  const lastValue = values[values.length - 1];
  const forecast: number[] = [];
  const seasonalForecast: number[] = [];

  for (let i = 0; i < cfg.periods; i++) {
    // Trend component (use last raw value + slope projection)
    const t = lastValue + trendSlope * (i + 1);

    // Seasonal component (use same period pattern)
    const seasonalIdx = (n + i) % seasonality;
    const s = seasonal[seasonalIdx] || 0;

    const predicted = cfg.seasonalityMode === "additive" ? t + s : t * (1 + s / (t || 1));

    forecast.push(Math.max(0, Math.min(100, predicted)));
    seasonalForecast.push(s);
  }

  // Step 5: Calculate uncertainty
  const residualStd = calculateStd(residual);
  let upperBound: number[];
  let lowerBound: number[];

  if (cfg.includeUncertainty && residualStd > 0) {
    upperBound = forecast.map(
      (f, i) => Math.max(0, Math.min(100, f + residualStd * cfg.intervalWidth * (1 + i * 0.05)))
    );
    lowerBound = forecast.map(
      (f, i) => Math.max(0, Math.min(100, f - residualStd * cfg.intervalWidth * (1 + i * 0.05)))
    );
  } else {
    upperBound = forecast.map((f) => Math.min(100, f * 1.05));
    lowerBound = forecast.map((f) => Math.max(0, f * 0.95));
  }

  // Step 6: Calculate confidence based on residual quality
  const baseConfidence = 1 - Math.min(1, residualStd / (mean(values) || 1));
  const dataQuality = Math.min(1, n / 50); // More data = more confidence
  const confidence = Math.max(0.1, baseConfidence * 0.6 + dataQuality * 0.4);

  return {
    forecast,
    upperBound,
    lowerBound,
    confidence,
    components: {
      trend,
      seasonal,
    },
    decomposition,
    patterns,
    metadata: {
      seasonalityDetected: seasonality,
      trendStrength: decomposition.strength.trend,
      seasonalStrength: decomposition.strength.seasonal,
      noiseLevel: decomposition.strength.residual,
      pointsUsed: n,
    },
  };
}

/**
 * Fit a linear slope to a series using least squares
 */
function fitLinearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    const yDiff = values[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Calculate standard deviation
 */
function calculateStd(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

/**
 * Generate intelligent recommendations based on forecast + patterns
 */
export function generateMLRecommendations(
  forecast: ForecastResult
): string[] {
  const recommendations: string[] = [];

  // Check trend
  if (forecast.metadata.trendStrength > 0.4) {
    const lastTrend = forecast.components.trend.slice(-5);
    const trendDir = lastTrend[lastTrend.length - 1] > lastTrend[0] ? "increasing" : "decreasing";

    if (trendDir === "increasing" && lastTrend[lastTrend.length - 1] > 80) {
      recommendations.push(
        "⚠️ CPU/Memory trend is consistently high (>80%). Consider scaling up resources or investigating root cause before it impacts performance."
      );
    } else if (trendDir === "decreasing" && lastTrend[lastTrend.length - 1] < 20) {
      recommendations.push(
        "📉 Resource usage is trending down. Consider rightsizing to save costs."
      );
    }
  }

  // Check seasonality
  if (forecast.metadata.seasonalStrength > 0.3) {
    const period = forecast.metadata.seasonalityDetected;
    if (period >= 10 && period <= 14) {
      recommendations.push(
        "🔄 Strong 12-period cycle detected — this may indicate daily business cycle patterns. Consider scheduling deployments outside peak hours."
      );
    } else if (period >= 20 && period <= 30) {
      recommendations.push(
        "📅 Weekly pattern detected. Auto-scaling policies should account for weekday vs weekend load differences."
      );
    }
  }

  // Check anomalies from patterns
  const criticalPatterns = forecast.patterns.patterns.filter(
    (p) => p.severity === "critical" || p.severity === "high"
  );
  if (criticalPatterns.length > 0) {
    recommendations.push(
      `🔴 ${criticalPatterns.length} significant pattern(s) detected: ${criticalPatterns
        .map((p) => p.description)
        .join("; ")}. Recommend investigation.`
    );
  }

  // Check noise level
  if (forecast.metadata.noiseLevel > 0.6) {
    recommendations.push(
      "📊 High noise level detected in metrics. This could indicate unstable workloads or noisy-neighbor issues in shared infrastructure."
    );
  }

  // Conservative default
  if (recommendations.length === 0) {
    recommendations.push(
      "✅ System metrics look healthy. Continue monitoring for any changes in baseline behavior."
    );
  }

  return recommendations;
}
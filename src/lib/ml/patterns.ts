// ── Pattern Detection Engine ──
// Detects behavioral patterns in time-series data: spikes, dips, plateaus,
// gradual changes, and recurring patterns.

export interface DetectedPattern {
  type: "spike" | "dip" | "plateau" | "gradual_increase" | "gradual_decrease" | "recurring" | "outlier";
  startIndex: number;
  endIndex: number;
  confidence: number; // 0-1
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, number | string>;
}

export interface PatternAnalysisResult {
  patterns: DetectedPattern[];
  summary: string;
  stabilityScore: number; // 0-1 (1 = very stable)
  changeVelocity: number; // avg rate of change
  dominantPattern: string;
}

/**
 * Detect all patterns in a time series
 */
export function detectPatterns(
  values: number[],
  timestamps?: string[]
): PatternAnalysisResult {
  const patterns: DetectedPattern[] = [];

  if (values.length < 5) {
    return {
      patterns,
      summary: "Insufficient data for pattern analysis",
      stabilityScore: 1,
      changeVelocity: 0,
      dominantPattern: "unknown",
    };
  }

  // Detect spikes (values significantly above neighbors)
  patterns.push(...detectSpikes(values));

  // Detect dips (values significantly below neighbors)
  patterns.push(...detectDips(values));

  // Detect plateaus (sustained flat periods)
  patterns.push(...detectPlateaus(values));

  // Detect gradual trends
  patterns.push(...detectGradualChanges(values));

  // Detect recurring patterns
  const recurring = detectRecurring(values);
  if (recurring) patterns.push(recurring);

  // Calculate aggregate metrics
  const changes = calculateChanges(values);
  const stabilityScore = calculateStability(values, patterns);
  const dominantPattern = getDominantPattern(patterns);

  return {
    patterns,
    summary: generateSummary(patterns, stabilityScore),
    stabilityScore,
    changeVelocity: changes.avgVelocity,
    dominantPattern,
  };
}

/**
 * Detect spikes: values significantly above local average
 */
function detectSpikes(values: number[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const windowSize = Math.max(3, Math.floor(values.length / 10));
  const threshold = 2.5; // standard deviations

  for (let i = 0; i < values.length; i++) {
    // Build window EXCLUDING the current point to avoid self-bias
    const start = Math.max(0, i - windowSize);
    const end = Math.min(values.length, i + windowSize + 1);
    const window = [ ...values.slice(start, i), ...values.slice(i + 1, end) ];
    if (window.length < 2) continue;

    const localMean = window.reduce((s, v) => s + v, 0) / window.length;
    const localStd = Math.sqrt(
      window.reduce((s, v) => s + (v - localMean) ** 2, 0) / window.length
    );

    const zScore = localStd === 0
      ? (values[i] !== localMean ? threshold + 1 : 0) // All neighbors identical, any diff is significant
      : (values[i] - localMean) / localStd;
    if (zScore > threshold) {
      const severity = zScore > 4 ? "critical" : zScore > 3 ? "high" : "medium";
      patterns.push({
        type: "spike",
        startIndex: i,
        endIndex: i,
        confidence: Math.min(1, (zScore - threshold) / 3),
        description: `Spike detected: ${values[i].toFixed(2)} (${zScore.toFixed(1)}σ above baseline)`,
        severity,
        metadata: { zScore, value: values[i], baseline: localMean },
      });
    }
  }

  return patterns;
}

/**
 * Detect dips: values significantly below local average
 */
function detectDips(values: number[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const windowSize = Math.max(3, Math.floor(values.length / 10));
  const threshold = 2.5;

  for (let i = 0; i < values.length; i++) {
    // Build window EXCLUDING the current point to avoid self-bias
    const start = Math.max(0, i - windowSize);
    const end = Math.min(values.length, i + windowSize + 1);
    const window = [ ...values.slice(start, i), ...values.slice(i + 1, end) ];
    if (window.length < 2) continue;

    const localMean = window.reduce((s, v) => s + v, 0) / window.length;
    const localStd = Math.sqrt(
      window.reduce((s, v) => s + (v - localMean) ** 2, 0) / window.length
    );

    const zScore = localStd === 0
      ? (values[i] !== localMean ? threshold + 1 : 0) // All neighbors identical, any diff is significant
      : (localMean - values[i]) / localStd;
    if (zScore > threshold) {
      const severity = zScore > 4 ? "critical" : zScore > 3 ? "high" : "medium";
      patterns.push({
        type: "dip",
        startIndex: i,
        endIndex: i,
        confidence: Math.min(1, (zScore - threshold) / 3),
        description: `Dip detected: ${values[i].toFixed(2)} (${zScore.toFixed(1)}σ below baseline)`,
        severity,
        metadata: { zScore, value: values[i], baseline: localMean },
      });
    }
  }

  return patterns;
}

/**
 * Detect plateaus: sustained periods of low variance
 */
function detectPlateaus(values: number[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const minPlateauLength = Math.max(3, Math.floor(values.length / 15));
  const varianceThreshold = 0.05; // 5% coefficient of variation

  let plateauStart = -1;

  for (let i = 0; i < values.length; i++) {
    if (plateauStart === -1) {
      plateauStart = i;
    }

    const segment = values.slice(plateauStart, i + 1);
    const mean = segment.reduce((s, v) => s + v, 0) / segment.length;
    const variance = segment.reduce((s, v) => s + (v - mean) ** 2, 0) / segment.length;
    const cv = Math.sqrt(variance) / (mean || 1);

    if (cv > varianceThreshold || i === values.length - 1) {
      const length = i - plateauStart;
      if (length >= minPlateauLength) {
        patterns.push({
          type: "plateau",
          startIndex: plateauStart,
          endIndex: i - 1,
          confidence: Math.min(1, length / (minPlateauLength * 3)),
          description: `Plateau detected: ${length} points with ${(cv * 100).toFixed(1)}% variance`,
          severity: "low",
          metadata: { length, variance: cv, average: mean },
        });
      }
      plateauStart = i;
    }
  }

  return patterns;
}

/**
 * Detect gradual increasing/decreasing trends
 */
function detectGradualChanges(values: number[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const minTrendLength = Math.max(4, Math.floor(values.length / 8));
  const changeThreshold = 0.02; // 2% per point

  let trendStart = 0;
  let isIncreasing = values[1] > values[0];

  for (let i = 1; i < values.length; i++) {
    const currentTrend = values[i] > values[i - 1];

    if (currentTrend !== isIncreasing || i === values.length - 1) {
      const length = i - trendStart;
      if (length >= minTrendLength) {
        const startVal = values[trendStart];
        const endVal = values[i - 1];
        const pctChange = ((endVal - startVal) / (startVal || 1)) * 100;
        const changePerPoint = Math.abs(pctChange / length);

        if (changePerPoint >= changeThreshold) {
          const type = isIncreasing ? "gradual_increase" : "gradual_decrease";
          const severity = Math.abs(pctChange) > 20 ? "high" : Math.abs(pctChange) > 10 ? "medium" : "low";
          patterns.push({
            type,
            startIndex: trendStart,
            endIndex: i - 1,
            confidence: Math.min(1, Math.abs(pctChange) / 30),
            description: `${type === "gradual_increase" ? "Gradual increase" : "Gradual decrease"}: ${pctChange.toFixed(1)}% over ${length} points`,
            severity,
            metadata: { pctChange, length, changePerPoint },
          });
        }
      }

      trendStart = i;
      isIncreasing = currentTrend;
    }
  }

  return patterns;
}

/**
 * Detect recurring patterns via autocorrelation
 */
function detectRecurring(values: number[]): DetectedPattern | null {
  if (values.length < 10) return null;

  const maxLag = Math.min(24, Math.floor(values.length / 3));
  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = 2; lag <= maxLag; lag++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i < values.length - lag; i++) {
      corr += values[i] * values[i + lag];
      count++;
    }
    corr = count > 0 ? corr / count : 0;

    // Normalize
    const meanVal = values.reduce((s, v) => s + v, 0) / values.length;
    const stdVal = Math.sqrt(values.reduce((s, v) => s + (v - meanVal) ** 2, 0) / values.length) || 1;
    const normalizedCorr = corr / (stdVal * stdVal * (Math.sqrt(count) || 1));

    if (normalizedCorr > bestCorr) {
      bestCorr = normalizedCorr;
      bestLag = lag;
    }
  }

  if (bestLag >= 3 && bestCorr > 0.5) {
    return {
      type: "recurring",
      startIndex: 0,
      endIndex: values.length - 1,
      confidence: Math.min(1, bestCorr),
      description: `Recurring pattern detected every ~${bestLag} data points (correlation: ${bestCorr.toFixed(2)})`,
      severity: "medium",
      metadata: { period: bestLag, correlation: bestCorr },
    };
  }

  return null;
}

/**
 * Calculate change velocity (average rate of change)
 */
function calculateChanges(values: number[]): { avgVelocity: number; maxChange: number } {
  let totalChange = 0;
  let maxChange = 0;

  for (let i = 1; i < values.length; i++) {
    const change = Math.abs(values[i] - values[i - 1]);
    totalChange += change;
    maxChange = Math.max(maxChange, change);
  }

  return {
    avgVelocity: values.length > 1 ? totalChange / (values.length - 1) : 0,
    maxChange,
  };
}

/**
 * Calculate stability score (0 = chaotic, 1 = perfectly stable)
 */
function calculateStability(values: number[], patterns: DetectedPattern[]): number {
  if (values.length < 3) return 1;

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  const cv = std / (mean || 1); // coefficient of variation

  // Base stability from coefficient of variation
  let stability = Math.max(0, 1 - cv);

  // Reduce stability for each high-severity pattern
  const severePatterns = patterns.filter(
    (p) => p.severity === "high" || p.severity === "critical"
  ).length;
  stability -= severePatterns * 0.15;

  return Math.max(0, Math.min(1, stability));
}

/**
 * Get the most descriptive pattern type
 */
function getDominantPattern(patterns: DetectedPattern[]): string {
  if (patterns.length === 0) return "stable";

  const counts: Record<string, number> = {};
  for (const p of patterns) {
    counts[p.type] = (counts[p.type] || 0) + 1;
  }

  let dominant = "stable";
  let maxCount = 0;

  for (const [type, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = type;
    }
  }

  return dominant;
}

/**
 * Generate a human-readable summary
 */
function generateSummary(patterns: DetectedPattern[], stabilityScore: number): string {
  if (patterns.length === 0) {
    return "No significant patterns detected. System is stable.";
  }

  const critical = patterns.filter((p) => p.severity === "critical").length;
  const high = patterns.filter((p) => p.severity === "high").length;
  const medium = patterns.filter((p) => p.severity === "medium").length;
  const spikes = patterns.filter((p) => p.type === "spike").length;
  const dips = patterns.filter((p) => p.type === "dip").length;
  const trends = patterns.filter(
    (p) => p.type === "gradual_increase" || p.type === "gradual_decrease"
  ).length;

  const parts: string[] = [];
  if (critical > 0) parts.push(`${critical} critical issue(s)`);
  if (high > 0) parts.push(`${high} high-severity issue(s)`);
  if (spikes > 0) parts.push(`${spikes} spike(s)`);
  if (dips > 0) parts.push(`${dips} dip(s)`);
  if (trends > 0) parts.push(`${trends} trend(s)`);

  const stabilityLabel =
    stabilityScore > 0.8 ? "Stable" : stabilityScore > 0.5 ? "Moderately stable" : "Unstable";

  return `${stabilityLabel}: ${parts.join(", ") || "No issues"}.`;
}
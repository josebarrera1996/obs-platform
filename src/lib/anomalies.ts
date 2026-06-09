// ── Statistical Anomaly Detection ──
// Uses Z-score method: values more than N standard deviations from mean are anomalies

export function detectAnomalies(
  values: number[],
  threshold: number = 2.5
): { index: number; value: number; zScore: number; severity: string }[] {
  const n = values.length;
  if (n < 3) return [];

  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  return values
    .map((value, index) => {
      const zScore = (value - mean) / stdDev;
      const absZ = Math.abs(zScore);
      let severity = "low";
      if (absZ > 3) severity = "critical";
      else if (absZ > 2.5) severity = "high";
      else if (absZ > 2) severity = "medium";
      return { index, value, zScore, severity };
    })
    .filter((a) => Math.abs(a.zScore) > threshold);
}

// ── Simple linear regression forecasting ──

export function forecastLinear(
  values: number[],
  steps: number
): number[] {
  const n = values.length;
  if (n < 3) return [];

  // Linear regression: y = mx + b
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

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Clamp forecast to reasonable bounds (0-100 for percentages)
  return Array.from({ length: steps }, (_, i) => {
    const predicted = intercept + slope * (n + i);
    return Math.max(0, Math.min(100, predicted));
  });
}
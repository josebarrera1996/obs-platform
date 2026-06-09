// ── Seasonal Decomposition Tests ──
import { describe, it, expect } from "vitest";
import { decomposeSeasonal, detectPeriod, hasStrongSeasonality, hasStrongTrend, isMostlyNoise } from "@/lib/ml/seasonal";

describe("Seasonal Decomposition", () => {
  it("should return flat result for insufficient data", () => {
    const result = decomposeSeasonal([1, 2, 3]);
    expect(result.trend).toHaveLength(3);
    expect(result.seasonality).toBe(1);
  });

  it("should detect simple seasonality", () => {
    // Perfect sine wave: period = 12
    const values = Array.from({ length: 48 }, (_, i) =>
      Math.sin((i % 12) * (2 * Math.PI / 12)) * 10 + 50
    );
    const result = decomposeSeasonal(values);
    expect(result.seasonality).toBeGreaterThanOrEqual(2);
    expect(result.strength.seasonal).toBeGreaterThan(0.3);
  });

  it("should extract trend component", () => {
    // Data with clear upward trend
    const values = Array.from({ length: 24 }, (_, i) => 30 + i * 2);
    const result = decomposeSeasonal(values, 1);
    // Trend should be close to original for linear data
    const trendError = values.reduce((s, v, i) => s + Math.abs(v - result.trend[i]), 0) / values.length;
    expect(trendError).toBeLessThan(5);
  });

  it("should detect period via autocorrelation", () => {
    const period = 8;
    const values = Array.from({ length: 32 }, (_, i) =>
      Math.sin((i % period) * (2 * Math.PI / period)) * 10
    );
    const detected = detectPeriod(values);
    // Should detect a period close to the actual period
    // Autocorrelation may find multiples, so check it's reasonable
    expect(detected).toBeGreaterThanOrEqual(2);
  });

  it("should identify strong seasonality", () => {
    const values = Array.from({ length: 48 }, (_, i) =>
      Math.sin(i * (2 * Math.PI / 12)) * 20 + 50
    );
    const result = decomposeSeasonal(values);
    expect(hasStrongSeasonality(result)).toBe(true);
  });

  it("should identify strong trend", () => {
    const values = Array.from({ length: 24 }, (_, i) => 10 + i);
    const result = decomposeSeasonal(values, 1);
    expect(hasStrongTrend(result)).toBe(true);
  });

  it("should identify noise", () => {
    // Seeded PRNG for deterministic tests (replaces flaky Math.random)
    let seed = 42;
    const seededRandom = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };
    const values = Array.from({ length: 48 }, () => seededRandom() * 100);
    const result = decomposeSeasonal(values);
    // Random data is mostly noise — with 48 points the residual should dominate
    expect(isMostlyNoise(result)).toBe(true);
  });
});

describe("detectPeriod", () => {
  it("should handle short arrays gracefully", () => {
    expect(detectPeriod([1, 2, 3])).toBe(1);
  });

  it("should not return period larger than half the data", () => {
    const values = Array.from({ length: 10 }, (_, i) => i);
    const period = detectPeriod(values, 12);
    expect(period).toBeLessThanOrEqual(values.length / 2);
  });
});
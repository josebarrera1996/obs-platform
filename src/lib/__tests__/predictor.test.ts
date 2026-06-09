// ── Prophet Forecast Tests ──
import { describe, it, expect } from "vitest";
import { prophetForecast, generateMLRecommendations } from "@/lib/ml/predictor";

describe("Prophet-like Forecast", () => {
  it("should return basic forecast for insufficient data", () => {
    const result = prophetForecast([1, 2, 3]);
    expect(result.forecast).toHaveLength(12);
    expect(result.confidence).toBeLessThan(1);
  });

  it("should forecast increasing trend", () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 + i * 2);
    const result = prophetForecast(values, { periods: 5 });
    expect(result.forecast).toHaveLength(5);
    // Should continue the upward trend
    expect(result.forecast[0]).toBeGreaterThan(values[values.length - 1]);
  });

  it("should include upper and lower bounds", () => {
    const values = Array.from({ length: 20 }, (_, i) => 50 + Math.random() * 10);
    const result = prophetForecast(values);
    expect(result.upperBound).toHaveLength(result.forecast.length);
    expect(result.lowerBound).toHaveLength(result.forecast.length);
    // Upper should be >= lower
    for (let i = 0; i < result.forecast.length; i++) {
      expect(result.upperBound[i]).toBeGreaterThanOrEqual(result.lowerBound[i]);
    }
  });

  it("should detect seasonality in periodic data", () => {
    const values = Array.from({ length: 48 }, (_, i) =>
      Math.sin((i % 12) * (2 * Math.PI / 12)) * 20 + 50
    );
    const result = prophetForecast(values);
    expect(result.metadata.seasonalityDetected).toBeGreaterThanOrEqual(2);
  });

  it("should generate recommendations", () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 + i * 4);
    values.push(500); // spike
    const result = prophetForecast(values);
    const recommendations = generateMLRecommendations(result);
    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBeGreaterThan(0);
  });

  it("should clamp forecast to 0-100 range", () => {
    const values = Array.from({ length: 20 }, (_, i) => 1 + i * 0.5);
    const result = prophetForecast(values, { periods: 50 });
    for (const v of result.forecast) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("should handle constant values", () => {
    const values = Array.from({ length: 20 }, () => 50);
    const result = prophetForecast(values);
    expect(result.forecast.every((v) => v === 50)).toBe(true);
  });

  it("should provide metadata", () => {
    const values = Array.from({ length: 20 }, (_, i) => 50 + Math.sin(i) * 10);
    const result = prophetForecast(values);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.pointsUsed).toBe(20);
    expect(result.metadata.trendStrength).toBeGreaterThanOrEqual(0);
    expect(result.metadata.trendStrength).toBeLessThanOrEqual(1);
  });
});
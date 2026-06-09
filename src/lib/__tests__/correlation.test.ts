// ── Correlation Analysis Tests ──
import { describe, it, expect } from "vitest";
import {
  pearsonCorrelation,
  findOptimalLag,
  analyzeCorrelations,
  findCascadingFailures,
  generateCorrelationInsights,
} from "@/lib/ml/correlation";

describe("Correlation Analysis", () => {
  it("should return 0 for short arrays", () => {
    expect(pearsonCorrelation([1, 2], [3, 4])).toBe(0);
  });

  it("should calculate perfect positive correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 5);
  });

  it("should calculate perfect negative correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 5);
  });

  it("should return 0 for uncorrelated data", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [3, 3, 3, 3, 3]; // constant
    expect(pearsonCorrelation(x, y)).toBe(0);
  });

  it("should find optimal lag", () => {
    const base = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const shifted = [10, 10, 20, 30, 40, 50, 60, 70, 80, 90]; // lag 1
    const result = findOptimalLag(base, shifted, 5);
    expect(result.lag).toBeGreaterThanOrEqual(0);
    expect(result.correlation).toBeGreaterThan(0.5);
  });

  it("should analyze multiple series", () => {
    const series = {
      "service-a": [10, 20, 30, 40, 50],
      "service-b": [10, 20, 30, 40, 50],
      "service-c": [50, 40, 30, 20, 10],
    };
    const matrix = analyzeCorrelations(series);
    expect(matrix.services).toHaveLength(3);
    expect(matrix.pairs).toHaveLength(3);
    expect(matrix.matrix[0][1]).toBeCloseTo(1, 5); // a vs b
    expect(matrix.matrix[0][2]).toBeCloseTo(-1, 5); // a vs c
  });

  it("should find cascading failures", () => {
    const series = {
      "service-a": [10, 20, 30, 40, 50],
      "service-b": [10, 20, 30, 40, 50],
      "service-c": [50, 40, 30, 20, 10],
    };
    const matrix = analyzeCorrelations(series);
    const cascading = findCascadingFailures(matrix);
    expect(Array.isArray(cascading)).toBe(true);
  });

  it("should generate correlation insights", () => {
    const series = {
      "service-a": [10, 20, 30, 40, 50],
      "service-b": [10, 20, 30, 40, 50],
    };
    const matrix = analyzeCorrelations(series);
    const insights = generateCorrelationInsights(matrix);
    expect(insights.length).toBeGreaterThan(0);
  });
});
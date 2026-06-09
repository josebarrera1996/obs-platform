// ── Anomaly Detection Unit Tests ──
import { describe, it, expect } from "vitest";
import { detectAnomalies, forecastLinear } from "@/lib/anomalies";

describe("Anomaly detection", () => {
  it("should return empty for fewer than 3 values", () => {
    expect(detectAnomalies([1, 2])).toEqual([]);
    expect(detectAnomalies([1])).toEqual([]);
    expect(detectAnomalies([])).toEqual([]);
  });

  it("should detect anomalies using default threshold (2.5 sigma)", () => {
    const values = Array.from({ length: 20 }, () => 50);
    values.push(500);
    const anomalies = detectAnomalies(values);
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0].value).toBe(500);
    expect(anomalies[0].severity).toBeDefined();
  });

  it("should detect anomalies with custom threshold", () => {
    const values = [10, 12, 11, 9, 10, 50, 11, 10, 12, 11];
    const anomalies = detectAnomalies(values, 1.8);
    // Only the 50 deviates significantly; expect at least 1 anomaly
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    const anomaly = anomalies.find((a) => a.index === 5);
    expect(anomaly).toBeDefined();
    expect(anomaly!.zScore).toBeGreaterThan(1.8);
  });

  it("should return empty if no anomalies exceed threshold", () => {
    const values = [50, 51, 49, 50, 52, 48, 50];
    expect(detectAnomalies(values, 3.0)).toEqual([]);
  });

  it("should return empty for constant values (zero std dev)", () => {
    expect(detectAnomalies([50, 50, 50, 50, 50])).toEqual([]);
  });
});

describe("Linear forecasting", () => {
  it("should forecast increasing trend", () => {
    const values = [10, 20, 30, 40, 50];
    const forecasted = forecastLinear(values, 3);
    expect(forecasted).toHaveLength(3);
    expect(forecasted[0]).toBeGreaterThan(values[values.length - 1]);
  });

  it("should forecast decreasing trend", () => {
    // Use values that won't hit the 0 clamp
    const values = [100, 95, 90, 85, 80];
    const forecasted = forecastLinear(values, 3);
    expect(forecasted).toHaveLength(3);
    // slope should be negative, so each step decreases
    expect(forecasted[2]).toBeLessThan(forecasted[1]);
    expect(forecasted[1]).toBeLessThan(forecasted[0]);
  });

  it("should clamp forecast to 0-100 range", () => {
    const values = [1, 2, 3, 4, 5];
    const forecasted = forecastLinear(values, 100);
    expect(forecasted.length).toBe(100);
    expect(forecasted.every((v) => v >= 0 && v <= 100)).toBe(true);
  });

  it("should return flat forecast for flat input", () => {
    const values = [50, 50, 50, 50, 50];
    const forecasted = forecastLinear(values, 5);
    expect(forecasted).toHaveLength(5);
    forecasted.forEach((v) => expect(v).toBeCloseTo(50, 0));
  });

  it("should return empty for insufficient data", () => {
    expect(forecastLinear([1, 2], 10)).toEqual([]);
    expect(forecastLinear([1], 10)).toEqual([]);
    expect(forecastLinear([], 10)).toEqual([]);
  });
});
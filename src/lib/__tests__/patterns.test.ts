// ── Pattern Detection Tests ──
import { describe, it, expect } from "vitest";
import { detectPatterns } from "@/lib/ml/patterns";

describe("Pattern Detection", () => {
  it("should return empty for insufficient data", () => {
    const result = detectPatterns([1, 2, 3, 4]);
    expect(result.patterns).toBeDefined();
    expect(result.summary).toContain("Insufficient");
  });

  it("should detect spikes", () => {
    const values = Array.from({ length: 20 }, () => 50);
    values.push(500); // huge spike at end
    values.push(50);
    const result = detectPatterns(values);
    const spikes = result.patterns.filter((p) => p.type === "spike");
    expect(spikes.length).toBeGreaterThanOrEqual(1);
  });

  it("should detect dips", () => {
    const values = Array.from({ length: 20 }, () => 50);
    values.push(1); // huge dip at end
    values.push(50);
    const result = detectPatterns(values);
    const dips = result.patterns.filter((p) => p.type === "dip");
    expect(dips.length).toBeGreaterThanOrEqual(1);
  });

  it("should detect plateaus (flat regions)", () => {
    const values = [
      10, 20, 30, 50, 50, 51, 50, 49, 50, 50, // plateau
      60, 70, 80,
    ];
    const result = detectPatterns(values);
    const plateaus = result.patterns.filter((p) => p.type === "plateau");
    expect(plateaus.length).toBeGreaterThanOrEqual(1);
  });

  it("should detect gradual increase", () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 + i * 3);
    const result = detectPatterns(values);
    const increases = result.patterns.filter((p) => p.type === "gradual_increase");
    expect(increases.length).toBeGreaterThanOrEqual(1);
  });

  it("should be stable for constant values", () => {
    const values = Array.from({ length: 20 }, () => 50);
    const result = detectPatterns(values);
    expect(result.stabilityScore).toBeGreaterThan(0.8);
  });

  it("should calculate change velocity", () => {
    const values = Array.from({ length: 10 }, (_, i) => i * 10);
    const result = detectPatterns(values);
    expect(result.changeVelocity).toBeGreaterThan(0);
  });

  it("should generate a summary string", () => {
    const values = Array.from({ length: 20 }, () => 50);
    values.push(500);
    const result = detectPatterns(values);
    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe("string");
  });

  it("should handle edge cases with NaN or Infinity gracefully", () => {
    const values = [NaN, 50, Infinity, 50, 50];
    const result = detectPatterns(values);
    expect(result.patterns).toBeDefined();
  });
});
// ── External Health Monitoring Tests ──
import { describe, it, expect } from "vitest";
import { checkEndpoint, formatHealthReport } from "@/lib/external-health";

describe("External Health", () => {
  it("should check endpoint and return status", async () => {
    const result = await checkEndpoint("https://httpstat.us/200");
    expect(["healthy", "degraded", "down"]).toContain(result.status);
    expect(result.statusCode).toBeGreaterThanOrEqual(0);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeTruthy();
  });

  it("should report down for invalid URL", async () => {
    const result = await checkEndpoint("https://this-domain-does-not-exist-12345.com", 1000);
    expect(result.status).toBe("down");
  }, 5000);

  it("should format health report", () => {
    const result = {
      overall: "healthy" as const,
      checks: [
        {
          endpoint: "http://localhost:3000/api/health",
          status: "healthy" as const,
          responseTimeMs: 42,
          statusCode: 200,
          timestamp: new Date().toISOString(),
        },
        {
          endpoint: "http://localhost:3000/api/aws/services",
          status: "healthy" as const,
          responseTimeMs: 150,
          statusCode: 200,
          timestamp: new Date().toISOString(),
        },
      ],
      summary: { total: 2, healthy: 2, degraded: 0, down: 0, avgResponseMs: 96 },
      timestamp: new Date().toISOString(),
    };

    const report = formatHealthReport(result);
    expect(report).toContain("healthy");
    expect(report).toContain("2/2");
    expect(report).toContain("42ms");
  });
});
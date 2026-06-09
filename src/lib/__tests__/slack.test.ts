// ── Slack Notification Unit Tests ──
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendSlackAlert,
  buildServiceAlert,
  buildIncidentAlert,
} from "@/lib/slack";

describe("Slack notifications", () => {
  describe("buildServiceAlert", () => {
    it("should build a warning alert for CPU threshold breach", () => {
      const alert = buildServiceAlert({
        serviceName: "api-gateway",
        metric: "CPUUtilization",
        value: 92,
        currentValue: 92,
        threshold: 80,
        severity: "warning",
        namespace: "AWS/EC2",
        region: "us-east-1",
        unit: "Percent",
      });

      expect(alert.text).toContain("api-gateway");
      expect(alert.text).toContain("CPUUtilization");
      expect(alert.text).toContain("WARNING");
      expect(alert.attachments).toBeDefined();
      expect(alert.attachments![0].color).toBe("warning");
    });

    it("should build a critical alert with danger color", () => {
      const alert = buildServiceAlert({
        serviceName: "db-primary",
        metric: "MemoryUtilization",
        value: 98,
        currentValue: 98,
        threshold: 90,
        severity: "critical",
        namespace: "AWS/RDS",
        region: "us-west-2",
        unit: "Percent",
      });

      expect(alert.attachments![0].color).toBe("danger");
    });

    it("should include region in the fields", () => {
      const alert = buildServiceAlert({
        serviceName: "cache-cluster",
        metric: "Latency",
        value: 250,
        currentValue: 250,
        threshold: 200,
        severity: "warning",
        namespace: "AWS/ElastiCache",
        region: "us-east-1",
        unit: "ms",
      });

      expect(alert.attachments![0].fields).toBeDefined();
      const regionField = alert.attachments![0].fields!.find(
        (f) => f.title === "Region"
      );
      expect(regionField).toBeDefined();
      expect(regionField!.value).toBe("us-east-1");
    });
  });

  describe("buildIncidentAlert", () => {
    it("should build an incident alert with event details", () => {
      const alert = buildIncidentAlert({
        eventName: "InstanceRebooted",
        eventSource: "ec2.amazonaws.com",
        eventTime: "2026-06-08T12:00:00Z",
        severity: "critical",
        description: "EC2 instance i-12345 was rebooted",
      });

      expect(alert.text).toContain("InstanceRebooted");
      expect(alert.attachments![0].color).toBe("danger");
      expect(alert.attachments![0].fields).toHaveLength(3);

      const sourceField = alert.attachments![0].fields!.find(
        (f) => f.title === "Source"
      );
      expect(sourceField).toBeDefined();
      expect(sourceField!.value).toBe("ec2.amazonaws.com");
    });

    it("should include severity level in fields", () => {
      const alert = buildIncidentAlert({
        eventName: "DiskFull",
        eventSource: "ec2.amazonaws.com",
        eventTime: "2026-06-08T13:00:00Z",
        severity: "warning",
        description: "Disk usage exceeded 90%",
      });

      const severityField = alert.attachments![0].fields!.find(
        (f) => f.title === "Severity"
      );
      expect(severityField).toBeDefined();
      expect(severityField!.value).toBe("WARNING");
    });
  });

  describe("sendSlackAlert", () => {
    beforeEach(() => {
      vi.spyOn(globalThis, "fetch").mockImplementation(
        () => Promise.resolve(new Response("ok", { status: 200 }))
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return error when no webhook URL provided", async () => {
      const result = await sendSlackAlert(
        { text: "test" },
        "" // empty webhook
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("SLACK_WEBHOOK_URL");
    });

    it("should call fetch with correct payload", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      await sendSlackAlert(
        { text: "Test alert message" },
        "https://hooks.slack.com/services/TEST/WEBHOOK"
      );
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://hooks.slack.com/services/TEST/WEBHOOK");
      expect(options.method).toBe("POST");
      const body = JSON.parse(options.body as string);
      expect(body.text).toBe("Test alert message");
      expect(body.channel).toBe("#ops-alerts");
    });

    it("should handle network failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Network error")
      );
      const result = await sendSlackAlert(
        { text: "test" },
        "https://hooks.slack.com/services/TEST/WEBHOOK"
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("should return error on non-200 response", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementationOnce(
        () => Promise.resolve(new Response("Not Found", { status: 404 }))
      );
      const result = await sendSlackAlert(
        { text: "test" },
        "https://hooks.slack.com/services/TEST/WEBHOOK"
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("404");
    });
  });
});
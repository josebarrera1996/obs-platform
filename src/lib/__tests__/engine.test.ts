// ── Alert Rules Engine Unit Tests ──
import { describe, it, expect, beforeEach } from "vitest";
import {
  addRule,
  getRules,
  getRule,
  updateRule,
  deleteRule,
  evaluateAll,
  evaluateRule,
  clearRules,
  type AlertRule,
} from "@/lib/alerts/engine";

// Helper to add a test rule
function addTestRule(overrides?: Partial<AlertRule>): AlertRule {
  return addRule({
    name: "High CPU",
    metric: "CPUUtilization",
    namespace: "AWS/EC2",
    stat: "Average",
    operator: "gt",
    threshold: 80,
    severity: "warning",
    cooldownMinutes: 10,
    enabled: true,
    channels: ["slack"],
    ...overrides,
  });
}

describe("Alert Rules Engine", () => {
  beforeEach(() => {
    clearRules();
  });

  describe("Rule CRUD", () => {
    it("should start with no rules", () => {
      expect(getRules()).toEqual([]);
    });

    it("should add a rule and assign an ID", () => {
      const rule = addTestRule();
      expect(rule.id).toBeDefined();
      expect(rule.name).toBe("High CPU");
      expect(rule.enabled).toBe(true);
      expect(rule.createdAt).toBeDefined();
    });

    it("should retrieve all rules", () => {
      addTestRule({ name: "Rule 1" });
      addTestRule({ name: "Rule 2", enabled: false });
      expect(getRules()).toHaveLength(2);
    });

    it("should get a rule by ID", () => {
      const added = addTestRule({ name: "Find Me" });
      expect(getRule(added.id)?.name).toBe("Find Me");
    });

    it("should return undefined for non-existent rule", () => {
      expect(getRule("no-such-id")).toBeUndefined();
    });

    it("should update a rule", () => {
      const added = addTestRule({ name: "Old Name" });
      const updated = updateRule(added.id, { name: "New Name", threshold: 90 });
      expect(updated?.name).toBe("New Name");
      expect(updated?.threshold).toBe(90);
    });

    it("should return undefined updating non-existent rule", () => {
      expect(updateRule("no-such-id", { name: "X" })).toBeUndefined();
    });

    it("should delete a rule", () => {
      const added = addTestRule();
      expect(deleteRule(added.id)).toBe(true);
      expect(getRule(added.id)).toBeUndefined();
    });

    it("should return false deleting non-existent rule", () => {
      expect(deleteRule("no-such-id")).toBe(false);
    });
  });

  describe("evaluateRule", () => {
    it("should trigger when value exceeds threshold (gt)", () => {
      const rule = addTestRule({ operator: "gt", threshold: 80 });
      expect(evaluateRule(rule, 90).triggered).toBe(true);
    });

    it("should NOT trigger when value is below threshold (gt)", () => {
      const rule = addTestRule({ operator: "gt", threshold: 80 });
      expect(evaluateRule(rule, 70).triggered).toBe(false);
    });

    it("should trigger when value is below threshold (lt)", () => {
      const rule = addTestRule({ operator: "lt", threshold: 20 });
      expect(evaluateRule(rule, 10).triggered).toBe(true);
    });

    it("should trigger when value equals threshold (gte)", () => {
      const rule = addTestRule({ operator: "gte", threshold: 80 });
      expect(evaluateRule(rule, 80).triggered).toBe(true);
    });

    it("should include severity in evaluation", () => {
      const rule = addTestRule({ severity: "critical" });
      expect(evaluateRule(rule, 95).severity).toBe("critical");
    });
  });

  describe("evaluateAll", () => {
    it("should return empty when no rules exist", () => {
      expect(evaluateAll([])).toEqual([]);
    });

    it("should trigger enabled rules that breach threshold", () => {
      addTestRule({ operator: "gt", threshold: 80 });
      const results = evaluateAll([
        { namespace: "AWS/EC2", metricName: "CPUUtilization", value: 90 },
      ]);
      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(true);
    });

    it("should NOT trigger disabled rules", () => {
      addTestRule({ operator: "gt", threshold: 80, enabled: false });
      const results = evaluateAll([
        { namespace: "AWS/EC2", metricName: "CPUUtilization", value: 90 },
      ]);
      expect(results.filter((r) => r.triggered)).toHaveLength(0);
    });

    it("should NOT match metrics with different namespace or metricName", () => {
      addTestRule({ operator: "gt", threshold: 80, namespace: "AWS/ECS", metric: "MemoryUtilization" });
      const results = evaluateAll([
        { namespace: "AWS/EC2", metricName: "CPUUtilization", value: 90 },
      ]);
      expect(results).toHaveLength(0);
    });

    it("should handle multiple rules and metrics", () => {
      addTestRule({
        name: "High CPU",
        metric: "CPUUtilization",
        namespace: "AWS/EC2",
        operator: "gt",
        threshold: 80,
      });
      addTestRule({
        name: "Low Memory",
        metric: "MemoryUtilization",
        namespace: "AWS/EC2",
        operator: "gt",
        threshold: 90,
        severity: "critical",
      });

      const results = evaluateAll([
        { namespace: "AWS/EC2", metricName: "CPUUtilization", value: 95 },
        { namespace: "AWS/EC2", metricName: "MemoryUtilization", value: 92 },
      ]);

      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.triggered)).toHaveLength(2);
    });
  });
});
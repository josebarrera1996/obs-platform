// ── Alert Rules Engine ──
// Evaluates metrics against configured thresholds and sends notifications.

import { sendSlackAlert, buildServiceAlert } from "@/lib/slack";

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metric: string;        // e.g. "CPUUtilization", "MemoryUtilization"
  namespace: string;      // e.g. "AWS/ECS", "AWS/EC2"
  stat: string;           // "Average" | "Maximum" | "Minimum"
  operator: "gt" | "lt" | "gte" | "lte";
  threshold: number;
  severity: "critical" | "warning";
  cooldownMinutes: number;
  enabled: boolean;
  channels: string[];     // ["slack"]
  createdAt: string;
  lastFiredAt?: string;
  lastResolvedAt?: string;
}

export interface MetricReading {
  ruleId: string;
  metricName: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface AlertEvaluation {
  ruleId: string;
  ruleName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  triggered: boolean;
  severity: "critical" | "warning";
  timestamp: string;
}

// In-memory store (will be persisted to disk later)
let rules: AlertRule[] = [];

export function getRules(): AlertRule[] {
  return [...rules];
}

export function clearRules(): void {
  rules.length = 0;
}

export function getRule(id: string): AlertRule | undefined {
  return rules.find((r) => r.id === id);
}

export function addRule(
  input: Omit<AlertRule, "id" | "createdAt" | "lastFiredAt" | "lastResolvedAt">
): AlertRule {
  const rule: AlertRule = {
    ...input,
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
  };
  rules.push(rule);
  return rule;
}

export function updateRule(
  id: string,
  input: Partial<AlertRule>
): AlertRule | undefined {
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  rules[idx] = { ...rules[idx], ...input };
  return rules[idx];
}

export function deleteRule(id: string): boolean {
  const len = rules.length;
  rules = rules.filter((r) => r.id !== id);
  return rules.length < len;
}

// Evaluate a single metric value against a rule
export function evaluateRule(
  rule: AlertRule,
  currentValue: number
): AlertEvaluation {
  let triggered = false;
  switch (rule.operator) {
    case "gt":
      triggered = currentValue > rule.threshold;
      break;
    case "lt":
      triggered = currentValue < rule.threshold;
      break;
    case "gte":
      triggered = currentValue >= rule.threshold;
      break;
    case "lte":
      triggered = currentValue <= rule.threshold;
      break;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    metric: rule.metric,
    currentValue,
    threshold: rule.threshold,
    triggered,
    severity: rule.severity,
    timestamp: new Date().toISOString(),
  };
}

// Evaluate all enabled rules against provided metrics
export function evaluateAll(
  metrics: {
    namespace: string;
    metricName: string;
    value: number;
    serviceName?: string;
    region?: string;
    unit?: string;
  }[]
): AlertEvaluation[] {
  const results: AlertEvaluation[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Find matching metric
    const metric = metrics.find(
      (m) => m.namespace === rule.namespace && m.metricName === rule.metric
    );
    if (!metric) continue;

    const evaluation = evaluateRule(rule, metric.value);
    results.push(evaluation);

    // Fire alert if triggered and cooldown has passed
    if (evaluation.triggered) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      const lastFired = rule.lastFiredAt
        ? new Date(rule.lastFiredAt).getTime()
        : 0;
      const now = Date.now();

      if (now - lastFired >= cooldownMs) {
        // Send Slack notification
        if (rule.channels.includes("slack")) {
          sendSlackAlert(
            buildServiceAlert({
              serviceName: metric.serviceName || metric.metricName,
              metric: metric.metricName,
              value: metric.value,
              threshold: rule.threshold,
              severity: rule.severity,
              namespace: metric.namespace,
              region: metric.region || "unknown",
              currentValue: metric.value,
              unit: metric.unit || "%",
            })
          );
        }

        // Update lastFiredAt
        rule.lastFiredAt = new Date().toISOString();
      }
    } else if (rule.lastFiredAt && !evaluation.triggered) {
      // Send resolution notification
      if (rule.channels.includes("slack")) {
        sendSlackAlert({
          text: `✅ *Resolved*: ${rule.name} — ${metric.metricName} is back to normal (${metric.value.toFixed(2)} ${metric.unit || "%"})`,
        });
      }
      rule.lastResolvedAt = new Date().toISOString();
      rule.lastFiredAt = undefined;
    }
  }

  return results;
}
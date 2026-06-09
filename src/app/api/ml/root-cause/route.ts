import { NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
} from "@aws-sdk/client-cloudwatch";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 min for multi-service analysis

interface ServiceMetric {
  serviceId: string;
  metricName: string;
  namespace: string;
  values: number[];
  timestamps: Date[];
}

interface AnomalyFinding {
  service: string;
  metric: string;
  severity: "critical" | "high" | "medium" | "low";
  zScore: number;
  currentValue: number;
  baselineMean: number;
  baselineStd: number;
  description: string;
  recommendation: string;
}

interface RootCauseResult {
  timestamp: string;
  credentialId: string;
  servicesAnalyzed: number;
  anomalies: AnomalyFinding[];
  rootCauses: {
    service: string;
    impactScore: number;
    impactedServices: string[];
    likelyRootCause: boolean;
    explanation: string;
  }[];
  summary: string;
}

/**
 * POST /api/ml/root-cause
 * Analyze all services for anomalies and determine root causes.
 *
 * Body:
 *   credentialId: string (required)
 *   region?: string
 *   namespaces?: string[]
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { credentialId, region, namespaces } = body;

    if (!credentialId) {
      return NextResponse.json(
        { error: "credentialId is required" },
        { status: 400 }
      );
    }

    const credential = await getCredentialById(credentialId);
    if (!credential) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    const awsRegion = region || process.env.AWS_REGION || "us-east-1";

    const client = new CloudWatchClient({
      region: awsRegion,
      credentials: {
        accessKeyId: credential.accessKeyId,
        secretAccessKey: credential.secretAccessKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionToken: (credential as any).sessionToken,
      },
    });

    // Step 1: Discover services/metrics
    const namespacesToCheck = namespaces?.length
      ? namespaces
      : ["AWS/ECS", "AWS/EC2", "AWS/Lambda", "AWS/RDS", "AWS/ELB", "AWS/ElastiCache"];

    const serviceMetrics: ServiceMetric[] = [];

    for (const ns of namespacesToCheck) {
      try {
        const listCmd = new ListMetricsCommand({ Namespace: ns });
        const listRes = await client.send(listCmd);

        // Get top metrics per namespace
        const metricNames = [...new Set(listRes.Metrics?.map((m) => m.MetricName) || [])]
          .filter((m): m is string => m !== undefined)
          .slice(0, 5);

        for (const metricName of metricNames) {
          const statsCmd = new GetMetricStatisticsCommand({
            Namespace: ns,
            MetricName: metricName,
            StartTime: new Date(Date.now() - 3600000), // Last hour
            EndTime: new Date(),
            Period: 300, // 5 min intervals
            Statistics: ["Average"],
          });

          const statsRes = await client.send(statsCmd);
          const datapoints = statsRes.Datapoints || [];

          if (datapoints.length >= 3) {
            // Sort by timestamp
            datapoints.sort((a, b) => (a.Timestamp?.getTime() || 0) - (b.Timestamp?.getTime() || 0));

            serviceMetrics.push({
              serviceId: `${ns}:${metricName}`,
              metricName,
              namespace: ns,
              values: datapoints.map((d) => d.Average || 0),
              timestamps: datapoints.map((d) => d.Timestamp || new Date()),
            });
          }
        }
      } catch {
        // Skip namespaces we can't access
        continue;
      }
    }

    // Step 2: Detect anomalies across all services
    const anomalies: AnomalyFinding[] = [];
    const serviceAnomalyMap: Record<string, AnomalyFinding[]> = {};

    for (const sm of serviceMetrics) {
      const findings = detectAnomaliesInSeries(sm);
      if (findings.length > 0) {
        anomalies.push(...findings);
        serviceAnomalyMap[sm.serviceId] = findings;
      }
    }

    // Step 3: Determine root causes (services with most severe + earliest anomalies)
    const rootCauses: RootCauseResult["rootCauses"] = [];
    const servicesWithAnomalies = Object.entries(serviceAnomalyMap)
      .map(([service, findings]) => ({
        service,
        maxSeverity: Math.max(...findings.map((f) => severityToNumber(f.severity))),
        findingCount: findings.length,
        avgZScore: findings.reduce((s, f) => s + f.zScore, 0) / findings.length,
      }))
      .sort((a, b) => b.maxSeverity - a.maxSeverity || b.avgZScore - a.avgZScore);

    for (const svc of servicesWithAnomalies.slice(0, 5)) {
      const [namespace, metricName] = svc.service.split(":");
      const impactedServices = servicesWithAnomalies
        .filter((s) => s.service !== svc.service)
        .slice(0, 3)
        .map((s) => s.service);

      rootCauses.push({
        service: svc.service,
        impactScore: Math.min(1, svc.avgZScore / 5),
        impactedServices,
        likelyRootCause: svc.maxSeverity >= 3 && impactedServices.length > 0,
        explanation: generateExplanation(namespace, metricName, svc),
      });
    }

    // Step 4: Generate summary
    const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
    const highCount = anomalies.filter((a) => a.severity === "high").length;
    const likelyRootCauseCount = rootCauses.filter((r) => r.likelyRootCause).length;

    const summary = criticalCount > 0
      ? `🔴 ${criticalCount} critical and ${highCount} high-severity anomalies detected across ${servicesWithAnomalies.length} services. ${likelyRootCauseCount} likely root cause(s) identified.`
      : anomalies.length > 0
        ? `🟡 ${anomalies.length} anomalies detected. System is operational but monitor closely.`
        : "✅ No anomalies detected. All services operating normally.";

    const result: RootCauseResult = {
      timestamp: new Date().toISOString(),
      credentialId,
      servicesAnalyzed: serviceMetrics.length,
      anomalies,
      rootCauses,
      summary,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Root Cause Analysis] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ── Helpers ──

function detectAnomaliesInSeries(sm: ServiceMetric): AnomalyFinding[] {
  const n = sm.values.length;
  if (n < 3) return [];

  const mean = sm.values.reduce((s, v) => s + v, 0) / n;
  const variance = sm.values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  const findings: AnomalyFinding[] = [];

  for (let i = 0; i < n; i++) {
    const zScore = Math.abs((sm.values[i] - mean) / stdDev);
    if (zScore > 2.5) {
      const severity =
        zScore > 4 ? "critical" : zScore > 3.5 ? "high" : zScore > 3 ? "medium" : "low";

      findings.push({
        service: `${sm.namespace}:${sm.metricName}`,
        metric: sm.metricName,
        severity,
        zScore,
        currentValue: sm.values[i],
        baselineMean: mean,
        baselineStd: stdDev,
        description: `${sm.metricName} on ${sm.namespace} is ${zScore.toFixed(1)}σ from baseline (${sm.values[i].toFixed(2)} vs ${mean.toFixed(2)})`,
        recommendation: getRecommendation(sm.namespace, sm.metricName, severity),
      });
    }
  }

  return findings;
}

function severityToNumber(s: string): number {
  return s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
}

function getRecommendation(namespace: string, metricName: string, severity: string): string {
  if (namespace === "AWS/ECS") {
    if (metricName === "CPUUtilization") return "Consider scaling ECS tasks or optimizing container CPU limits.";
    if (metricName === "MemoryUtilization") return "Check for memory leaks or increase task memory allocation.";
    return "Review ECS service configuration and task definitions.";
  }
  if (namespace === "AWS/EC2") {
    if (metricName === "CPUUtilization") return "Consider auto-scaling group changes or right-sizing instances.";
    if (metricName === "NetworkOut") return "Check for traffic spikes or DDoS protection.";
    return "Review EC2 instance health and CloudWatch alarms.";
  }
  if (namespace === "AWS/Lambda") {
    if (metricName === "Errors") return "Investigate Lambda function errors. Check CloudWatch Logs.";
    if (metricName === "Duration") return "Optimize function code or increase memory allocation.";
    if (metricName === "Throttles") return "Increase reserved concurrency or review scaling configuration.";
    return "Review Lambda function configuration and monitoring.";
  }
  if (namespace === "AWS/RDS") {
    if (metricName === "DatabaseConnections") return "Check connection pooling or increase max connections.";
    if (metricName === "CPUUtilization") return "Consider read replicas or instance upgrade.";
    return "Review RDS performance insights and parameter groups.";
  }
  return "Investigate the anomaly and review service dashboards.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateExplanation(namespace: string, metricName: string, svc: any): string {
  const base = `${metricName} on ${namespace} shows abnormal behavior`;
  if (svc.maxSeverity >= 3) {
    return `${base} with high severity (z-score: ${svc.avgZScore.toFixed(1)}). This is likely the root cause affecting downstream services.`;
  }
  return `${base}. Monitor closely as it may indicate an emerging issue.`;
}
import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";

export const dynamic = "force-dynamic";

// ── Simple statistical anomaly detection ──
// Uses Z-score method: values more than N standard deviations from mean are anomalies

function detectAnomalies(
  values: number[],
  threshold: number = 2.5
): { index: number; value: number; zScore: number; severity: string }[] {
  const n = values.length;
  if (n < 3) return [];

  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  return values
    .map((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev);
      let severity = "info";
      if (zScore > threshold * 1.5) severity = "critical";
      else if (zScore > threshold) severity = "warning";
      return { index, value, zScore: Math.round(zScore * 100) / 100, severity };
    })
    .filter((a) => a.zScore > threshold);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      credentialId,
      namespace,
      metricName,
      dimensions,
      timeRange = "24h",
      stat = "Average",
      anomalyThreshold = 2.5,
    } = body;

    if (!credentialId) {
      return NextResponse.json(
        { error: "Missing required param: credentialId" },
        { status: 400 }
      );
    }

    const cred = await getCredentialById(credentialId);
    if (!cred) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    const cwClient = new CloudWatchClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    // Fetch historical data with 5-minute granularity
    const now = new Date();
    const startTime = new Date(
      now.getTime() - (timeRange === "1h" ? 3600000 :
                       timeRange === "6h" ? 21600000 :
                       timeRange === "7d" ? 604800000 :
                       timeRange === "30d" ? 2592000000 :
                       86400000) // default 24h
    );

    const command = new GetMetricStatisticsCommand({
      Namespace: namespace || "AWS/EC2",
      MetricName: metricName || "CPUUtilization",
      Dimensions: dimensions || [],
      StartTime: startTime,
      EndTime: now,
      Period: 300, // 5 minutes
      Statistics: [stat],
    });

    const response = await cwClient.send(command);
    const datapoints = (response.Datapoints || [])
      .sort((a, b) => (a.Timestamp?.getTime() || 0) - (b.Timestamp?.getTime() || 0))
      .map((dp) => ({
        timestamp: dp.Timestamp?.toISOString(),
        value: dp[stat as keyof typeof dp] as number,
      }));

    const values = datapoints.map((dp) => dp.value);
    const anomalies = detectAnomalies(values, anomalyThreshold);

    // Calculate simple forecast (linear regression)
    const forecast = forecastValues(values, 12); // 12 periods ahead (1 hour at 5-min intervals)

    return NextResponse.json({
      metadata: {
        namespace: namespace || "AWS/EC2",
        metric: metricName || "CPUUtilization",
        period: "5m",
        dataPoints: datapoints.length,
        anomaliesFound: anomalies.length,
        threshold: anomalyThreshold,
      },
      datapoints,
      anomalies: anomalies.map((a) => ({
        ...a,
        timestamp: datapoints[a.index]?.timestamp,
      })),
      forecast: forecast.map((v, i) => ({
        timestamp: new Date(
          now.getTime() + (i + 1) * 5 * 60 * 1000
        ).toISOString(),
        value: Math.round(v * 100) / 100,
      })),
      statistics: {
        mean: Math.round(
          (values.reduce((s, v) => s + v, 0) / values.length) * 100
        ) / 100 || 0,
        min: Math.round(Math.min(...values) * 100) / 100 || 0,
        max: Math.round(Math.max(...values) * 100) / 100 || 0,
        stdDev: Math.round(
          Math.sqrt(
            values.reduce((s, v) => s + (v - values.reduce((a, b) => a + b, 0) / values.length) ** 2, 0) /
            (values.length - 1)
          ) * 100
        ) / 100 || 0,
      },
    });
  } catch (error) {
    console.error("POST /api/ml/anomalies error:", error);
    return NextResponse.json(
      { error: "Failed to analyze metrics" },
      { status: 500 }
    );
  }
}

// ── Simple linear regression forecast ──
function forecastValues(values: number[], steps: number): number[] {
  if (values.length < 2) return Array(steps).fill(values[0] || 0);

  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    const yDiff = values[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Clamp forecast to reasonable bounds (0-100 for percentages)
  return Array.from({ length: steps }, (_, i) => {
    const predicted = intercept + slope * (n + i);
    return Math.max(0, Math.min(100, predicted));
  });
}
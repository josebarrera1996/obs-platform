import { NextRequest, NextResponse } from "next/server";
import { sendSlackAlert, buildServiceAlert } from "@/lib/slack";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, webhookUrl, serviceName, metric, value, threshold, severity, namespace, region } = body;

    if (action === "test") {
      if (!webhookUrl) {
        // Try env var
        const envUrl = process.env.SLACK_WEBHOOK_URL;
        if (!envUrl) {
          return NextResponse.json(
            { ok: false, error: "No Slack webhook URL configured. Set SLACK_WEBHOOK_URL in .env.local or pass webhookUrl." },
            { status: 400 }
          );
        }
        const result = await sendSlackAlert(
          {
            text: "🔔 *ObsPlatform Test Alert* — This is a test message to verify Slack integration.",
            attachments: [
              {
                color: "good",
                title: "Test Alert",
                text: "If you can read this, your Slack webhook is configured correctly!",
                footer: "ObsPlatform Alerting",
                ts: Math.floor(Date.now() / 1000),
              },
            ],
          },
          envUrl
        );
        return NextResponse.json(result);
      }

      const result = await sendSlackAlert(
        {
          text: "🔔 *ObsPlatform Test Alert* — This is a test message to verify Slack integration.",
          attachments: [
            {
              color: "good",
              title: "Test Alert",
              text: "If you can read this, your Slack webhook is configured correctly!",
              footer: "ObsPlatform Alerting",
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        },
        webhookUrl
      );
      return NextResponse.json(result);
    }

    if (action === "alert") {
      const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;
      if (!url) {
        return NextResponse.json(
          { ok: false, error: "No Slack webhook URL configured" },
          { status: 400 }
        );
      }

      const result = await sendSlackAlert(
        buildServiceAlert({
          serviceName: serviceName || "Unknown Service",
          metric: metric || "Unknown Metric",
          value: value || 0,
          threshold: threshold || 0,
          severity: severity || "warning",
          namespace: namespace || "AWS/Unknown",
          region: region || "unknown",
          currentValue: value || 0,
          unit: body.unit || "%",
        }),
        url
      );
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action. Use 'test' or 'alert'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/alerts/slack error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to send Slack message" },
      { status: 500 }
    );
  }
}
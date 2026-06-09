// ── Slack Notification Utility ──
// Sends alerts to a Slack channel via webhook.

const DEFAULT_WEBHOOK = process.env.SLACK_WEBHOOK_URL || "";
const DEFAULT_CHANNEL = process.env.SLACK_ALERT_CHANNEL || "#ops-alerts";

export interface SlackMessage {
  text?: string;
  channel?: string;
  username?: string;
  icon_emoji?: string;
  attachments?: SlackAttachment[];
}

export interface SlackAttachment {
  color?: "good" | "warning" | "danger" | string;
  title?: string;
  text?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  footer?: string;
  ts?: number;
}

export async function sendSlackAlert(
  message: SlackMessage,
  webhookUrl?: string
): Promise<{ ok: boolean; error?: string }> {
  const url = webhookUrl || DEFAULT_WEBHOOK;
  if (!url) {
    return { ok: false, error: "SLACK_WEBHOOK_URL not configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: message.channel || DEFAULT_CHANNEL,
        username: message.username || "ObsPlatform",
        icon_emoji: message.icon_emoji || ":chart_with_upwards_trend:",
        text: message.text,
        attachments: message.attachments,
      }),
    });

    // Slack webhooks return 200 OK with "ok: true" on success
    // Invalid webhooks return 404 from the HTTP response itself
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      return { ok: false, error: `Slack API error (${res.status}): ${text}` };
    }

    const body = await res.json().catch(() => null);
    if (body?.ok === false) {
      return { ok: false, error: `Slack API error: ${body.error || "unknown"}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export function buildServiceAlert(params: {
  serviceName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: "critical" | "warning";
  namespace: string;
  region: string;
  currentValue: number;
  unit: string;
}): SlackMessage {
  const color = params.severity === "critical" ? "danger" : "warning";
  const emoji = params.severity === "critical" ? ":rotating_light:" : ":warning:";

  return {
    text: `${emoji} *${params.severity.toUpperCase()}*: ${params.serviceName} — ${params.metric}`,
    attachments: [
      {
        color,
        title: `${params.serviceName} — ${params.metric}`,
        fields: [
          { title: "Current", value: `${params.currentValue.toFixed(2)} ${params.unit}`, short: true },
          { title: "Threshold", value: `${params.threshold} ${params.unit}`, short: true },
          { title: "Value", value: `${params.value.toFixed(2)} ${params.unit}`, short: true },
          { title: "Region", value: params.region, short: true },
          { title: "Namespace", value: params.namespace, short: true },
        ],
        footer: "ObsPlatform Alert",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

export function buildIncidentAlert(params: {
  eventName: string;
  eventSource: string;
  eventTime: string;
  severity: "critical" | "warning";
  description: string;
}): SlackMessage {
  const color = params.severity === "critical" ? "danger" : "warning";
  const emoji = params.severity === "critical" ? ":rotating_light:" : ":warning:";

  return {
    text: `${emoji} *Incident: ${params.eventName}*`,
    attachments: [
      {
        color,
        title: params.eventName,
        text: params.description,
        fields: [
          { title: "Source", value: params.eventSource, short: true },
          { title: "Severity", value: params.severity.toUpperCase(), short: true },
          { title: "Time", value: params.eventTime, short: false },
        ],
        footer: "ObsPlatform Incidents",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}
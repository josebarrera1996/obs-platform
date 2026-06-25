import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  DescribeLogGroupsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

export interface LogRecord {
  [field: string]: string;
}

const TIME_RANGE_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export function resolveLogTimeRange(timeRange: string = "24h"): {
  startTime: number;
  endTime: number;
} {
  const endTime = Date.now();
  const startTime = endTime - (TIME_RANGE_MS[timeRange] ?? TIME_RANGE_MS["24h"]);
  return { startTime, endTime };
}

export function parseQueryResults(
  rows: { field?: string; value?: string }[][] | undefined
): LogRecord[] {
  if (!rows) return [];
  return rows.map((row) => {
    const record: LogRecord = {};
    for (const cell of row) {
      if (cell.field && cell.value !== undefined) {
        record[cell.field] = cell.value;
      }
    }
    return record;
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listLogGroups(
  client: CloudWatchLogsClient,
  options?: { prefix?: string; limit?: number }
): Promise<{ name: string; storedBytes?: number }[]> {
  const groups: { name: string; storedBytes?: number }[] = [];
  let nextToken: string | undefined;

  do {
    const response = await client.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: options?.prefix || undefined,
        nextToken,
        limit: Math.min(options?.limit ?? 50, 50),
      })
    );
    for (const g of response.logGroups || []) {
      if (g.logGroupName) {
        groups.push({ name: g.logGroupName, storedBytes: g.storedBytes });
      }
    }
    nextToken = response.nextToken;
    if (options?.limit && groups.length >= options.limit) break;
  } while (nextToken);

  return options?.limit ? groups.slice(0, options.limit) : groups;
}

export interface RunLogsQueryOptions {
  client: CloudWatchLogsClient;
  logGroupNames: string[];
  query: string;
  timeRange?: string;
  startTime?: number;
  endTime?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export async function runLogsInsightsQuery(
  options: RunLogsQueryOptions
): Promise<{ records: LogRecord[]; statistics?: Record<string, number> }> {
  const { client, logGroupNames, query, timeRange = "24h" } = options;

  if (logGroupNames.length === 0) {
    throw new Error("At least one log group is required");
  }
  if (!query.trim()) {
    throw new Error("Query string is required");
  }

  const range =
    options.startTime !== undefined && options.endTime !== undefined
      ? { startTime: options.startTime, endTime: options.endTime }
      : resolveLogTimeRange(timeRange);

  const startResponse = await client.send(
    new StartQueryCommand({
      logGroupNames,
      queryString: query,
      startTime: Math.floor(range.startTime / 1000),
      endTime: Math.floor(range.endTime / 1000),
    })
  );

  const queryId = startResponse.queryId;
  if (!queryId) {
    throw new Error("Failed to start CloudWatch Logs Insights query");
  }

  const pollInterval = options.pollIntervalMs ?? 600;
  const maxAttempts = options.maxPollAttempts ?? 45;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);
    const result = await client.send(new GetQueryResultsCommand({ queryId }));

    if (result.status === "Complete") {
      return {
        records: parseQueryResults(result.results),
        statistics: result.statistics as Record<string, number> | undefined,
      };
    }
    if (result.status === "Failed" || result.status === "Cancelled") {
      throw new Error(`Logs query ${result.status?.toLowerCase()}`);
    }
  }

  throw new Error("Logs query timed out");
}

/** Suggest default Lambda log group from function name / service id */
export function suggestLogGroupsForService(
  serviceType: string,
  serviceId: string
): string[] {
  if (serviceType === "Lambda") {
    const fnName = serviceId.replace(/^Lambda:\s*/i, "").trim();
    return [`/aws/lambda/${fnName}`];
  }
  if (serviceType === "ECS") {
    return [];
  }
  return [];
}

export const DEFAULT_LOGS_QUERY = `fields @timestamp, @message
| sort @timestamp desc
| limit 20`;

export const ERROR_LOGS_QUERY = `fields @timestamp, @message
| filter @message like /(?i)(error|exception|fail|timeout)/
| sort @timestamp desc
| limit 50`;

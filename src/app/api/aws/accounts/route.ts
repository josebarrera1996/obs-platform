import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import { CloudWatchClient, ListMetricsCommand } from "@aws-sdk/client-cloudwatch";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const credentialId = searchParams.get("credentialId");

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

    // First, verify the credentials are valid by calling STS GetCallerIdentity
    const stsClient = new STSClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    let accountId: string;
    try {
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));
      accountId = identity.Account || "unknown";
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        {
          error: "Invalid AWS credentials",
          details: errorMessage,
        },
        { status: 401 }
      );
    }

    // Fetch CloudWatch namespaces to discover services
    const cwClient = new CloudWatchClient({
      region: cred.region,
      credentials: {
        accessKeyId: cred.accessKeyId,
        secretAccessKey: cred.secretAccessKey,
      },
    });

    const metricsResponse = await cwClient.send(
      new ListMetricsCommand({})
    );

    // Group metrics by namespace to discover services
    const namespaceMap = new Map<
      string,
      { namespace: string; metrics: number; dimensions: string[] }
    >();

    for (const metric of metricsResponse.Metrics || []) {
      if (metric.Namespace) {
        const existing = namespaceMap.get(metric.Namespace);
        if (existing) {
          existing.metrics++;
          metric.Dimensions?.forEach((d) => {
            if (d.Name && !existing.dimensions.includes(d.Name)) {
              existing.dimensions.push(d.Name);
            }
          });
        } else {
          namespaceMap.set(metric.Namespace, {
            namespace: metric.Namespace,
            metrics: 1,
            dimensions: metric.Dimensions?.map((d) => d.Name || "").filter(Boolean) || [],
          });
        }
      }
    }

    // Return the account info + discovered services
    const services = Array.from(namespaceMap.entries())
      .filter(([ns]) =>
        // Filter to common AWS service namespaces
        ns.startsWith("AWS/") || ns.includes("Service")
      )
      .map(([ns, info]) => ({
        id: `${credentialId}-${ns.replace(/\//g, "-").toLowerCase()}`,
        name: ns.replace("AWS/", ""),
        namespace: ns,
        metricsCount: info.metrics,
        dimensions: info.dimensions,
        region: cred.region,
      }));

    return NextResponse.json({
      id: credentialId,
      accountId,
      alias: cred.alias,
      region: cred.region,
      status: "healthy",
      services,
      servicesCount: services.length,
      uptime: 99.9,
    });
  } catch (error) {
    console.error("GET /api/aws/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AWS data" },
      { status: 500 }
    );
  }
}

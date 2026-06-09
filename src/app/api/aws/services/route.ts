import { NextRequest, NextResponse } from "next/server";
import { getCredentialById } from "@/lib/storage";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { ECSClient, ListClustersCommand, ListServicesCommand, DescribeServicesCommand } from "@aws-sdk/client-ecs";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { ElastiCacheClient, DescribeCacheClustersCommand } from "@aws-sdk/client-elasticache";
import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";
import { SNSClient, ListTopicsCommand } from "@aws-sdk/client-sns";

export const dynamic = "force-dynamic";

interface ServiceResult {
  id: string;
  name: string;
  namespace: string;
  type: string;
  status: string;
  region: string;
  metrics: { name: string; unit: string }[];
  dimensions?: Record<string, string>;
}

// Map of all AWS namespaces to their discovery config
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _NAMESPACE_DISCOVERERS: {
  namespace: string;
  label: string;
  icon: string;
  discover: (client: Record<string, unknown>, region: string) => Promise<ServiceResult[]>;
}[] = [];

function createClients(cred: { accessKeyId: string; secretAccessKey: string; region: string }) {
  const baseConfig = {
    region: cred.region,
    credentials: {
      accessKeyId: cred.accessKeyId,
      secretAccessKey: cred.secretAccessKey,
    },
  };

  return {
    ec2: new EC2Client(baseConfig),
    rds: new RDSClient(baseConfig),
    elbv2: new ElasticLoadBalancingV2Client(baseConfig),
    lambda: new LambdaClient(baseConfig),
    ecs: new ECSClient(baseConfig),
    dynamodb: new DynamoDBClient(baseConfig),
    s3: new S3Client({ ...baseConfig, region: "us-east-1" }), // S3 uses global endpoint
    elasticache: new ElastiCacheClient(baseConfig),
    sqs: new SQSClient(baseConfig),
    sns: new SNSClient(baseConfig),
    cloudwatch: new CloudWatchClient(baseConfig),
  };
}

async function discoverEC2(ec2Client: EC2Client, region: string): Promise<ServiceResult[]> {
  try {
    const response = await ec2Client.send(new DescribeInstancesCommand({}));
    const services: ServiceResult[] = [];
    for (const reservation of response.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        if (!instance.InstanceId) continue;
        const name = instance.Tags?.find((t) => t.Key === "Name")?.Value || instance.InstanceId;
        const state = instance.State?.Name || "unknown";
        services.push({
          id: instance.InstanceId,
          name: `EC2: ${name}`,
          namespace: "AWS/EC2",
          type: "EC2",
          status: state === "running" ? "healthy" : state === "stopped" ? "degraded" : "critical",
          region,
          metrics: [
            { name: "CPUUtilization", unit: "Percent" },
            { name: "NetworkIn", unit: "Bytes" },
            { name: "NetworkOut", unit: "Bytes" },
            { name: "DiskReadOps", unit: "Count" },
            { name: "DiskWriteOps", unit: "Count" },
          ],
        });
      }
    }
    return services;
  } catch {
    return [];
  }
}

async function discoverRDS(rdsClient: RDSClient, region: string): Promise<ServiceResult[]> {
  try {
    const response = await rdsClient.send(new DescribeDBInstancesCommand({}));
    return (response.DBInstances || []).filter((db) => db.DBInstanceIdentifier).map((db) => ({
      id: db.DBInstanceIdentifier!,
      name: `RDS: ${db.DBInstanceIdentifier}`,
      namespace: "AWS/RDS",
      type: "RDS",
      status: db.DBInstanceStatus === "available" ? "healthy" : "degraded",
      region,
      metrics: [
        { name: "CPUUtilization", unit: "Percent" },
        { name: "DatabaseConnections", unit: "Count" },
        { name: "FreeableMemory", unit: "Bytes" },
        { name: "ReadLatency", unit: "Seconds" },
        { name: "WriteLatency", unit: "Seconds" },
      ],
    }));
  } catch {
    return [];
  }
}

async function discoverELB(elbClient: ElasticLoadBalancingV2Client, region: string): Promise<ServiceResult[]> {
  try {
    const response = await elbClient.send(new DescribeLoadBalancersCommand({}));
    return (response.LoadBalancers || []).filter((lb) => lb.LoadBalancerName).map((lb) => ({
      id: lb.LoadBalancerArn?.split("/").pop() || lb.LoadBalancerName!,
      name: `ALB/NLB: ${lb.LoadBalancerName}`,
      namespace: "AWS/ApplicationELB",
      type: lb.Type === "network" ? "NLB" : "ALB",
      status: lb.State?.Code === "active" ? "healthy" : "degraded",
      region,
      metrics: [
        { name: "RequestCount", unit: "Count" },
        { name: "TargetResponseTime", unit: "Seconds" },
        { name: "HTTPCode_ELB_5XX", unit: "Count" },
        { name: "ActiveConnectionCount", unit: "Count" },
        { name: "NewConnectionCount", unit: "Count" },
      ],
    }));
  } catch {
    return [];
  }
}

async function discoverLambda(lambdaClient: LambdaClient, region: string): Promise<ServiceResult[]> {
  try {
    const response = await lambdaClient.send(new ListFunctionsCommand({}));
    return (response.Functions || []).filter((fn) => fn.FunctionName).map((fn) => ({
      id: fn.FunctionName!,
      name: `Lambda: ${fn.FunctionName}`,
      namespace: "AWS/Lambda",
      type: "Lambda",
      status: "healthy",
      region,
      metrics: [
        { name: "Invocations", unit: "Count" },
        { name: "Errors", unit: "Count" },
        { name: "Duration", unit: "Milliseconds" },
        { name: "Throttles", unit: "Count" },
        { name: "ConcurrentExecutions", unit: "Count" },
      ],
    }));
  } catch {
    return [];
  }
}

async function discoverECS(ecsClient: ECSClient, region: string): Promise<ServiceResult[]> {
  try {
    const services: ServiceResult[] = [];
    const clusterResp = await ecsClient.send(new ListClustersCommand({}));
    const clusterArns = clusterResp.clusterArns || [];
    
    for (const clusterArn of clusterArns.slice(0, 5)) { // limit to 5 clusters
      const clusterName = clusterArn.split("/").pop() || clusterArn;
      const svcResp = await ecsClient.send(new ListServicesCommand({ cluster: clusterArn }));
      const serviceArns = svcResp.serviceArns || [];
      if (serviceArns.length > 0) {
        const descResp = await ecsClient.send(new DescribeServicesCommand({
          cluster: clusterArn,
          services: serviceArns,
        }));
        for (const svc of descResp.services || []) {
          if (!svc.serviceName) continue;
          const status = svc.desiredCount && svc.runningCount && svc.runningCount >= svc.desiredCount
            ? "healthy" : svc.runningCount && svc.runningCount > 0 ? "degraded" : "critical";
          services.push({
            id: svc.serviceName,
            dimensions: { ClusterName: clusterName, ServiceName: svc.serviceName },
            name: `ECS: ${svc.serviceName} (${clusterName})`,
            namespace: "AWS/ECS",
            type: "ECS",
            status,
            region,
            metrics: [
              { name: "CPUUtilization", unit: "Percent" },
              { name: "MemoryUtilization", unit: "Percent" },
              { name: "RunningTaskCount", unit: "Count" },
              { name: "PendingTaskCount", unit: "Count" },
            ],
          });
        }
      }
    }
    return services;
  } catch {
    return [];
  }
}

async function discoverDynamoDB(ddbClient: DynamoDBClient, region: string): Promise<ServiceResult[]> {
  try {
    const response = await ddbClient.send(new ListTablesCommand({}));
    const tables = response.TableNames || [];
    const services: ServiceResult[] = [];
    
    for (const tableName of tables.slice(0, 20)) { // limit to 20 tables
      services.push({
        id: `dynamodb-${tableName}`,
        name: `DynamoDB: ${tableName}`,
        namespace: "AWS/DynamoDB",
        type: "DynamoDB",
        status: "healthy",
        region,
        metrics: [
          { name: "ConsumedReadCapacityUnits", unit: "Count" },
          { name: "ConsumedWriteCapacityUnits", unit: "Count" },
          { name: "ReadThrottleEvents", unit: "Count" },
          { name: "WriteThrottleEvents", unit: "Count" },
          { name: "SystemErrors", unit: "Count" },
        ],
      });
    }
    return services;
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function discoverS3(s3Client: S3Client, _region: string): Promise<ServiceResult[]> {
  try {
    const response = await s3Client.send(new ListBucketsCommand({}));
    return (response.Buckets || []).filter((b) => b.Name).map((bucket) => ({
      id: `s3-${bucket.Name}`,
      name: `S3: ${bucket.Name}`,
      namespace: "AWS/S3",
      type: "S3",
      status: "healthy",
      region: "global",
      metrics: [
        { name: "BucketSizeBytes", unit: "Bytes" },
        { name: "NumberOfObjects", unit: "Count" },
        { name: "AllRequests", unit: "Count" },
        { name: "GetRequests", unit: "Count" },
        { name: "PutRequests", unit: "Count" },
        { name: "4xxErrors", unit: "Count" },
        { name: "5xxErrors", unit: "Count" },
      ],
    }));
  } catch {
    return [];
  }
}

async function discoverElastiCache(ecClient: ElastiCacheClient, region: string): Promise<ServiceResult[]> {
  try {
    const response = await ecClient.send(new DescribeCacheClustersCommand({}));
    return (response.CacheClusters || []).filter((c) => c.CacheClusterId).map((c) => ({
      id: c.CacheClusterId!,
      name: `ElastiCache: ${c.CacheClusterId}`,
      namespace: "AWS/ElastiCache",
      type: "ElastiCache",
      status: c.CacheClusterStatus === "available" ? "healthy" : "degraded",
      region,
      metrics: [
        { name: "CPUUtilization", unit: "Percent" },
        { name: "FreeableMemory", unit: "Bytes" },
        { name: "CacheHits", unit: "Count" },
        { name: "CacheMisses", unit: "Count" },
        { name: "CurrConnections", unit: "Count" },
      ],
    }));
  } catch {
    return [];
  }
}

async function discoverSQS(sqsClient: SQSClient, region: string): Promise<ServiceResult[]> {
  try {
    const response = await sqsClient.send(new ListQueuesCommand({}));
    return (response.QueueUrls || []).filter((url) => url).map((url) => {
      const name = url.split("/").pop() || url;
      return {
        id: `sqs-${name}`,
        name: `SQS: ${name}`,
        namespace: "AWS/SQS",
        type: "SQS",
        status: "healthy",
        region,
        metrics: [
          { name: "ApproximateNumberOfMessagesVisible", unit: "Count" },
          { name: "ApproximateNumberOfMessagesDelayed", unit: "Count" },
          { name: "ApproximateNumberOfMessagesNotVisible", unit: "Count" },
          { name: "NumberOfMessagesSent", unit: "Count" },
          { name: "NumberOfMessagesReceived", unit: "Count" },
        ],
      };
    });
  } catch {
    return [];
  }
}

async function discoverSNS(snsClient: SNSClient, region: string): Promise<ServiceResult[]> {
  try {
    const response = await snsClient.send(new ListTopicsCommand({}));
    return (response.Topics || []).filter((t) => t.TopicArn).map((t) => {
      const name = t.TopicArn!.split(":").pop() || t.TopicArn!;
      return {
        id: `sns-${name}`,
        name: `SNS: ${name}`,
        namespace: "AWS/SNS",
        type: "SNS",
        status: "healthy",
        region,
        metrics: [
          { name: "NumberOfMessagesPublished", unit: "Count" },
          { name: "NumberOfNotificationsDelivered", unit: "Count" },
          { name: "NumberOfNotificationsFailed", unit: "Count" },
        ],
      };
    });
  } catch {
    return [];
  }
}

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

    const clients = createClients(cred);
    const region = cred.region;

    // Discover all services in parallel
    const results = await Promise.allSettled([
      discoverEC2(clients.ec2, region),
      discoverRDS(clients.rds, region),
      discoverELB(clients.elbv2, region),
      discoverLambda(clients.lambda, region),
      discoverECS(clients.ecs, region),
      discoverDynamoDB(clients.dynamodb, region),
      discoverS3(clients.s3, region),
      discoverElastiCache(clients.elasticache, region),
      discoverSQS(clients.sqs, region),
      discoverSNS(clients.sns, region),
    ]);

    const allServices: ServiceResult[] = [];
    const errors: string[] = [];

    const discoverers = ["EC2", "RDS", "ELB", "Lambda", "ECS", "DynamoDB", "S3", "ElastiCache", "SQS", "SNS"];

    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        allServices.push(...result.value);
        if (result.value.length > 0) {
          console.log(`[AWS] Discovered ${result.value.length} ${discoverers[idx]} resources`);
        }
      } else {
        console.warn(`[AWS] Failed to discover ${discoverers[idx]}:`, result.reason?.message || result.reason);
        errors.push(`${discoverers[idx]}: ${result.reason?.message || "Unknown error"}`);
      }
    });

    // Aggregate service counts by namespace
    const byNamespace = allServices.reduce((acc, svc) => {
      acc[svc.namespace] = (acc[svc.namespace] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      services: allServices,
      totalCount: allServices.length,
      byNamespace,
      errors: errors.length > 0 ? errors : undefined,
      region,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/aws/services error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AWS services" },
      { status: 500 }
    );
  }
}
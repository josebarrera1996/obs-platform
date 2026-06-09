import { NextRequest, NextResponse } from "next/server";
import { getCredentialById, updateCredential } from "@/lib/storage";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, accessKeyId, secretAccessKey, region } = body;

    // Use credentials from the body if provided (for new/unsaved), otherwise from storage
    let cred;
    if (id) {
      cred = await getCredentialById(id);
      if (!cred) {
        return NextResponse.json(
          { error: "Credential not found" },
          { status: 404 }
        );
      }
    }

    const stsClient = new STSClient({
      region: region || cred?.region || "us-east-1",
      credentials: {
        accessKeyId: accessKeyId || cred?.accessKeyId || "",
        secretAccessKey: secretAccessKey || cred?.secretAccessKey || "",
      },
    });

    const identity = await stsClient.send(new GetCallerIdentityCommand({}));

    // If this was a saved credential, update its status
    if (id) {
      await updateCredential(id, {
        status: "valid",
        lastTestedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      valid: true,
      accountId: identity.Account,
      arn: identity.Arn,
      userId: identity.UserId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // If this was a saved credential, update its status to invalid
    if (typeof (error as Record<string, unknown>).body === "object") {
      // Can't extract id from error, it's in the request body
    }

    return NextResponse.json(
      {
        valid: false,
        error: "Invalid AWS credentials",
        details: errorMessage,
      },
      { status: 401 }
    );
  }
}

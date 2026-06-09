import { NextRequest, NextResponse } from "next/server";
import {
  getAllCredentials,
  addCredential,
  updateCredential,
  deleteCredential,
} from "@/lib/storage";

export async function GET() {
  try {
    const creds = await getAllCredentials();
    // Never send secretAccessKey to the client
    const safe = creds.map(({ secretAccessKey, ...rest }) => ({
      ...rest,
      maskedKey: secretAccessKey
        ? secretAccessKey.slice(0, 4) + "****" + secretAccessKey.slice(-4)
        : "",
    }));
    return NextResponse.json(safe);
  } catch (error) {
    console.error("GET /api/credentials error:", error);
    return NextResponse.json(
      { error: "Failed to fetch credentials" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alias, accessKeyId, secretAccessKey, region } = body;

    if (!alias || !accessKeyId || !secretAccessKey || !region) {
      return NextResponse.json(
        { error: "Missing required fields: alias, accessKeyId, secretAccessKey, region" },
        { status: 400 }
      );
    }

    const cred = await addCredential({
      alias,
      accessKeyId,
      secretAccessKey,
      region,
    });

    return NextResponse.json(
      { ...cred, secretAccessKey: undefined, maskedKey: cred.secretAccessKey.slice(0, 4) + "****" + cred.secretAccessKey.slice(-4) },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/credentials error:", error);
    return NextResponse.json(
      { error: "Failed to create credential" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, alias, accessKeyId, secretAccessKey, region, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (alias !== undefined) updateData.alias = alias;
    if (accessKeyId !== undefined) updateData.accessKeyId = accessKeyId;
    if (secretAccessKey !== undefined) updateData.secretAccessKey = secretAccessKey;
    if (region !== undefined) updateData.region = region;
    if (status !== undefined) updateData.status = status;

    const updated = await updateCredential(id, updateData);
    if (!updated) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...updated,
      secretAccessKey: undefined,
      maskedKey: updated.secretAccessKey.slice(0, 4) + "****" + updated.secretAccessKey.slice(-4),
    });
  } catch (error) {
    console.error("PUT /api/credentials error:", error);
    return NextResponse.json(
      { error: "Failed to update credential" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing required query param: id" },
        { status: 400 }
      );
    }

    const deleted = await deleteCredential(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/credentials error:", error);
    return NextResponse.json(
      { error: "Failed to delete credential" },
      { status: 500 }
    );
  }
}

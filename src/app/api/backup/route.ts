// ── Backup API ──
// Provides endpoints to create, list, and restore backups of credentials.json.

import { NextRequest, NextResponse } from "next/server";
import { createBackup, listBackups, restoreBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * GET /api/backup
 * Lists all available backups.
 */
export async function GET() {
  try {
    const backups = await listBackups();
    return NextResponse.json({ backups });
  } catch (error) {
    console.error("GET /api/backup error:", error);
    return NextResponse.json(
      { error: "Failed to list backups" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backup
 * Actions: "create" | "restore"
 * - create: creates a new backup
 * - restore: restores from a specific backup (requires backupPath in body)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const backupPath = await createBackup();
      if (!backupPath) {
        return NextResponse.json(
          { error: "No data files to back up" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        backupPath,
        message: `Backup created at ${backupPath}`,
      });
    }

    if (action === "restore") {
      const { backupPath } = body;
      if (!backupPath) {
        return NextResponse.json(
          { error: "Missing backupPath" },
          { status: 400 }
        );
      }
      const ok = await restoreBackup(backupPath);
      if (!ok) {
        return NextResponse.json(
          { error: "Backup path not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Backup restored successfully",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/backup error:", error);
    return NextResponse.json(
      { error: "Backup operation failed" },
      { status: 500 }
    );
  }
}
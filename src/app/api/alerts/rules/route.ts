import { NextRequest, NextResponse } from "next/server";
import {
  getRules,
  addRule,
  updateRule,
  deleteRule,
  evaluateAll,
} from "@/lib/alerts/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rules = getRules();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("GET /api/alerts/rules error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alert rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const rule = addRule(body.rule);
      return NextResponse.json({ rule }, { status: 201 });
    }

    if (action === "update") {
      const rule = updateRule(body.ruleId, body.updates);
      if (!rule) {
        return NextResponse.json(
          { error: "Rule not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ rule });
    }

    if (action === "delete") {
      const ok = deleteRule(body.ruleId);
      if (!ok) {
        return NextResponse.json(
          { error: "Rule not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "evaluate") {
      const results = evaluateAll(body.metrics || []);
      return NextResponse.json({ results });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/alerts/rules error:", error);
    return NextResponse.json(
      { error: "Failed to process alert rules" },
      { status: 500 }
    );
  }
}
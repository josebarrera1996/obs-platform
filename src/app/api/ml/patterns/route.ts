import { NextResponse } from "next/server";
import { detectPatterns, type PatternAnalysisResult } from "@/lib/ml/patterns";
import { analyzeCorrelations, generateCorrelationInsights, type CorrelationMatrix } from "@/lib/ml/correlation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/ml/patterns
 * Detect patterns and anomalies in time series data.
 *
 * Body:
 *   values: number[] (required) — time series data
 *   timestamps?: string[] — optional timestamps
 *   analyzeCorrelations?: boolean — also run correlation if multiple series
 *   series?: Record<string, number[]> — for correlation analysis
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { values, timestamps, analyzeCorrelations: doCorrelation, series } = body;

    if (!values && !series) {
      return NextResponse.json(
        { error: "values array or series map is required" },
        { status: 400 }
      );
    }

    let patterns: PatternAnalysisResult | null = null;
    let correlation: CorrelationMatrix | null = null;
    let insights: string[] = [];

    // Pattern detection on single series
    if (values && Array.isArray(values) && values.length >= 3) {
      patterns = detectPatterns(values, timestamps);
    }

    // Correlation analysis on multiple series
    if (doCorrelation && series && typeof series === "object") {
      const seriesKeys = Object.keys(series);
      if (seriesKeys.length >= 2) {
        // Validate all series have data
        const validSeries: Record<string, number[]> = {};
        for (const key of seriesKeys) {
          if (Array.isArray(series[key]) && series[key].length >= 3) {
            validSeries[key] = series[key];
          }
        }

        if (Object.keys(validSeries).length >= 2) {
          correlation = analyzeCorrelations(validSeries);
          insights = generateCorrelationInsights(correlation);
        }
      }
    }

    return NextResponse.json({
      success: true,
      patterns: patterns ? {
        summary: patterns.summary,
        stabilityScore: patterns.stabilityScore,
        changeVelocity: patterns.changeVelocity,
        dominantPattern: patterns.dominantPattern,
        patternCount: patterns.patterns.length,
        patterns: patterns.patterns.slice(0, 20), // top 20 patterns
      } : null,
      correlation: correlation ? {
        services: correlation.services,
        pairs: correlation.pairs.slice(0, 10), // top 10 pairs
        clustersCount: correlation.services.length,
        insights,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ML Patterns] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
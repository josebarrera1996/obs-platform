import { NextResponse } from "next/server";
import { prophetForecast, generateMLRecommendations, type ForecastConfig } from "@/lib/ml/predictor";
import { decomposeSeasonal } from "@/lib/ml/seasonal";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/ml/forecast
 * Generate Prophet-style forecast for a time series.
 *
 * Body:
 *   values: number[] (required) — historical time series data
 *   periods?: number — steps to forecast (default 12)
 *   config?: Partial<ForecastConfig>
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { values, periods, config } = body;

    if (!values || !Array.isArray(values) || values.length < 3) {
      return NextResponse.json(
        { error: "values array with at least 3 data points is required" },
        { status: 400 }
      );
    }

    const cfg: Partial<ForecastConfig> = {
      periods: periods || 12,
      ...(config || {}),
    };

    const result = prophetForecast(values, cfg);
    const recommendations = generateMLRecommendations(result);

    // Also provide decomposition for the historical data
    const decomposition = decomposeSeasonal(values);

    return NextResponse.json({
      success: true,
      forecast: result.forecast,
      upperBound: result.upperBound,
      lowerBound: result.lowerBound,
      confidence: result.confidence,
      components: result.components,
      metadata: result.metadata,
      recommendations,
      decomposition: {
        seasonality: decomposition.seasonality,
        strength: decomposition.strength,
        hasSeasonality: decomposition.strength.seasonal > 0.3,
        hasTrend: decomposition.strength.trend > 0.3,
      },
      patterns: {
        stabilityScore: result.patterns.stabilityScore,
        dominantPattern: result.patterns.dominantPattern,
        patterns: result.patterns.patterns.slice(0, 10), // top 10 patterns
        summary: result.patterns.summary,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ML Forecast] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
"use client";

import { useEffect, useState, useCallback } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useSettingsStore } from "@/store/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Activity,
  RefreshCw,
  Zap,
  BarChart3,
  Target,
  Layers,
  Sparkles,
  Network,
  Shield,
  LineChart,
  Info,
  Lightbulb,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ──

interface AnomalyResult {
  index: number;
  value: number;
  zScore: number;
  severity: string;
}

interface ForecastResult {
  forecast: number[];
  upperBound: number[];
  lowerBound: number[];
  confidence: number;
  recommendations: string[];
  metadata: {
    seasonalityDetected: number;
    trendStrength: number;
    seasonalStrength: number;
    noiseLevel: number;
  };
  patterns: {
    stabilityScore: number;
    dominantPattern: string;
    summary: string;
    patternCount: number;
  };
  decomposition?: {
    seasonality: number;
    hasSeasonality: boolean;
    hasTrend: boolean;
  };
}

interface CorrelationPair {
  serviceA: string;
  serviceB: string;
  correlation: number;
  strength: string;
  lag: number;
}

interface InsightsState {
  anomalies: AnomalyResult[];
  forecast: ForecastResult | null;
  correlation: { pairs: CorrelationPair[]; insights: string[] } | null;
  loading: boolean;
  error: string | null;
}

const DEFAULT_METRICS = [45, 48, 52, 50, 55, 58, 53, 60, 62, 57, 63, 65, 61, 68, 70, 66, 72, 75, 71, 78];

export default function InsightsPage() {
  const { activeCredentialId, credentials } = useSettingsStore();
  const [state, setState] = useState<InsightsState>({
    anomalies: [],
    forecast: null,
    correlation: null,
    loading: false,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<"anomalies" | "forecast" | "patterns" | "recommendations">("anomalies");

  const fetchInsights = useCallback(async () => {
    if (!activeCredentialId) return;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // 1. Fetch actual metrics from CloudWatch
      const metricsRes = await fetch(
        `/api/aws/metrics?credentialId=${activeCredentialId}&namespace=AWS/ECS&metricName=CPUUtilization&hours=6`
      );
      const metricsData = await metricsRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: number[] = metricsData?.datapoints?.map((d: any) => d.Average) || DEFAULT_METRICS;

      // 2. Fetch anomalies
      const anomaliesRes = await fetch("/api/ml/anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, threshold: 2.5 }),
      });
      const anomaliesData = await anomaliesRes.json();

      // 3. Fetch forecast
      const forecastRes = await fetch("/api/ml/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, periods: 12 }),
      });
      const forecastData = await forecastRes.json();

      // 4. Fetch patterns
      const patternsRes = await fetch("/api/ml/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const patternsData = await patternsRes.json();

      setState({
        anomalies: anomaliesData?.anomalies || [],
        forecast: {
          forecast: forecastData?.forecast || [],
          upperBound: forecastData?.upperBound || [],
          lowerBound: forecastData?.lowerBound || [],
          confidence: forecastData?.confidence || 0,
          recommendations: forecastData?.recommendations || [],
          metadata: forecastData?.metadata || {
            seasonalityDetected: 0,
            trendStrength: 0,
            seasonalStrength: 0,
            noiseLevel: 0,
          },
          patterns: forecastData?.patterns || {
            stabilityScore: 1,
            dominantPattern: "unknown",
            summary: "No pattern data",
            patternCount: 0,
          },
          decomposition: forecastData?.decomposition,
        },
        correlation: patternsData?.correlation
          ? {
              pairs: patternsData.correlation.pairs || [],
              insights: patternsData.correlation.insights || [],
            }
          : null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch insights",
      }));
    }
  }, [activeCredentialId]);

  useEffect(() => {
    if (activeCredentialId) fetchInsights();
  }, [activeCredentialId, fetchInsights]);

  // Build chart data from forecast
  const forecastChartData = state.forecast?.forecast.map((v, i) => ({
    step: i + 1,
    forecast: v,
    upper: state.forecast!.upperBound[i] || v,
    lower: state.forecast!.lowerBound[i] || v,
  })) || [];

  const tabs = [
    { id: "anomalies" as const, label: "Anomalies", icon: AlertTriangle },
    { id: "forecast" as const, label: "Forecast", icon: TrendingUp },
    { id: "patterns" as const, label: "Patterns", icon: Layers },
    { id: "recommendations" as const, label: "AI Insights", icon: Lightbulb },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Brain className="h-6 w-6 text-violet-400" />
              AI Insights
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Anomaly detection, forecasting, pattern analysis, and ML-powered recommendations
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInsights}
            disabled={state.loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${state.loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-card text-foreground border border-b-0 border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {state.loading && (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center space-y-3">
                <Brain className="h-8 w-8 animate-pulse mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Running ML analysis...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {state.error && !state.loading && (
          <Card className="border-destructive/50">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm font-medium text-destructive">{state.error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchInsights}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Tab: Anomalies ── */}
        {activeTab === "anomalies" && !state.loading && (
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-amber-400" />
                  Anomaly Detection
                  {state.anomalies.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {state.anomalies.length} detected
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {state.anomalies.length > 0 ? (
                  <div className="space-y-3">
                    {state.anomalies.slice(0, 10).map((a, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={a.severity === "critical" ? "destructive" : a.severity === "high" ? "default" : "secondary"}
                          >
                            {a.severity}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">Value: {a.value.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              Z-Score: {a.zScore.toFixed(2)} (threshold: 2.5)
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">Index {a.index}</Badge>
                      </div>
                    ))}
                    {state.anomalies.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{state.anomalies.length - 10} more anomalies
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      No anomalies detected
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All metrics within normal range. System is healthy.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historical context */}
            {state.forecast?.decomposition && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Info className="h-5 w-5 text-blue-400" />
                    Metric Health Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold text-amber-400">
                        {state.forecast.decomposition.hasTrend ? "Yes" : "No"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Strong Trend</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold text-purple-400">
                        {state.forecast.decomposition.hasSeasonality ? "Yes" : "No"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Seasonality</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold text-blue-400">
                        {state.forecast.metadata.seasonalityDetected}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Period Detected</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-bold text-emerald-400">
                        {(state.forecast.patterns.stabilityScore * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Stability</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Tab: Forecast ── */}
        {activeTab === "forecast" && !state.loading && (
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LineChart className="h-5 w-5 text-blue-400" />
                  Prophet-Style Forecast
                  {state.forecast && (
                    <Badge variant="secondary" className="ml-2">
                      {(state.forecast.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {forecastChartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={forecastChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="step"
                          className="text-xs text-muted-foreground"
                          tickFormatter={(v) => `+${v}`}
                        />
                        <YAxis className="text-xs text-muted-foreground" domain={[0, 100]} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="upper"
                          stroke="transparent"
                          fill="url(#upperGradient)"
                          strokeWidth={0}
                        />
                        <Area
                          type="monotone"
                          dataKey="lower"
                          stroke="transparent"
                          fill="transparent"
                          strokeWidth={0}
                        />
                        <Area
                          type="monotone"
                          dataKey="forecast"
                          stroke="#6366f1"
                          fill="none"
                          strokeWidth={2}
                          dot={false}
                        />
                        <defs>
                          <linearGradient id="upperGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No forecast data available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Forecast values table */}
            {state.forecast && state.forecast.forecast.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5 text-emerald-400" />
                    Predicted Values
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b">
                          <th className="pb-2 font-medium">Step</th>
                          <th className="pb-2 font-medium">Forecast</th>
                          <th className="pb-2 font-medium">Upper Bound</th>
                          <th className="pb-2 font-medium">Lower Bound</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.forecast.forecast.slice(0, 12).map((v, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2">+{i + 1}</td>
                            <td className="py-2 font-medium">{v.toFixed(1)}%</td>
                            <td className="py-2 text-muted-foreground">
                              {state.forecast!.upperBound[i]?.toFixed(1)}%
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {state.forecast!.lowerBound[i]?.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata summary */}
            {state.forecast && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-5 w-5 text-violet-400" />
                    ML Metadata
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Trend Strength</p>
                      <p className="text-lg font-bold">{(state.forecast.metadata.trendStrength * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Seasonal Strength</p>
                      <p className="text-lg font-bold">{(state.forecast.metadata.seasonalStrength * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Noise Level</p>
                      <p className="text-lg font-bold">{(state.forecast.metadata.noiseLevel * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className="text-lg font-bold">{(state.forecast.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Tab: Patterns ── */}
        {activeTab === "patterns" && !state.loading && (
          <div className="grid gap-4">
            {/* Stability card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-emerald-400" />
                  System Stability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative h-24 w-24">
                    <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18" cy="18" r="16"
                        fill="none"
                        className="stroke-muted"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18" cy="18" r="16"
                        fill="none"
                        stroke={
                          (state.forecast?.patterns.stabilityScore || 1) > 0.8
                            ? "#10b981"
                            : (state.forecast?.patterns.stabilityScore || 1) > 0.5
                            ? "#f59e0b"
                            : "#ef4444"
                        }
                        strokeWidth="3"
                        strokeDasharray={`${(state.forecast?.patterns.stabilityScore || 1) * 100} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold">
                        {((state.forecast?.patterns.stabilityScore || 1) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {state.forecast?.patterns.dominantPattern || "unknown"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">dominant pattern</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {state.forecast?.patterns.summary || "Analyzing patterns..."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {state.forecast?.patterns.patternCount || 0} patterns detected
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Correlation */}
            {state.correlation && state.correlation.pairs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Network className="h-5 w-5 text-blue-400" />
                    Service Correlation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {state.correlation.pairs.slice(0, 8).map((pair, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              Math.abs(pair.correlation) > 0.7
                                ? "destructive"
                                : Math.abs(pair.correlation) > 0.4
                                ? "default"
                                : "secondary"
                            }
                          >
                            {pair.strength === "strong_positive" || pair.strength === "strong_negative"
                              ? "Strong"
                              : pair.strength === "moderate_positive" || pair.strength === "moderate_negative"
                              ? "Moderate"
                              : "Weak"}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">
                              {pair.serviceA} ↔ {pair.serviceB}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              r = {pair.correlation.toFixed(3)}
                              {pair.lag !== 0 && ` (lag: ${pair.lag})`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono">{pair.correlation.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{pair.strength}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Correlation insights */}
                  {state.correlation.insights.length > 0 && (
                    <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-xs font-medium text-primary flex items-center gap-1 mb-2">
                        <Sparkles className="h-3 w-3" /> AI Insights
                      </p>
                      <ul className="space-y-1">
                        {state.correlation.insights.map((insight, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Tab: Recommendations ── */}
        {activeTab === "recommendations" && !state.loading && (
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  ML-Powered Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {state.forecast?.recommendations && state.forecast.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {state.forecast.recommendations.map((rec, i) => {
                      const isWarning = rec.startsWith("⚠️") || rec.startsWith("🔴");
                      const isInfo = rec.startsWith("📊") || rec.startsWith("📅") || rec.startsWith("🔄");
                      const isPositive = rec.startsWith("✅");
                      return (
                        <div
                          key={i}
                          className={`p-4 rounded-lg border ${
                            isWarning
                              ? "bg-amber-500/10 border-amber-500/20"
                              : isPositive
                              ? "bg-emerald-500/10 border-emerald-500/20"
                              : "bg-blue-500/10 border-blue-500/20"
                          }`}
                        >
                          <p className="text-sm">{rec}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Lightbulb className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Run an analysis to get AI-powered recommendations
                    </p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={fetchInsights}>
                      <Brain className="h-4 w-4 mr-2" /> Run Analysis
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System overview */}
            {state.forecast && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-violet-400" />
                    System Health Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Anomalies</p>
                      <p className={`text-2xl font-bold ${
                        state.anomalies.length === 0 ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {state.anomalies.length}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Correlated Pairs</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {state.correlation?.pairs.length || 0}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Pattern Count</p>
                      <p className="text-2xl font-bold text-purple-400">
                        {state.forecast.patterns.patternCount}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty State */}
        {!activeCredentialId && (
          <Card>
            <CardContent className="p-12 text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No AWS Credentials</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add AWS credentials in Settings to enable AI-powered insights on your infrastructure.
              </p>
              <Button
                onClick={() => window.location.href = "/settings"}
                variant="outline"
              >
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
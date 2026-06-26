export {
  seriesToDataFrame,
  logsToDataFrame,
  dataFrameToChart,
  dataFrameToSeries,
  normalizeFrame,
  inferColumns,
  detectViewMode,
} from "./frame";

export { applyTransform, applyTransformPipeline } from "./engine";

import type { MetricSeriesResult } from "@/lib/cloudwatch-query";
import type { LogRecord } from "@/lib/cloudwatch-logs";
import type { PanelTransform } from "@/types/transforms";
import { seriesToDataFrame, logsToDataFrame, dataFrameToChart, dataFrameToSeries } from "./frame";
import { applyTransformPipeline } from "./engine";

export function transformMetricSeries(
  series: MetricSeriesResult[],
  transforms?: PanelTransform[]
) {
  const base = seriesToDataFrame(series);
  const { frame, viewMode } = applyTransformPipeline(base, transforms);
  const { chartData, seriesLabels } = dataFrameToChart(frame);
  const transformedSeries = dataFrameToSeries(frame);

  return {
    frame,
    viewMode,
    chartData,
    seriesLabels,
    series: transformedSeries.length > 0 ? transformedSeries : series,
  };
}

export function transformLogRecords(
  records: LogRecord[],
  transforms?: PanelTransform[]
) {
  const base = logsToDataFrame(records);
  const { frame, viewMode } = applyTransformPipeline(base, transforms);
  return {
    frame,
    viewMode,
    records: frame.rows as LogRecord[],
  };
}

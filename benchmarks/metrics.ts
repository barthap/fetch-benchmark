import { formatBytes } from "./utils";

export interface MetricInfo {
  key: string;
  label: string;
  unit: string;
  format: (value: number) => string;
  higherIsBetter: boolean;
}

export const METRICS: MetricInfo[] = [
  {
    key: "durationMs",
    label: "Time",
    unit: "ms",
    format: (v) => `${Math.round(v)} ms`,
    higherIsBetter: false,
  },
  {
    key: "sizeBytes",
    label: "Size",
    unit: "",
    format: (v) => formatBytes(v),
    higherIsBetter: false,
  },
  {
    key: "throughputMbPerCc",
    label: "Speed",
    unit: "MB/s",
    format: (v) => `${v.toFixed(1)} MB/s`,
    higherIsBetter: true,
  },
  {
    key: "timeToFirstChunkMs",
    label: "TTFC",
    unit: "ms",
    format: (v) => `${v.toFixed(1)} ms`,
    higherIsBetter: false,
  },
  {
    key: "chunkCount",
    label: "Chunks",
    unit: "",
    format: (v) => `${v}`,
    higherIsBetter: false,
  },
  {
    key: "droppedFrames",
    label: "Drops",
    unit: "",
    format: (v) => `${v}`,
    higherIsBetter: false,
  },
  {
    key: "medianInterTokenMs",
    label: "Token Δ",
    unit: "ms",
    format: (v) => `${v.toFixed(1)} ms`,
    higherIsBetter: false,
  },
  {
    key: "memoryDeltaBytes",
    label: "Mem Δ",
    unit: "",
    format: (v) => `${v >= 0 ? "+" : ""}${formatBytes(Math.abs(v))}`,
    higherIsBetter: false,
  },
  {
    key: "jsThreadCpuMs",
    label: "JS CPU",
    unit: "ms",
    format: (v) => `${v.toFixed(1)} ms`,
    higherIsBetter: false,
  },
  {
    key: "gcCount",
    label: "GC",
    unit: "",
    format: (v) => `${v}`,
    higherIsBetter: false,
  },
  {
    key: "gcTotalPauseMs",
    label: "GC Pause",
    unit: "ms",
    format: (v) => `${v.toFixed(1)} ms`,
    higherIsBetter: false,
  },
];

export function getMetricInfo(key: string): MetricInfo | undefined {
  return METRICS.find((m) => m.key === key);
}

/**
 * Extract a metric value from a result object by key.
 * Returns undefined if the key doesn't exist or the value is null/undefined.
 */
export function getMetricValue(
  result: Record<string, unknown>,
  key: string,
): number | undefined {
  const val = result[key];
  return typeof val === "number" ? val : undefined;
}

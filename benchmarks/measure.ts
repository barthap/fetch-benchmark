import type { BenchmarkResult } from "./types";
import { getGCSnapshot, diffGCSnapshots } from "./gc-utils";

let BenchmarkMetrics: {
  getMemoryUsageBytes(): number;
  getJSThreadCpuTimeMs(): number;
} | null = null;

try {
  BenchmarkMetrics = require("../modules/expo-benchmark-metrics");
} catch {
  // Module not available — native metrics will be undefined
}

interface Snapshot {
  memoryBytes: number | null;
  cpuTimeMs: number | null;
  gc: { numGCs: number; gcTotalTimeMs: number } | null;
}

function takeSnapshot(): Snapshot {
  return {
    memoryBytes: BenchmarkMetrics?.getMemoryUsageBytes() ?? null,
    cpuTimeMs: BenchmarkMetrics?.getJSThreadCpuTimeMs() ?? null,
    gc: getGCSnapshot(),
  };
}

/**
 * Wraps a benchmark run function, adding native metric deltas to the result.
 */
export async function withNativeMetrics<T extends BenchmarkResult>(
  fn: () => Promise<T>,
): Promise<T> {
  const before = takeSnapshot();
  const result = await fn();
  const after = takeSnapshot();

  const gcDiff = diffGCSnapshots(before.gc, after.gc);

  return {
    ...result,
    memoryDeltaBytes:
      before.memoryBytes != null && after.memoryBytes != null
        ? after.memoryBytes - before.memoryBytes
        : undefined,
    jsThreadCpuMs:
      before.cpuTimeMs != null && after.cpuTimeMs != null
        ? Math.round((after.cpuTimeMs - before.cpuTimeMs) * 100) / 100
        : undefined,
    gcCount: gcDiff?.gcCount,
    gcTotalPauseMs: gcDiff?.gcTotalPauseMs,
  };
}

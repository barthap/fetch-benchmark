import type { BenchmarkResult, MultiRunResult } from "./types";
import { withNativeMetrics } from "./measure";
import { tryCollectGarbage } from "./gc-utils";

export interface MultiRunOptions {
  runCount: number;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Runs a benchmark multiple times with warm-up, returns median result.
 * Each run is wrapped with native metrics collection.
 */
export async function runMultiple<T extends BenchmarkResult>(
  runFn: () => Promise<T>,
  options: MultiRunOptions
): Promise<MultiRunResult<T>> {
  const { runCount, onProgress } = options;

  // Warm-up run (discarded from stats)
  onProgress?.(0, runCount);
  const warmUpRun = await withNativeMetrics(runFn);
  tryCollectGarbage();

  // Measured runs
  const runs: T[] = [];
  for (let i = 0; i < runCount; i++) {
    onProgress?.(i + 1, runCount);
    const result = await withNativeMetrics(runFn);
    runs.push(result);

    if (i < runCount - 1) {
      tryCollectGarbage();
    }
  }

  // Pick median by durationMs. For even counts, picks lower-middle (no averaging).
  const sorted = [...runs].sort((a, b) => a.durationMs - b.durationMs);
  const medianIndex = Math.floor(sorted.length / 2);
  const median = sorted[medianIndex];

  return {
    median,
    runs,
    runCount,
    warmUpRun: warmUpRun as T,
  };
}

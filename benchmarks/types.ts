export type BenchmarkStatus = "idle" | "running" | "success" | "error";

export interface BenchmarkResult {
  durationMs: number;
  sizeBytes: number;
  throughputMbPerCc?: number; // MB/s
  error?: string;
  statusCode?: number;
  // Native metrics (optional)
  memoryDeltaBytes?: number;
  jsThreadCpuMs?: number;
  gcCount?: number;
  gcTotalPauseMs?: number;
}

export interface MultiRunResult<T extends BenchmarkResult = BenchmarkResult> {
  median: T;
  runs: T[];
  runCount: number;
  warmUpRun?: T;
}

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

export interface Benchmark {
  id: string;
  name: string;
  description: string;
  category: string;
  run: (url: string) => Promise<BenchmarkResult>;
}

export interface BasicBenchmark extends Omit<Benchmark, "run"> {
  run: (url: string) => Promise<Response>;
}

export interface PrefetchedBenchmark extends Omit<Benchmark, "run"> {
  prefetch: (url: string) => Promise<Response>;
  run: (response: Response) => Promise<void>;
  measurePrefetchTime?: boolean;
}

export interface MultiRunResult<T extends BenchmarkResult = BenchmarkResult> {
  median: T;
  runs: T[];
  runCount: number;
  warmUpRun?: T;
}

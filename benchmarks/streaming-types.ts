import type { Benchmark, BenchmarkResult } from "./types";

export interface StreamingBenchmarkResult extends BenchmarkResult {
  timeToFirstChunkMs: number;
  chunkCount: number;
  droppedFrames?: number;
  medianInterTokenMs?: number; // SSE benchmark only: median time between token arrivals
}

export type FetchFn = (url: string) => Promise<Response>;

export interface StreamingBenchmarkDef {
  id: string;
  name: string;
  description: string;
  category: string;
  endpoint: string; // appended to base URL, e.g. "/chunked?size=50mb"
  run: (fetchFn: FetchFn, url: string) => Promise<StreamingBenchmarkResult>;
}

// Extends Benchmark so StreamingBenchmark can be passed to BenchmarkCard
// The `run` signature is compatible: (string) => Promise<StreamingBenchmarkResult extends BenchmarkResult>
export interface StreamingBenchmark extends Omit<Benchmark, "run"> {
  endpoint: string;
  run: (baseUrl: string) => Promise<StreamingBenchmarkResult>;
}

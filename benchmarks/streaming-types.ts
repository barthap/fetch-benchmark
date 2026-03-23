// benchmarks/streaming-types.ts
import type { BenchmarkResult } from "./types";

export interface StreamingBenchmarkResult extends BenchmarkResult {
  timeToFirstChunkMs: number;
  chunkCount: number;
  droppedFrames?: number;
  medianInterTokenMs?: number;
}

export type FetchFn = (url: string) => Promise<Response>;

import type { BasicBenchmark, Benchmark, BenchmarkResult, PrefetchedBenchmark } from "./types";

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function calculateThroughput(sizeBytes: number, durationMs: number): number {
  if (durationMs === 0) return 0;
  const sizeMb = sizeBytes / (1024 * 1024);
  const durationSec = durationMs / 1000;
  return sizeMb / durationSec;
}

export function makeBenchmark(benchmark: BasicBenchmark | PrefetchedBenchmark): Benchmark {
  return {
    ...benchmark,
    run: async (url: string): Promise<BenchmarkResult> => {
      let response: Response;
      let start: number;
      if ("prefetch" in benchmark) {
        start = Date.now();
        response = await benchmark.prefetch(url);
        if (!benchmark.measurePrefetchTime) {
          // reset start time after prefetch
          start = Date.now();
        }

        await benchmark.run(response);
      } else {
        start = Date.now();
        response = await benchmark.run(url);
      }
      const end = Date.now();

      const durationMs = end - start;
      const sizeBytes = parseInt(response.headers.get("Content-Length") as string, 10);
      const throughput = calculateThroughput(sizeBytes, durationMs);

      // Garbage-collect after memory-consuming benchmarks
      if (global.gc) {
        global.gc();
      } else if (globalThis.gc) {
        globalThis.gc();
      }

      return {
        durationMs,
        sizeBytes,
        throughputMbPerCc: throughput,
        statusCode: response.status,
      };
    },
  };
}

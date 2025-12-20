import type { Benchmark, BenchmarkResult } from "../types";
import { calculateThroughput } from "../utils";
import { fetch as expoFetch } from "expo/fetch";

export const expoFetchBenchmark: Benchmark = {
  id: "expo-fetch",
  name: "Expo Fetch",
  description: "Uses expo/fetch() API. Consumes response as JSON.",
  run: async (url: string): Promise<BenchmarkResult> => {
    const start = Date.now();
    const response = await expoFetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const _blob = await response.arrayBuffer();
    const end = Date.now();

    const durationMs = end - start;
    const sizeBytes = parseInt(response.headers.get("Content-Length") as string, 10);
    const throughput = calculateThroughput(sizeBytes, durationMs);

    return {
      durationMs,
      sizeBytes,
      throughputMbPerCc: throughput,
      statusCode: response.status,
    };
  },
};

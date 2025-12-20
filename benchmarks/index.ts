import { expoFetchBenchmark } from "./impl/expoFetch";
import { fetchBenchmark } from "./impl/fetch";
import type { Benchmark } from "./types";

export const benchmarks: Benchmark[] = [
  fetchBenchmark,
  expoFetchBenchmark,
  // axiosBenchmark,
  // xhrBenchmark,
  // fileSystemBenchmark,
];

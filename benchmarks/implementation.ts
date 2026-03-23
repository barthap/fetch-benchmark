import type { BenchmarkResult, MultiRunResult } from "./types";

export interface Implementation {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  fetchFn: (url: string) => Promise<Response>;
  enabled: boolean;
}

export interface TestDefinition<
  TResult extends BenchmarkResult = BenchmarkResult,
> {
  id: string;
  name: string;
  description: string;
  run: (impl: Implementation, url: string) => Promise<TResult>;
}

/**
 * Results storage: outer key = impl.id, inner key = test.id
 */
export type ResultsMap<T extends BenchmarkResult = BenchmarkResult> = Record<
  string,
  Record<string, MultiRunResult<T>>
>;

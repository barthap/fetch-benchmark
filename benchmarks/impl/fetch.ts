import { Benchmark, BenchmarkResult } from '../types';
import { calculateThroughput } from '../utils';

export const fetchBenchmark: Benchmark = {
  id: 'standard-fetch',
  name: 'Standard Fetch',
  description: 'Uses the built-in fetch() API. Consumes response as Blob.',
  run: async (url: string): Promise<BenchmarkResult> => {
    const start = Date.now();
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const blob = await response.blob();
    const end = Date.now();
    
    const durationMs = end - start;
    const sizeBytes = blob.size;
    const throughput = calculateThroughput(sizeBytes, durationMs);

    return {
      durationMs,
      sizeBytes,
      throughputMbPerCc: throughput,
      statusCode: response.status,
    };
  },
};

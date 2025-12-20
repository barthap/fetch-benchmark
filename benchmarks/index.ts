import { Benchmark } from './types';
import { fetchBenchmark } from './impl/fetch';

export const benchmarks: Benchmark[] = [
    fetchBenchmark,
];
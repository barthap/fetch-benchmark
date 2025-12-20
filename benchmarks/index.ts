import { Benchmark } from './types';
import { fetchBenchmark } from './impl/fetch';
import { axiosBenchmark } from './impl/axios';
import { xhrBenchmark } from './impl/xhr';
import { fileSystemBenchmark } from './impl/filesystem';

export const benchmarks: Benchmark[] = [
    fetchBenchmark,
    axiosBenchmark,
    xhrBenchmark,
    fileSystemBenchmark,
];

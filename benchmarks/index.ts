import { axiosBenchmark } from "./impl/axios";
import { fetchBenchmark } from "./impl/fetch";
import { fileSystemBenchmark } from "./impl/filesystem";
import { xhrBenchmark } from "./impl/xhr";
import type { Benchmark } from "./types";

export const benchmarks: Benchmark[] = [
	fetchBenchmark,
	axiosBenchmark,
	xhrBenchmark,
	fileSystemBenchmark,
];

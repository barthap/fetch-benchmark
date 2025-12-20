import type { Benchmark, BenchmarkResult } from "../types";
import { calculateThroughput } from "../utils";

export const xhrBenchmark: Benchmark = {
	id: "xhr",
	name: "XMLHttpRequest",
	description: 'Uses legacy XMLHttpRequest with responseType = "blob".',
	run: async (url: string): Promise<BenchmarkResult> => {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open("GET", url);
			xhr.responseType = "blob";

			const start = Date.now();

			xhr.onload = () => {
				const end = Date.now();
				const durationMs = end - start;
				const sizeBytes = xhr.response.size;

				if (xhr.status >= 200 && xhr.status < 300) {
					resolve({
						durationMs,
						sizeBytes,
						throughputMbPerCc: calculateThroughput(sizeBytes, durationMs),
						statusCode: xhr.status,
					});
				} else {
					reject(new Error(`HTTP ${xhr.status}`));
				}
			};

			xhr.onerror = () => {
				reject(new Error("Network Error"));
			};

			xhr.send();
		});
	},
};

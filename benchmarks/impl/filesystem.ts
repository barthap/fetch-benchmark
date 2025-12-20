import * as FileSystem from "expo-file-system";
import type { Benchmark, BenchmarkResult } from "../types";
import { calculateThroughput } from "../utils";

export const fileSystemBenchmark: Benchmark = {
	id: "expo-fs",
	name: "Expo FileSystem",
	description: "downloadAsync() to cache directory. Tests download-to-disk.",
	run: async (url: string): Promise<BenchmarkResult> => {
		const filename = "benchmark_test.file";
		const fileUri = FileSystem.cacheDirectory + filename;

		try {
			const start = Date.now();
			const downloadRes = await FileSystem.downloadAsync(url, fileUri);
			const end = Date.now();

			if (downloadRes.status !== 200) {
				throw new Error(`HTTP ${downloadRes.status}`);
			}

			const info = await FileSystem.getInfoAsync(fileUri);
			if (!info.exists) {
				throw new Error("File not found after download");
			}

			const durationMs = end - start;
			const sizeBytes = info.size;

			// Cleanup
			await FileSystem.deleteAsync(fileUri, { idempotent: true });

			return {
				durationMs,
				sizeBytes,
				throughputMbPerCc: calculateThroughput(sizeBytes, durationMs),
				statusCode: downloadRes.status,
			};
		} catch (e) {
			// Cleanup on error
			await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(
				() => {},
			);
			throw e;
		}
	},
};

export type BenchmarkStatus = "idle" | "running" | "success" | "error";

export interface BenchmarkResult {
	durationMs: number;
	sizeBytes: number;
	throughputMbPerCc?: number; // MB/s
	error?: string;
	statusCode?: number;
}

export interface Benchmark {
	id: string;
	name: string;
	description: string;
	run: (url: string) => Promise<BenchmarkResult>;
}

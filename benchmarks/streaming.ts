import type { StreamingBenchmarkDef, StreamingBenchmarkResult, FetchFn, StreamingBenchmark } from "./streaming-types";
import { makeStreamingBenchmark, drainStream, createFrameDropCounter } from "./streaming-utils";
import { calculateThroughput } from "./utils";

const streamingBenchmarkDefs: StreamingBenchmarkDef[] = [
  {
    id: "stream-drain-1mb",
    name: "Stream drain 1MB",
    category: "Streaming",
    description: "Drain ReadableStream, 1MB payload",
    endpoint: "/chunked?size=1mb",
    run: (fetchFn, url) => drainStream(fetchFn, url),
  },
  {
    id: "stream-drain-10mb",
    name: "Stream drain 10MB",
    category: "Streaming",
    description: "Drain ReadableStream, 10MB payload",
    endpoint: "/chunked?size=10mb",
    run: (fetchFn, url) => drainStream(fetchFn, url),
  },
  {
    id: "stream-drain-50mb",
    name: "Stream drain 50MB",
    category: "Streaming",
    description: "Drain ReadableStream, 50MB payload (primary)",
    endpoint: "/chunked?size=50mb",
    run: (fetchFn, url) => drainStream(fetchFn, url),
  },
  {
    id: "stream-drain-100mb",
    name: "Stream drain 100MB",
    category: "Streaming",
    description: "Drain ReadableStream, 100MB payload",
    endpoint: "/chunked?size=100mb",
    run: (fetchFn, url) => drainStream(fetchFn, url),
  },
  {
    id: "stream-sse",
    name: "SSE / LLM simulation",
    category: "Streaming",
    description: "Server-Sent Events with bursty token pattern",
    endpoint: "/sse",
    run: async (fetchFn, url): Promise<StreamingBenchmarkResult> => {
      const fetchStart = performance.now();
      const response = await fetchFn(url);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      let firstChunkTime: number | undefined;
      let chunkCount = 0;
      let totalBytes = 0;
      const tokenTimes: number[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const now = performance.now();
        if (!firstChunkTime) firstChunkTime = now;
        totalBytes += value.byteLength;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          if (frame.startsWith("data: ") && frame !== "data: [DONE]") {
            tokenTimes.push(now);
            chunkCount++;
          }
        }
      }

      const endTime = performance.now();
      const durationMs = endTime - fetchStart;
      const ttfc = firstChunkTime ? firstChunkTime - fetchStart : durationMs;

      const deltas: number[] = [];
      for (let i = 1; i < tokenTimes.length; i++) {
        deltas.push(tokenTimes[i] - tokenTimes[i - 1]);
      }
      deltas.sort((a, b) => a - b);
      const medianInterTokenMs = deltas.length > 0
        ? deltas[Math.floor(deltas.length / 2)]
        : 0;

      return {
        durationMs: Math.round(durationMs),
        sizeBytes: totalBytes,
        throughputMbPerCc: calculateThroughput(totalBytes, durationMs),
        timeToFirstChunkMs: Math.round(ttfc * 100) / 100,
        chunkCount,
        medianInterTokenMs: Math.round(medianInterTokenMs * 100) / 100,
      };
    },
  },
  {
    id: "stream-throttled-10mb",
    name: "Throttled stream 10MB",
    category: "Streaming",
    description: "Drain 10MB at 1mbps throttle",
    endpoint: "/chunked?size=10mb&throttle=1mbps",
    run: (fetchFn, url) => drainStream(fetchFn, url),
  },
  {
    id: "stream-concurrent-3x10mb",
    name: "Concurrent 3x 10MB",
    category: "Streaming",
    description: "Three parallel 10MB stream drains",
    endpoint: "/chunked?size=10mb",
    run: async (fetchFn, url): Promise<StreamingBenchmarkResult> => {
      const fetchStart = performance.now();
      let firstChunkGlobal: number | undefined;

      async function drainOne(): Promise<{ bytes: number; chunks: number }> {
        const response = await fetchFn(url);
        const reader = response.body!.getReader();
        let bytes = 0;
        let chunks = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!firstChunkGlobal) firstChunkGlobal = performance.now();
          bytes += value.byteLength;
          chunks++;
        }
        return { bytes, chunks };
      }

      const results = await Promise.all([drainOne(), drainOne(), drainOne()]);

      const endTime = performance.now();
      const durationMs = endTime - fetchStart;
      const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);
      const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);
      const ttfc = firstChunkGlobal ? firstChunkGlobal - fetchStart : durationMs;

      return {
        durationMs: Math.round(durationMs),
        sizeBytes: totalBytes,
        throughputMbPerCc: calculateThroughput(totalBytes, durationMs),
        timeToFirstChunkMs: Math.round(ttfc * 100) / 100,
        chunkCount: totalChunks,
      };
    },
  },
  {
    id: "stream-animation-50mb",
    name: "Stream + animation",
    category: "Streaming",
    description: "50MB drain with frame drop measurement",
    endpoint: "/chunked?size=50mb",
    run: async (fetchFn, url): Promise<StreamingBenchmarkResult> => {
      const counter = createFrameDropCounter();
      counter.start();
      const result = await drainStream(fetchFn, url);
      const { droppedFrames } = counter.stop();
      return { ...result, droppedFrames };
    },
  },
];

export function createStreamingBenchmarks(fetchFn: FetchFn): StreamingBenchmark[] {
  return streamingBenchmarkDefs.map((def) => makeStreamingBenchmark(def, fetchFn));
}

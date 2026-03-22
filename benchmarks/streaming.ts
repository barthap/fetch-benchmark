// benchmarks/streaming.ts
import { fetch as expoFetch } from "expo/fetch";

import type { Implementation, TestDefinition } from "./implementation";
import type { StreamingBenchmarkResult } from "./streaming-types";
import { drainStream, createFrameDropCounter } from "./streaming-utils";
import { calculateThroughput } from "./utils";

export const streamingTests: TestDefinition<StreamingBenchmarkResult>[] = [
  {
    id: "stream-drain-1mb",
    name: "Stream drain 1MB",
    description: "Drain ReadableStream, 1MB payload",
    run: (impl, baseUrl) => drainStream(impl.fetchFn, `${baseUrl}/chunked?size=1mb`),
  },
  {
    id: "stream-drain-10mb",
    name: "Stream drain 10MB",
    description: "Drain ReadableStream, 10MB payload",
    run: (impl, baseUrl) => drainStream(impl.fetchFn, `${baseUrl}/chunked?size=10mb`),
  },
  {
    id: "stream-drain-50mb",
    name: "Stream drain 50MB",
    description: "Drain ReadableStream, 50MB payload (primary)",
    run: (impl, baseUrl) => drainStream(impl.fetchFn, `${baseUrl}/chunked?size=50mb`),
  },
  {
    id: "stream-drain-100mb",
    name: "Stream drain 100MB",
    description: "Drain ReadableStream, 100MB payload",
    run: (impl, baseUrl) => drainStream(impl.fetchFn, `${baseUrl}/chunked?size=100mb`),
  },
  {
    id: "stream-sse",
    name: "SSE / LLM simulation",
    description: "Server-Sent Events with bursty token pattern",
    run: async (impl, baseUrl): Promise<StreamingBenchmarkResult> => {
      const url = `${baseUrl}/sse`;
      const fetchStart = performance.now();
      const response = await impl.fetchFn(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
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
      const medianInterTokenMs =
        deltas.length > 0 ? deltas[Math.floor(deltas.length / 2)] : 0;

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
    description: "Drain 10MB at 1mbps throttle",
    run: (impl, baseUrl) =>
      drainStream(impl.fetchFn, `${baseUrl}/chunked?size=10mb&throttle=1mbps`),
  },
  {
    id: "stream-concurrent-3x10mb",
    name: "Concurrent 3x 10MB",
    description: "Three parallel 10MB stream drains",
    run: async (impl, baseUrl): Promise<StreamingBenchmarkResult> => {
      const url = `${baseUrl}/chunked?size=10mb`;
      const fetchStart = performance.now();
      let firstChunkGlobal: number | undefined;

      async function drainOne(): Promise<{ bytes: number; chunks: number }> {
        const response = await impl.fetchFn(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
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
      const ttfc = firstChunkGlobal
        ? firstChunkGlobal - fetchStart
        : durationMs;

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
    description: "50MB drain with frame drop measurement",
    run: async (impl, baseUrl): Promise<StreamingBenchmarkResult> => {
      const counter = createFrameDropCounter();
      counter.start();
      const result = await drainStream(
        impl.fetchFn,
        `${baseUrl}/chunked?size=50mb`,
      );
      const { droppedFrames } = counter.stop();
      return { ...result, droppedFrames };
    },
  },
];

// Try to import expo-fetch-next; may not be installed
let expoFetchNext: typeof expoFetch | undefined;
try {
  expoFetchNext = require("expo-fetch-next/fetch").fetch;
} catch {
  // Not installed
}

export const streamingImplementations: Implementation[] = [
  {
    id: "stock",
    label: "Stock Expo Fetch",
    shortLabel: "Stock",
    color: "#e74c3c",
    fetchFn: expoFetch,
    enabled: true,
  },
  {
    id: "patched",
    label: "Patched Expo Fetch",
    shortLabel: "Patched",
    color: "#3498db",
    fetchFn: expoFetchNext ?? expoFetch,
    enabled: !!expoFetchNext,
  },
];

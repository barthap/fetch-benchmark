import type { StreamingBenchmarkResult, StreamingBenchmarkDef, StreamingBenchmark, FetchFn } from "./streaming-types";
import { calculateThroughput } from "./utils";

export function makeStreamingBenchmark(
  def: StreamingBenchmarkDef,
  fetchFn: FetchFn,
): StreamingBenchmark {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    category: def.category,
    endpoint: def.endpoint,
    run: async (baseUrl: string): Promise<StreamingBenchmarkResult> => {
      const url = `${baseUrl}${def.endpoint}`;
      const result = await def.run(fetchFn, url);

      // GC after each benchmark
      if (global.gc) {
        global.gc();
      } else if (globalThis.gc) {
        globalThis.gc();
      }

      return result;
    },
  };
}

export async function drainStream(
  fetchFn: FetchFn,
  url: string,
): Promise<StreamingBenchmarkResult> {
  const fetchStart = performance.now();
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const reader = response.body!.getReader();

  let firstChunkTime: number | undefined;
  let chunkCount = 0;
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!firstChunkTime) firstChunkTime = performance.now();
    chunkCount++;
    totalBytes += value.byteLength;
  }

  const endTime = performance.now();
  const durationMs = endTime - fetchStart;
  const ttfc = firstChunkTime ? firstChunkTime - fetchStart : durationMs;

  return {
    durationMs: Math.round(durationMs),
    sizeBytes: totalBytes,
    throughputMbPerCc: calculateThroughput(totalBytes, durationMs),
    timeToFirstChunkMs: Math.round(ttfc * 100) / 100,
    chunkCount,
  };
}

export function createFrameDropCounter(): {
  start: () => void;
  stop: () => { droppedFrames: number; totalFrames: number };
} {
  let rafId: number | null = null;
  let lastTimestamp = 0;
  let droppedFrames = 0;
  let totalFrames = 0;
  const THRESHOLD_MS = 32; // 2x 16ms (60fps target)

  function onFrame(timestamp: number) {
    if (lastTimestamp > 0) {
      totalFrames++;
      const delta = timestamp - lastTimestamp;
      if (delta > THRESHOLD_MS) {
        droppedFrames += Math.floor(delta / 16) - 1;
      }
    }
    lastTimestamp = timestamp;
    rafId = requestAnimationFrame(onFrame);
  }

  return {
    start() {
      droppedFrames = 0;
      totalFrames = 0;
      lastTimestamp = 0;
      rafId = requestAnimationFrame(onFrame);
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      return { droppedFrames, totalFrames };
    },
  };
}

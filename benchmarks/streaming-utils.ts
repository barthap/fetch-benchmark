import type { StreamingBenchmarkResult, FetchFn } from "./streaming-types";
import { calculateThroughput } from "./utils";

export async function drainStream(
  fetchFn: FetchFn,
  url: string,
): Promise<StreamingBenchmarkResult> {
  const fetchStart = performance.now();
  // @ts-expect-error nitro does require this argument for some reason
  const response = await fetchFn(url, { stream: true });
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

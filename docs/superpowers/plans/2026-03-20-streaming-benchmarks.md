# Streaming Benchmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a streaming benchmark screen to measure ReadableStream performance of expo-fetch before/after ChunkCoalescer improvements, with a unified Bun server for all endpoints.

**Architecture:** New tab-based navigation with two screens (existing whole-body benchmarks + new streaming benchmarks). A Bun HTTP server replaces the Python server and adds chunked/SSE/throttled endpoints. Streaming benchmarks use a new `makeStreamingBenchmark()` runner that collects per-chunk metrics from the reader loop. Before/after comparison via fetch function toggle.

**Tech Stack:** Expo SDK 55, React Native 0.83, Expo Router (tabs), React Native Paper, Bun (server), Reanimated (animation test)

**Spec:** `docs/superpowers/specs/2026-03-20-streaming-benchmark-design.md`

**Spec deviations:**
- `server/endpoints/throttled.ts` is merged into `chunked.ts` via a `throttle` query param (simpler, spec already uses this URL pattern)
- Grouped before/after bar chart (spec: "before gray, after colored") is deferred — the current implementation shows one impl at a time via toggle. This can be added as a follow-up once both implementations are available.
- The `serve` script changes from `python3 -m http.server` (port 8000) to `bun run server/index.ts` (port 3001). The whole-body screen's default URL updates accordingly. Users must start the Bun server for both screens.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `server/index.ts` | Bun.serve entry point, static file serving, request routing |
| `server/endpoints/chunked.ts` | `/chunked` endpoint — configurable size, chunk size, optional throttle (spec's `throttled.ts` merged here) |
| `server/endpoints/sse.ts` | `/sse` endpoint — LLM token streaming simulation |
| `benchmarks/streaming-types.ts` | `StreamingBenchmarkResult`, `StreamingBenchmark` types |
| `benchmarks/streaming-utils.ts` | `makeStreamingBenchmark()` helper, `drainStream()`, frame drop counter |
| `benchmarks/streaming.ts` | All 8 streaming benchmark definitions |
| `app/(tabs)/_layout.tsx` | Bottom tab navigator with Paper BottomNavigation |
| `app/(tabs)/index.tsx` | Existing whole-body benchmark screen (moved from `app/index.tsx`) |
| `app/(tabs)/streaming.tsx` | New streaming benchmark screen |
| `modules/README.md` | Setup instructions for expo-fetch-next module sync |

### Modified Files

| File | Change |
|------|--------|
| `app/_layout.tsx` | Remove Stack header (tabs handle their own headers) |
| `components/ResultsChart.tsx` | Add `title` and `metricKey` props |
| `components/BenchmarkCard.tsx` | Support `StreamingBenchmarkResult` extra metrics display |
| `package.json` | Update `serve` script, verify `@react-navigation/bottom-tabs` present |

### Deleted Files

| File | Reason |
|------|--------|
| `app/index.tsx` | Moved to `app/(tabs)/index.tsx` |

---

## Task 1: Bun Server — Static Files & Chunked Endpoint

**Files:**
- Create: `server/index.ts`
- Create: `server/endpoints/chunked.ts`
- Modify: `package.json:14`

- [ ] **Step 1: Create the chunked endpoint handler**

Create `server/endpoints/chunked.ts`:

```typescript
const SIZE_MAP: Record<string, number> = {
  "1mb": 1 * 1024 * 1024,
  "10mb": 10 * 1024 * 1024,
  "50mb": 50 * 1024 * 1024,
  "100mb": 100 * 1024 * 1024,
};

export function handleChunked(url: URL): Response {
  const sizeParam = url.searchParams.get("size") ?? "50mb";
  const chunkSizeParam = url.searchParams.get("chunkSize") ?? "64kb";
  const throttleParam = url.searchParams.get("throttle"); // e.g. "1mbps"

  const totalBytes = SIZE_MAP[sizeParam] ?? 50 * 1024 * 1024;
  const chunkSize = parseSize(chunkSizeParam);
  const throttleBytesPerSec = throttleParam ? parseThrottle(throttleParam) : null;

  const stream = new ReadableStream({
    async start(controller) {
      let sent = 0;
      const chunk = new Uint8Array(chunkSize);
      // Fill with deterministic data
      for (let i = 0; i < chunk.length; i++) {
        chunk[i] = i % 256;
      }

      while (sent < totalBytes) {
        const remaining = totalBytes - sent;
        const toSend = remaining < chunkSize ? chunk.slice(0, remaining) : chunk;
        controller.enqueue(toSend);
        sent += toSend.byteLength;

        if (throttleBytesPerSec) {
          const delayMs = (toSend.byteLength / throttleBytesPerSec) * 1000;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      controller.close();
    },
  });

  // Note: Do NOT set Transfer-Encoding: chunked alongside Content-Length (RFC 7230 §3.3.2).
  // Bun handles chunked encoding automatically for ReadableStream responses.
  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(totalBytes),
    },
  });
}

function parseSize(s: string): number {
  const match = s.match(/^(\d+)(kb|mb)$/i);
  if (!match) return 64 * 1024;
  const num = parseInt(match[1], 10);
  return match[2].toLowerCase() === "mb" ? num * 1024 * 1024 : num * 1024;
}

function parseThrottle(s: string): number {
  const match = s.match(/^(\d+)mbps$/i);
  if (!match) return 1 * 1024 * 1024;
  return parseInt(match[1], 10) * 1024 * 1024 / 8; // mbps -> bytes per second
}
```

- [ ] **Step 2: Create the server entry point with static file serving**

Create `server/index.ts`:

```typescript
import { handleChunked } from "./endpoints/chunked";
import { join } from "path";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");
const PORT = 3001;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/chunked") {
      return handleChunked(url);
    }

    // Static file serving from fixtures/
    const filePath = join(FIXTURES_DIR, url.pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Benchmark server running on http://localhost:${server.port}`);
console.log(`Static files served from: ${FIXTURES_DIR}`);
```

- [ ] **Step 3: Update package.json serve script**

Change line 14 in `package.json` from:
```json
"serve": "cd fixtures && python3 -m http.server",
```
to:
```json
"serve": "bun run server/index.ts",
```

- [ ] **Step 4: Test the server**

Run: `bun run serve &`

Then test static files:
```bash
curl -s -o /dev/null -w "%{http_code} %{size_download}" http://localhost:3001/employees_50MB.json
```
Expected: `200 53901025` (or similar size)

Test chunked endpoint:
```bash
curl -s -o /dev/null -w "%{http_code} %{size_download}" "http://localhost:3001/chunked?size=1mb&chunkSize=64kb"
```
Expected: `200 1048576`

Test throttled (should take ~8 seconds for 1MB at 1mbps):
```bash
time curl -s -o /dev/null "http://localhost:3001/chunked?size=1mb&chunkSize=64kb&throttle=1mbps"
```
Expected: ~8 seconds elapsed

Kill background server after testing.

- [ ] **Step 5: Commit**

```bash
git add server/ package.json
git commit -m "feat: add Bun server with static files and chunked endpoint"
```

---

## Task 2: Bun Server — SSE Endpoint

**Files:**
- Create: `server/endpoints/sse.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create the SSE endpoint**

Create `server/endpoints/sse.ts`:

```typescript
const TOTAL_TOKENS = 500;
const WORDS = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
];

function randomToken(): string {
  // 1-3 words per token, simulating tokenized text
  const count = 1 + Math.floor(Math.random() * 3);
  const words = Array.from({ length: count }, () => WORDS[Math.floor(Math.random() * WORDS.length)]);
  return words.join(" ");
}

function getDelay(tokenIndex: number): number {
  // Bursty pattern: fast bursts of 5-15 tokens at 5-15ms, separated by pauses of 40-80ms
  const burstSize = 5 + Math.floor(Math.random() * 11); // 5-15
  const inBurst = tokenIndex % (burstSize + 3) < burstSize;
  if (inBurst) {
    return 5 + Math.floor(Math.random() * 11); // 5-15ms
  }
  return 40 + Math.floor(Math.random() * 41); // 40-80ms
}

export function handleSSE(): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      for (let i = 0; i < TOTAL_TOKENS; i++) {
        const token = randomToken();
        const sseFrame = `data: ${token}\n\n`;
        controller.enqueue(encoder.encode(sseFrame));

        const delay = getDelay(i);
        await new Promise((r) => setTimeout(r, delay));
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Add SSE route to server**

Add import and route in `server/index.ts`. After the chunked handler, add:

```typescript
import { handleSSE } from "./endpoints/sse";
```

And in the fetch handler, after the `/chunked` check:

```typescript
if (url.pathname === "/sse") {
  return handleSSE();
}
```

- [ ] **Step 3: Test the SSE endpoint**

```bash
curl -s -N "http://localhost:3001/sse" | head -20
```
Expected: Lines like `data: the of and\n\n` streaming in with visible delays. Should see `data: [DONE]` at the end if you wait.

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "feat: add SSE endpoint for LLM token streaming simulation"
```

---

## Task 3: Streaming Types & `makeStreamingBenchmark()` Utility

**Files:**
- Create: `benchmarks/streaming-types.ts`
- Create: `benchmarks/streaming-utils.ts`

- [ ] **Step 1: Create streaming types**

Create `benchmarks/streaming-types.ts`:

```typescript
import type { Benchmark, BenchmarkResult } from "./types";

export interface StreamingBenchmarkResult extends BenchmarkResult {
  timeToFirstChunkMs: number;
  chunkCount: number;
  droppedFrames?: number;
  medianInterTokenMs?: number; // SSE benchmark only: median time between token arrivals
}

export type FetchFn = (url: string) => Promise<Response>;

export interface StreamingBenchmarkDef {
  id: string;
  name: string;
  description: string;
  category: string;
  endpoint: string; // appended to base URL, e.g. "/chunked?size=50mb"
  run: (fetchFn: FetchFn, url: string) => Promise<StreamingBenchmarkResult>;
}

// Extends Benchmark so StreamingBenchmark can be passed to BenchmarkCard
// The `run` signature is compatible: (string) => Promise<StreamingBenchmarkResult extends BenchmarkResult>
export interface StreamingBenchmark extends Omit<Benchmark, "run"> {
  endpoint: string;
  run: (baseUrl: string) => Promise<StreamingBenchmarkResult>;
}
```

- [ ] **Step 2: Create the streaming benchmark utility**

Create `benchmarks/streaming-utils.ts`:

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `bunx tsc --noEmit benchmarks/streaming-types.ts benchmarks/streaming-utils.ts`
Expected: No errors (or only errors about missing React Native types in non-app context, which is fine).

- [ ] **Step 4: Commit**

```bash
git add benchmarks/streaming-types.ts benchmarks/streaming-utils.ts
git commit -m "feat: add streaming benchmark types and makeStreamingBenchmark utility"
```

---

## Task 4: Streaming Benchmark Definitions

**Files:**
- Create: `benchmarks/streaming.ts`

- [ ] **Step 1: Create all 8 streaming benchmark definitions**

Create `benchmarks/streaming.ts`:

```typescript
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
        // Parse SSE frames from buffer
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

      // Calculate median inter-token latency
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
```

- [ ] **Step 2: Commit**

```bash
git add benchmarks/streaming.ts
git commit -m "feat: add 8 streaming benchmark definitions"
```

---

## Task 5: Extend Components for Streaming Metrics

**Files:**
- Modify: `components/ResultsChart.tsx:5-8,23,45`
- Modify: `components/BenchmarkCard.tsx:3,9,50-72`

- [ ] **Step 1: Add `title` and `metricKey` props to ResultsChart**

In `components/ResultsChart.tsx`, update the props type and component:

Change the props type (lines 5-8) to:

```typescript
type ResultsChartProps = {
  benchmarks: { id: string; name: string; category: string }[];
  results: Record<string, BenchmarkResult>;
  title?: string;
  metricKey?: "durationMs" | "timeToFirstChunkMs" | "throughputMbPerCc";
};
```

Update the component signature (line 23) to:

```typescript
export const ResultsChart = ({ benchmarks, results, title, metricKey = "durationMs" }: ResultsChartProps) => {
```

Update the data mapping (lines 24-35) to read from the chosen metric:

```typescript
  const completedResults = Object.entries(results)
    .map(([id, result]) => {
      const benchmark = benchmarks.find((b) => b.id === id);
      const value = (result as Record<string, unknown>)[metricKey] as number | undefined;
      return {
        id,
        name: benchmark?.name || "Unknown",
        category: benchmark?.category || "Unknown",
        duration: value ?? result.durationMs,
      };
    })
    .filter((r) => r.duration > 0)
    .sort((a, b) => a.duration - b.duration);
```

Update the card title (line 45) to:

```typescript
<Card.Title title={title ?? "Benchmark Results (50MB JSON)"} />
```

Update the value label (line 69) to show appropriate units:

```typescript
<Text style={styles.barValue}>
  {metricKey === "throughputMbPerCc"
    ? `${result.duration.toFixed(1)} MB/s`
    : `${result.duration.toFixed(0)} ms`}
</Text>
```

- [ ] **Step 2: Add streaming metrics display to BenchmarkCard**

In `components/BenchmarkCard.tsx`, add an import for the streaming type:

```typescript
import type { Benchmark, BenchmarkResult, BenchmarkStatus } from "../benchmarks/types";
import type { StreamingBenchmarkResult } from "../benchmarks/streaming-types";
```

After the existing speed metric (after line 71), add conditional streaming metrics:

```typescript
{(result as StreamingBenchmarkResult).timeToFirstChunkMs !== undefined && (
  <View style={styles.metric}>
    <Text variant="labelSmall">TTFC</Text>
    <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
      {(result as StreamingBenchmarkResult).timeToFirstChunkMs.toFixed(1)} ms
    </Text>
  </View>
)}
{(result as StreamingBenchmarkResult).chunkCount !== undefined && (
  <View style={styles.metric}>
    <Text variant="labelSmall">Chunks</Text>
    <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
      {(result as StreamingBenchmarkResult).chunkCount}
    </Text>
  </View>
)}
{(result as StreamingBenchmarkResult).droppedFrames !== undefined && (
  <View style={styles.metric}>
    <Text variant="labelSmall">Drops</Text>
    <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
      {(result as StreamingBenchmarkResult).droppedFrames}
    </Text>
  </View>
)}
```

Note: The metrics row may get wide. Wrap `styles.results` to allow wrapping by adding `flexWrap: "wrap"` to the style (line 99-101).

- [ ] **Step 3: Commit**

```bash
git add components/ResultsChart.tsx components/BenchmarkCard.tsx
git commit -m "feat: extend BenchmarkCard and ResultsChart for streaming metrics"
```

---

## Task 6: Tab Navigation

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx` (move from `app/index.tsx`)
- Modify: `app/_layout.tsx`
- Delete: `app/index.tsx`

- [ ] **Step 1: Create the tab layout**

Create `app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from "expo-router";
import { Appbar } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        header: (props) => (
          <Appbar.Header>
            <Appbar.Content title={props.options.title ?? "Fetch Benchmark"} />
          </Appbar.Header>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Whole-Body",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="download" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="streaming"
        options={{
          title: "Streaming",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="wave" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Move existing screen to tabs and fix imports**

Copy `app/index.tsx` to `app/(tabs)/index.tsx`. Then delete `app/index.tsx`.

**Important:** Update all relative imports in the moved file — the file is now one directory deeper. Change:
- `"../benchmarks"` -> `"../../benchmarks"`
- `"../benchmarks/types"` -> `"../../benchmarks/types"`
- `"../components/BenchmarkCard"` -> `"../../components/BenchmarkCard"`
- `"../components/ResultsChart"` -> `"../../components/ResultsChart"`

- [ ] **Step 3: Update the default URL port in the moved screen**

In `app/(tabs)/index.tsx`, change line 16 from:

```typescript
const [url, SHUrl] = useState(`http://${hostURI}:8000/employees_50MB.json`);
```

to:

```typescript
const [url, SHUrl] = useState(`http://${hostURI}:3001/employees_50MB.json`);
```

- [ ] **Step 4: Simplify root layout**

Update `app/_layout.tsx` to remove the Stack header (tabs handle their own):

```typescript
import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 5: Verify the app loads with tabs**

Run: `bun run start` and open on simulator. Confirm:
- Two tabs visible: "Whole-Body" and "Streaming"
- The existing benchmarks screen renders correctly under the first tab
- The second tab shows an empty screen (we'll add content in next task)

- [ ] **Step 6: Commit**

```bash
git add app/ && git rm app/index.tsx 2>/dev/null; git add app/
git commit -m "feat: convert to tab navigation with Whole-Body and Streaming tabs"
```

Note: `git rm` may not be needed if the file was moved — adjust staging as needed. The key is that `app/index.tsx` is gone and `app/(tabs)/index.tsx` exists.

---

## Task 7: Streaming Benchmark Screen

**Files:**
- Create: `app/(tabs)/streaming.tsx`

- [ ] **Step 1: Create the streaming screen**

Create `app/(tabs)/streaming.tsx`:

```typescript
import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import { useState, useMemo } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import type { StreamingBenchmarkResult } from "../../benchmarks/streaming-types";
import { createStreamingBenchmarks } from "../../benchmarks/streaming";
import type { BenchmarkStatus } from "../../benchmarks/types";
import { BenchmarkCard } from "../../components/BenchmarkCard";
import { ResultsChart } from "../../components/ResultsChart";

const hostURI = Constants.expoConfig?.hostUri?.split(":")?.[0] ?? "localhost";

type ImplKey = "before" | "after";

// Try to import the "after" module; fall back to undefined if not installed
let expoFetchNext: typeof expoFetch | undefined;
try {
  expoFetchNext = require("expo-fetch-next").fetch;
} catch {
  // Module not installed yet — "After" option will be disabled
}

export default function StreamingScreen() {
  const [baseUrl, setBaseUrl] = useState(`http://${hostURI}:3001`);
  const [activeImpl, setActiveImpl] = useState<ImplKey>("before");
  const [statuses, setStatuses] = useState<Record<string, BenchmarkStatus>>({});
  const [results, setResults] = useState<Record<ImplKey, Record<string, StreamingBenchmarkResult>>>({
    before: {},
    after: {},
  });
  const [chartMetric, setChartMetric] = useState<"durationMs" | "timeToFirstChunkMs" | "throughputMbPerCc">("durationMs");

  const fetchFn = activeImpl === "after" && expoFetchNext ? expoFetchNext : expoFetch;
  const benchmarks = useMemo(() => createStreamingBenchmarks(fetchFn), [fetchFn]);
  const allIDs = useMemo(() => new Set(benchmarks.map((b) => b.id)), [benchmarks]);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(() => new Set(allIDs));

  const currentResults = results[activeImpl];

  const toggleBenchmark = (id: string) => {
    setSelectedBenchmarks((prev) => {
      const items = new Set(prev);
      items.has(id) ? items.delete(id) : items.add(id);
      return items;
    });
  };

  const runBenchmark = async (id: string) => {
    const benchmark = benchmarks.find((b) => b.id === id);
    if (!benchmark) return;

    setStatuses((prev) => ({ ...prev, [id]: "running" }));

    try {
      const result = await benchmark.run(baseUrl);
      setResults((prev) => ({
        ...prev,
        [activeImpl]: { ...prev[activeImpl], [id]: result },
      }));
      setStatuses((prev) => ({ ...prev, [id]: "success" }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setResults((prev) => ({
        ...prev,
        [activeImpl]: {
          ...prev[activeImpl],
          [id]: {
            durationMs: 0,
            sizeBytes: 0,
            timeToFirstChunkMs: 0,
            chunkCount: 0,
            error: message,
          },
        },
      }));
      setStatuses((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  const runAll = async () => {
    for (const b of benchmarks) {
      if (selectedBenchmarks.has(b.id)) {
        await runBenchmark(b.id);
      }
    }
  };

  const exportResults = async () => {
    const data = {
      device: `${Constants.deviceName ?? "unknown"}`,
      timestamp: new Date().toISOString(),
      results,
    };
    await Share.share({ message: JSON.stringify(data, null, 2) });
  };

  const metricButtons = [
    { value: "durationMs", label: "Duration" },
    { value: "timeToFirstChunkMs", label: "TTFC" },
    { value: "throughputMbPerCc", label: "Throughput" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResultsChart
        benchmarks={benchmarks}
        results={currentResults}
        title={`Streaming Results (${activeImpl})`}
        metricKey={chartMetric}
      />

      <View style={styles.controls}>
        <TextInput
          label="Server URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="url"
        />

        <SegmentedButtons
          value={activeImpl}
          onValueChange={(v) => setActiveImpl(v as ImplKey)}
          buttons={[
            { value: "before", label: "Before (stock)" },
            {
              value: "after",
              label: "After (patched)",
              disabled: !expoFetchNext,
            },
          ]}
        />

        <SegmentedButtons
          value={chartMetric}
          onValueChange={(v) => setChartMetric(v as typeof chartMetric)}
          buttons={metricButtons}
        />

        <View style={styles.buttonRow}>
          <Button
            mode="contained-tonal"
            onPress={() => setSelectedBenchmarks(new Set(allIDs))}
            style={styles.flexButton}
          >
            Select All
          </Button>
          <Button
            mode="contained-tonal"
            onPress={() => setSelectedBenchmarks(new Set())}
            style={styles.flexButton}
          >
            Deselect All
          </Button>
        </View>

        <View style={styles.buttonRow}>
          <Button mode="contained" onPress={runAll} icon="play-box-multiple" style={styles.flexButton}>
            Run Selected
          </Button>
          <Button mode="outlined" onPress={exportResults} icon="export-variant" style={styles.flexButton}>
            Export
          </Button>
        </View>
      </View>

      {benchmarks.map((b) => (
        <BenchmarkCard
          key={b.id}
          benchmark={b}
          status={statuses[b.id] || "idle"}
          result={currentResults[b.id]}
          onRun={() => runBenchmark(b.id)}
          isSelected={selectedBenchmarks.has(b.id)}
          onToggle={() => toggleBenchmark(b.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  controls: {
    marginBottom: 20,
    gap: 12,
  },
  input: {
    backgroundColor: "white",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
});
```

- [ ] **Step 2: Verify the streaming screen renders**

Run the app on simulator. Navigate to the Streaming tab. Confirm:
- Server URL input shows `http://<hostURI>:3001`
- Before/After segmented buttons visible ("After" disabled if expo-fetch-next not installed)
- Chart metric selector (Duration/TTFC/Throughput) visible
- All 8 benchmark cards displayed
- Select All / Run Selected / Export buttons present

- [ ] **Step 3: Test a benchmark end-to-end**

Start the Bun server (`bun run serve`), then in the app:
1. Tap "Stream drain 1MB" card's Run button
2. Confirm it shows duration, throughput, TTFC, and chunk count
3. Verify the chart updates with the result

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/streaming.tsx
git commit -m "feat: add streaming benchmark screen with before/after toggle"
```

---

## Task 8: Modules README & Sync Instructions

**Files:**
- Create: `modules/README.md`

- [ ] **Step 1: Create the modules README**

Create `modules/README.md`:

```markdown
# expo-fetch-next Module Setup

This directory contains the "after" implementation for streaming benchmark comparisons — a renamed copy of expo-fetch from the local expo checkout.

## First-Time Setup

### 1. Copy source files

```bash
mkdir -p modules/expo-fetch-next/{ios,android,src}

# Copy the fetch-specific source files from your local expo checkout
rsync -a ~/dev/expo/packages/expo/ios/Fetch/ modules/expo-fetch-next/ios/Fetch/
rsync -a ~/dev/expo/packages/expo/android/src/main/java/expo/modules/fetch/ modules/expo-fetch-next/android/src/main/java/expo/modules/fetchnext/
# Copy JS/TS fetch source files as needed
```

### 2. Rename to avoid conflicts

Rename all public symbols to avoid clashing with the stock expo package:

- **Module name:** `ExpoFetch` -> `ExpoFetchNext`
- **Swift class:** `ExpoFetchModule` -> `ExpoFetchNextModule`
- **Kotlin class:** Same pattern
- **Package name** in `expo-module.config.json`

Create `modules/expo-fetch-next/expo-module.config.json`:
```json
{
  "platforms": ["ios", "android"],
  "ios": {
    "modules": ["ExpoFetchNextModule"]
  },
  "android": {
    "modules": ["expo.modules.fetchnext.ExpoFetchNextModule"]
  }
}
```

Create `modules/expo-fetch-next/index.ts`:
```typescript
// Re-export the patched fetch function
export { fetch } from "./src/fetch";
```

### 3. Generate the rename patch

Keep an unmodified copy for diffing:
```bash
rsync -a ~/dev/expo/packages/expo/ios/Fetch/ /tmp/expo-fetch-next-clean/ios/Fetch/
rsync -a ~/dev/expo/packages/expo/android/src/main/java/expo/modules/fetch/ /tmp/expo-fetch-next-clean/android/

diff -ruN /tmp/expo-fetch-next-clean/ modules/expo-fetch-next/ > modules/renames.patch
```

## Syncing from Upstream

When you want to pull in new changes from your local expo checkout:

```bash
./modules/sync.sh
```

### sync.sh

```bash
#!/bin/bash
set -e

EXPO_DIR="${HOME}/dev/expo/packages/expo"
MODULE_DIR="$(dirname "$0")/expo-fetch-next"

echo "Syncing from ${EXPO_DIR}..."
rsync -a --delete "${EXPO_DIR}/ios/Fetch/" "${MODULE_DIR}/ios/Fetch/"
rsync -a --delete "${EXPO_DIR}/android/src/main/java/expo/modules/fetch/" "${MODULE_DIR}/android/src/main/java/expo/modules/fetchnext/"

echo "Applying rename patches..."
cd "$(dirname "$0")"
patch -p1 < renames.patch

echo "Done! Rebuild the app to pick up changes."
```

Make it executable: `chmod +x modules/sync.sh`

## Usage in Benchmarks

The streaming benchmark screen auto-detects this module:

```typescript
import { fetch as expoFetchNext } from "expo-fetch-next";
```

If the module is not installed, the "After (patched)" toggle in the UI will be disabled.
```

- [ ] **Step 2: Commit**

```bash
git add modules/README.md
git commit -m "docs: add expo-fetch-next module setup and sync instructions"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Bun server: static files + chunked endpoint | None |
| 2 | Bun server: SSE endpoint | Task 1 |
| 3 | Streaming types & `makeStreamingBenchmark()` utility | None |
| 4 | Streaming benchmark definitions (all 8) | Task 3 |
| 5 | Extend BenchmarkCard & ResultsChart for streaming | Task 3 |
| 6 | Tab navigation refactor | None |
| 7 | Streaming benchmark screen | Tasks 4, 5, 6 |
| 8 | Modules README & sync instructions | None |

**Parallelizable groups:**
- Tasks 1, 3, 6, 8 can all run in parallel (no dependencies)
- Tasks 2, 4, 5 can run in parallel after their respective dependencies
- Task 7 must wait for tasks 4, 5, and 6

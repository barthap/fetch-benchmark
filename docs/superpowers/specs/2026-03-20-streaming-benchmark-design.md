# Streaming Benchmark Design Spec

## Goal

Add a streaming-specific benchmark screen to the fetch-benchmark app to measure the before/after impact of expo-fetch streaming performance improvements (ChunkCoalescer + NativeArrayBuffer). The primary comparison is stock `expo/fetch` (before) vs a custom patched module (after). Nitro fetch streaming will be added later.

## App Structure & Navigation

The app becomes a two-tab layout using Expo Router:

```
app/
  (tabs)/
    _layout.tsx          # Tab navigator (Bottom tabs via React Native Paper)
    index.tsx            # Existing whole-body benchmarks (moved from app/index.tsx)
    streaming.tsx        # New streaming benchmarks screen
  _layout.tsx            # Root layout (SafeArea + PaperProvider, unchanged)
```

The streaming screen mirrors the existing screen's UX: URL input, "Run Selected" controls, BenchmarkCard list, and ResultsChart. Existing components are reused with minor extensions for streaming-specific metrics.

## Benchmark Server

A unified Bun HTTP server replaces the existing Python static file server. Located in `server/`:

```
server/
  index.ts              # Main server entry (Bun.serve), static file serving from fixtures/
  endpoints/
    chunked.ts          # Large payload with chunked transfer encoding
    sse.ts              # SSE endpoint simulating LLM token streaming
    throttled.ts        # Throttled chunked endpoint (simulate slow network)
```

### Endpoints

- **Static files** — Serves `fixtures/` directory (replaces `python3 -m http.server`). Existing benchmarks use this.

- **`GET /chunked?size=50mb&chunkSize=64kb`** — Raw bytes via chunked transfer encoding. Configurable `size` (1mb, 10mb, 50mb, 100mb) and `chunkSize` params. Primary throughput benchmark endpoint.

- **`GET /sse`** — Server-Sent Events simulating LLM output. Returns `Content-Type: text/event-stream` with standard SSE format (`data: <token>\n\n`). Variable token sizes (2-30 bytes of random text), variable inter-token delays (5-80ms, modeling bursty real model output — fast bursts of 5-15 tokens at 5-15ms, separated by longer pauses of 40-80ms). ~500 tokens per request.

- **`GET /chunked?size=10mb&chunkSize=64kb&throttle=1mbps`** — Same chunked endpoint with optional `throttle` param for rate-limited output simulating slow networks.

### Running

```bash
bun run serve    # Starts unified Bun server (default port 3001)
```

Single `package.json` script replaces the old `cd fixtures && python3 -m http.server` command. The existing whole-body benchmark screen's default URL updates to `http://{hostURI}:3001/employees_50MB.json` to use the unified server.

## Streaming Benchmark Definitions

New file: `benchmarks/streaming.ts`

### Extended Result Type

```typescript
interface StreamingBenchmarkResult extends BenchmarkResult {
  timeToFirstChunkMs: number;    // Time from fetch() to first reader.read() resolving
  chunkCount: number;            // Number of reader.read() iterations
  droppedFrames?: number;        // Frame drops during streaming (optional)
}
```

### Runner Pattern

The existing `makeBenchmark()` utility constructs `BenchmarkResult` internally and controls timing — it cannot be reused for streaming benchmarks that need per-chunk metrics from the reader loop. Streaming benchmarks implement the `Benchmark` interface directly (i.e., `{ name, description, run: (url) => Promise<StreamingBenchmarkResult> }`), with a `makeStreamingBenchmark()` helper that handles:
- GC triggering after each run (matching existing pattern)
- Constructing the `reader.read()` drain loop with TTFC/chunk counting
- Accepting a `fetchFn` parameter for before/after implementation swapping
- Returning `StreamingBenchmarkResult`

The streaming screen passes a server base URL (e.g., `http://192.168.1.5:3001`) and each benchmark appends its endpoint path (e.g., `/chunked?size=50mb`). The screen has a "Server URL" text input (auto-populated from `Constants.expoConfig.hostUri` + port 3001), not a full URL input.

### Benchmark Scenarios

All benchmarks use Expo fetch with a before/after toggle for implementation selection.

| Benchmark | Endpoint | What it measures |
|-----------|----------|-----------------|
| Stream drain 1MB | `/chunked?size=1mb` | Throughput baseline, small payload |
| Stream drain 10MB | `/chunked?size=10mb` | Throughput, medium payload |
| Stream drain 50MB | `/chunked?size=50mb` | Throughput, large payload (primary) |
| Stream drain 100MB | `/chunked?size=100mb` | Throughput at scale |
| SSE / LLM simulation | `/sse` | TTFC, per-token latency, total time |
| Throttled stream 10MB | `/chunked?size=10mb&throttle=1mbps` | Behavior under constrained bandwidth |
| Concurrent 3x 10MB | 3x `/chunked?size=10mb` | Parallel stream performance |
| Stream + animation | `/chunked?size=50mb` | Frame drops during streaming |

### Implementation

Each benchmark uses the standard `reader.read()` loop:

```typescript
const response = await fetchFn(url);
const reader = response.body.getReader();
const startTime = performance.now();
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
```

**Concurrent 3x 10MB**: Uses `Promise.all()` to drain three streams simultaneously. Reports wall-clock time for all three to complete, aggregate total bytes, and sum of chunk counts. TTFC is measured as time to first chunk from *any* of the three streams.

**SSE / LLM simulation**: The `/sse` endpoint returns `Content-Type: text/event-stream` with standard SSE format (`data: <token>\n\n`). The client drains the raw ReadableStream (not EventSource), parsing SSE frames to measure per-token arrival times. Reports TTFC (first token), median inter-token latency, and total drain time.

**Stream + animation**: Runs a Reanimated loop animation alongside the drain. A `requestAnimationFrame` loop tracks frame timestamps — a frame is counted as "dropped" when the delta exceeds 32ms (2x the 16ms target at 60fps). Reports total dropped frames and percentage.

**Throttle implementation**: The server uses timed chunk release — `setTimeout` between writes to the response stream, calculated from the target rate (e.g., 1mbps = ~128KB/s, so a 64KB chunk every ~500ms).

### Before/After Toggle

A UI switch at the top of the streaming screen selects:
- **Before**: stock `expo/fetch` from node_modules
- **After**: custom module from `modules/expo-fetch-next`

Both run identical benchmarks for direct comparison. The toggle sets which `fetchFn` is passed to `makeStreamingBenchmark()`.

## Results Display & Comparison

### Per-Benchmark Card

Extends existing BenchmarkCard to show:
- Duration (ms) and throughput (MB/s)
- Time to first chunk (ms)
- Chunk count
- Dropped frames (animation test only)

### Chart

ResultsChart gets a `metricKey` prop for rendering different metrics (duration, TTFC, throughput) and a configurable `title` prop (replacing the hardcoded "Benchmark Results (50MB JSON)"). A segmented button toggles which metric the chart displays.

### Before/After Comparison

State structure for dual result storage:

```typescript
type ImplKey = "before" | "after";
const [results, setResults] = useState<Record<ImplKey, Record<string, StreamingBenchmarkResult>>>({
  before: {},
  after: {},
});
const [activeImpl, setActiveImpl] = useState<ImplKey>("before");
```

Flow:
1. Select "Before", run all benchmarks — results stored in `results.before`
2. Switch to "After", run again — results stored in `results.after`
3. Chart shows grouped bars: before (gray) vs after (colored)

Results are in-memory only (no persistence across app restarts). The export feature covers the persistence need.

### Export

A share button exports results as JSON via `Share.share()` (native share sheet). The JSON includes both before and after result sets, device info, and timestamp.

```typescript
{
  device: string;
  timestamp: string;
  results: Record<ImplKey, Record<string, StreamingBenchmarkResult>>;
}
```

## The `expo-fetch-next` Module

This is the "after" implementation — a renamed copy of the expo-fetch module from the local expo checkout with the ChunkCoalescer/NativeArrayBuffer improvements.

### Structure

```
modules/
  expo-fetch-next/
    index.ts                    # Re-exports the patched fetch: export { fetch } from './src/...'
    expo-module.config.json     # Expo module config with renamed native module
    src/                        # Copied + renamed source from expo/packages/expo
    ios/                        # Renamed Swift module (ExpoFetchNext instead of ExpoFetch)
    android/                    # Renamed Kotlin module
  sync.sh                       # Sync script (rsync + patch)
  renames.patch                  # Generated rename diff
  README.md                     # Setup instructions
```

### Import API

```typescript
// Before (stock)
import { fetch as expoFetch } from "expo/fetch";

// After (patched)
import { fetch as expoFetchNext } from "expo-fetch-next";
```

The before/after toggle in the UI switches which of these is passed as `fetchFn` to the benchmarks.

### Key Renames

The module must rename all public symbols to avoid conflicts with the stock expo package:
- Module name: `ExpoFetch` -> `ExpoFetchNext`
- Swift class: `ExpoFetchModule` -> `ExpoFetchNextModule`
- Kotlin class: same pattern
- Package name in `expo-module.config.json`

The user will handle the initial manual rename and module creation. The sync workflow (below) automates refreshing from upstream.

### Module Sync Workflow

Documented in `modules/README.md`. Enables refreshing the custom expo-fetch-next module from the local expo checkout while preserving renames:

1. First time: copy relevant files from `~/dev/expo/packages/expo` (primarily `ios/Fetch/`, `android/src/.../fetch/`, and the JS/TS fetch source), do manual renames
2. Generate rename patch: `diff -ruN modules/expo-fetch-next-clean/ modules/expo-fetch-next/ > modules/renames.patch` (where `-clean` is an unmodified copy for diffing)
3. Sync script (`modules/sync.sh`): `rsync` fresh files from `~/dev/expo/packages/expo`, then `patch -p1 < renames.patch` to reapply renames

## Future: Native Instrumentation Module

A separate prompt (`docs/superpowers/prompts/native-metrics-module.md`) describes a future Expo module (`expo-benchmark-metrics`) for richer metrics:
- Memory high-water mark
- Native chunk dispatch counter
- JS thread CPU time
- GC pause tracking

The streaming benchmarks work without this module but report richer data when installed.

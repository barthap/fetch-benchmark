# Fetch Benchmark App Improvements — Design Spec

## Overview

Improve the fetch-benchmark app's measurement accuracy and data richness by adding a native metrics module, multi-run statistical methodology, and enhanced JSON export. The goal is to produce reliable, comparable benchmark data for evaluating expo-fetch streaming performance against competitors.

## Background

The app currently runs single-execution benchmarks collecting JS-only metrics (throughput, TTFC, chunk count, frame drops). This is insufficient for reliable comparison:
- Single runs are noisy (GC, thermal throttling, background processes)
- No memory or CPU visibility
- No way to validate that native-side optimizations (ChunkCoalescer, NativeArrayBuffer) actually reduce dispatch count or memory pressure

## Architecture

Two tracks, implemented sequentially:

```
Track 1: expo-benchmark-metrics native module
  -> Exposes memory usage + JS thread CPU time from native APIs

Track 2: Methodology & integration
  -> Multi-run loop, measurement wrappers, extended types, JSON export
```

### Dependency Graph

```
expo-benchmark-metrics module
  -> JS measurement wrapper (snapshots before/after)
    -> Multi-run loop utility
      -> Extended result types
        -> Export JSON enhancement (P0)
          -> BenchmarkCard native metrics display (P1)
```

---

## Track 1: `expo-benchmark-metrics` Native Module

### Location

`modules/expo-benchmark-metrics/` — already scaffolded as hello-world, needs implementation.

**Scaffold cleanup**: Remove all View-related boilerplate from the scaffold (any `*View.swift`, `*View.kt`, `*View.tsx`, `*View.web.tsx` files, and any `View(...)` blocks in native module definitions). This module exposes only synchronous functions, no views.

### JS API

```typescript
import * as BenchmarkMetrics from 'expo-benchmark-metrics';

// Memory: returns current resident memory usage in bytes
BenchmarkMetrics.getMemoryUsageBytes(): number;

// CPU: returns cumulative JS thread CPU time in milliseconds
BenchmarkMetrics.getJSThreadCpuTimeMs(): number;
```

Both methods are **synchronous** to minimize measurement overhead. Both execute on the JS thread, which is what makes the CPU time measurement work (we're measuring the calling thread).

### iOS Implementation (`ExpoBenchmarkMetricsModule.swift`)

**getMemoryUsageBytes():**
```
Use mach_task_basic_info via task_info() syscall.
Returns resident_size (RSS) as a Double (for JS number compatibility).
```

Key API:
- `task_info(mach_task_self_, TASK_BASIC_INFO, ...)` with `mach_task_basic_info`
- Returns `info.resident_size` (bytes)
- May require importing `Darwin` or `MachO` headers
- If Swift API is awkward, use an Objective-C++ bridge file

**getJSThreadCpuTimeMs():**
```
Use mach_thread_self() + thread_info() with THREAD_BASIC_INFO.
Returns user_time + system_time converted to milliseconds.
```

Key API:
- `mach_thread_self()` — gets Mach port for current (JS) thread
- `thread_info(thread, THREAD_BASIC_INFO, ...)` with `thread_basic_info`
- `info.user_time.seconds * 1000 + info.user_time.microseconds / 1000` + same for `system_time`
- **Important**: Deallocate port after use to prevent port leaks:
  ```c
  mach_port_t thread = mach_thread_self();
  // ... thread_info call ...
  mach_port_deallocate(mach_task_self_, thread);
  ```
  This is called frequently during benchmarks, so leaking the port would be problematic.

Note: These are C APIs. If Swift bridging is problematic, implement in an `.mm` (Objective-C++) helper file and call from Swift.

### Android Implementation (`ExpoBenchmarkMetricsModule.kt`)

**getMemoryUsageBytes():**
```kotlin
val runtime = Runtime.getRuntime()
val jvmUsed = runtime.totalMemory() - runtime.freeMemory()
val nativeHeap = Debug.getNativeHeapAllocatedSize()
return (jvmUsed + nativeHeap).toDouble()
```

**getJSThreadCpuTimeMs():**
```kotlin
// Called on JS thread, so currentThreadTimeMillis() returns JS thread CPU time
return SystemClock.currentThreadTimeMillis().toDouble()
```

`SystemClock.currentThreadTimeMillis()` returns milliseconds of CPU time for the calling thread. Since synchronous Expo module functions run on the JS thread, this directly gives us what we want.

### Cross-Platform Memory Note

iOS `resident_size` (RSS) and Android `jvmUsed + nativeHeap` measure different things. iOS RSS includes memory-mapped files, shared libraries, etc. **Memory numbers are not directly comparable across platforms.** Only compare deltas (post - pre) within the same platform and device.

### Module Registration

Standard Expo module pattern:
- `expo-module.config.json` with platform entries
- Module class extends `Module` with `definition { }` block (Kotlin) / `Module` protocol (Swift)
- Functions registered as synchronous: `Function("getMemoryUsageBytes") { ... }`

---

## Track 2: Methodology & Integration

### 2a. Extended Result Types

**File: `benchmarks/types.ts`**

Add optional native metric fields to `BenchmarkResult` (additive only — all existing fields including `error?: string` remain unchanged):

```typescript
// NEW fields added to existing BenchmarkResult interface
memoryDeltaBytes?: number;
jsThreadCpuMs?: number;
gcCount?: number;
gcTotalPauseMs?: number;
```

`StreamingBenchmarkResult` extends `BenchmarkResult` so it inherits the new fields.

Add a multi-run result wrapper:
```typescript
interface MultiRunResult<T extends BenchmarkResult = BenchmarkResult> {
  median: T;           // primary result (median by durationMs)
  runs: T[];           // all measured runs (excludes warm-up)
  runCount: number;    // how many measured runs
  warmUpRun?: T;       // the discarded warm-up run (for debugging)
}
```

**State shape change in screens:**
- `index.tsx`: `results` state changes from `Record<string, BenchmarkResult>` to `Record<string, MultiRunResult<BenchmarkResult>>`
- `streaming.tsx`: `results` state changes from `Record<ImplKey, Record<string, StreamingBenchmarkResult>>` to `Record<ImplKey, Record<string, MultiRunResult<StreamingBenchmarkResult>>>`

**BenchmarkCard receives `MultiRunResult`** — it renders `result.median` as the primary display (same as today), with the native metrics section showing median values. The full `runs` array is only used by the export.

### 2b. GC Stats Utility (Pure JS)

**File: `benchmarks/gc-utils.ts`** (new)

```typescript
interface GCStats {
  count: number;       // maps to HermesInternal numGCs
  totalPauseMs: number; // maps to HermesInternal gcTotalTime (in ms)
}

function getGCStats(): GCStats | null;
```

Hermes field mapping (from `HermesInternal.getInstrumentedStats()`):
- `numGCs` (number) — total GC collections since process start
- `gcTotalTime` (number) — total GC pause time in ms

Guard with `typeof HermesInternal !== 'undefined'` and try/catch. Returns `null` if unavailable (non-Hermes runtime). Callers take snapshots before/after and diff the two.

### 2c. Measurement Wrapper

**File: `benchmarks/measure.ts`** (new)

A `withNativeMetrics<T>(fn: () => Promise<T>): Promise<T & NativeMetrics>` wrapper that:
1. Snapshots memory, CPU time, GC stats (if available)
2. Calls `fn()` (the actual benchmark)
3. Snapshots again
4. Returns the original result merged with `{ memoryDeltaBytes, jsThreadCpuMs, gcCount, gcTotalPauseMs }`

The native module is imported with `try/catch` — if not available, metrics fields are undefined.

**Integration point**: `withNativeMetrics` wraps each individual benchmark `run()` call. For whole-body benchmarks, it wraps the `benchmark.run(url)` call in the screen component. For streaming benchmarks, it wraps the `benchmark.run(fetchFn, baseUrl)` call — same level. The benchmark definitions themselves are not modified.

### 2d. Multi-Run Loop

**File: `benchmarks/multi-run.ts`** (new utility, shared by both screens)

```typescript
async function runMultiple<T extends BenchmarkResult>(
  runFn: () => Promise<T>,
  options: { runCount: number; onProgress?: (current: number, total: number) => void }
): Promise<MultiRunResult<T>>;
```

Logic:
1. Execute 1 warm-up run (result stored in `warmUpRun`)
2. Call `HermesInternal?.collectGarbage?.()` after warm-up (more reliable than `global.gc?.()` on Hermes)
3. Execute N measured runs, each wrapped with `withNativeMetrics()`
4. Call `HermesInternal?.collectGarbage?.()` between runs
5. Sort runs by `durationMs`, pick median
6. Return `MultiRunResult`

The `onProgress` callback lets screens update UI with "Run 2/3" status. Screens store a `runProgress` state (`{ current: number, total: number } | null`) and display it alongside the "running" status.

**UI control**: A stepper (1-10) for run count, placed near the "Run All" button. Default 3.

### 2e. Export JSON Enhancement

**Streaming tab export** (`streaming.tsx`):

```typescript
{
  exportVersion: 2,                    // bump from implicit v1
  device: { ... },                     // existing device info
  timestamp: string,                   // ISO 8601
  expoFetchVersion: string,            // from package.json or Constants
  benchmarkAppVersion: string,         // from app.json
  runCount: number,                    // configured run count
  results: {
    [implKey: string]: {               // "before" | "after"
      [benchmarkId: string]: {
        median: StreamingBenchmarkResult,
        runs: StreamingBenchmarkResult[],
        warmUpRun?: StreamingBenchmarkResult,
      }
    }
  }
}
```

The whole-body tab (`index.tsx`) should get the same export capability (currently missing). Same format, but without the `implKey` nesting (whole-body tab has no before/after).

No backward compatibility concern — there are no existing analysis tools consuming v1 exports.

### 2f. BenchmarkCard Native Metrics (P1)

Add a collapsible section below existing metrics:
- Memory delta: formatted as KB or MB (e.g., "+2.4 MB")
- JS CPU time: ms
- GC: "3 collections, 12ms total"

Only rendered when at least one native metric is available. Collapsed by default to keep the card compact.

---

## What's NOT Changing

- Benchmark definitions (`benchmarks/index.ts`, `benchmarks/streaming.ts`) — the `run()` functions stay as-is
- Server endpoints — no changes
- Chart component — no changes (follow-up)
- No new benchmark scenarios in this spec
- Whole-body tab does not get before/after comparison (follow-up)

## Key Considerations

- Memory measurement is inherently noisy — the multi-run median helps, but absolute values should be compared with caution
- `getMemoryUsageBytes()` captures the whole process, not just fetch-related allocations. The delta (post - pre) is the meaningful metric.
- iOS and Android memory numbers are NOT comparable — only compare within the same platform.
- iOS CPU time via `thread_info` may need an Objective-C++ helper if Swift bridging is awkward. This is expected and fine.
- The multi-run loop adds wall-clock time to the benchmark session (4x with warm-up). The UI should show progress (e.g., "Run 2/3") via the `onProgress` callback.
- `HermesInternal?.collectGarbage?.()` is preferred over `global.gc?.()` for more reliable GC forcing on Hermes. Falls back to no-op if unavailable.

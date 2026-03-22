# Benchmark Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native metrics collection (memory, CPU time), multi-run statistical methodology, and enhanced JSON export to the fetch-benchmark app.

**Architecture:** A local Expo module (`expo-benchmark-metrics`) exposes synchronous native functions for memory and CPU measurement. A shared multi-run utility orchestrates warm-up + N measured runs, wrapping each with native metric snapshots. Results are exported as structured JSON with all individual runs.

**Tech Stack:** Expo SDK 55, React Native 0.83, Hermes, Swift (iOS), Kotlin (Android), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-22-benchmark-improvements-design.md`

---

## File Structure

### New Files
- `benchmarks/gc-utils.ts` — GC stats wrapper around HermesInternal
- `benchmarks/measure.ts` — `withNativeMetrics()` wrapper, snapshots before/after
- `benchmarks/multi-run.ts` — `runMultiple()` orchestrator (warm-up + N runs + median)

### Modified Files
- `modules/expo-benchmark-metrics/index.ts` — replace hello-world exports with metric functions
- `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsModule.ts` — typed module interface
- `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetrics.types.ts` — clean up unused types
- `modules/expo-benchmark-metrics/ios/ExpoBenchmarkMetricsModule.swift` — memory + CPU implementation
- `modules/expo-benchmark-metrics/android/src/main/java/expo/modules/benchmarkmetrics/ExpoBenchmarkMetricsModule.kt` — memory + CPU implementation
- `benchmarks/types.ts` — add native metric fields + `MultiRunResult<T>`
- `app/(tabs)/index.tsx` — integrate multi-run, add export
- `app/(tabs)/streaming.tsx` — integrate multi-run, update export
- `components/BenchmarkCard.tsx` — display native metrics section

### Files to Delete
- `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsView.tsx`
- `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsView.web.tsx`
- `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsModule.web.ts`
- `modules/expo-benchmark-metrics/ios/ExpoBenchmarkMetricsView.swift`
- `modules/expo-benchmark-metrics/android/src/main/java/expo/modules/benchmarkmetrics/ExpoBenchmarkMetricsView.kt`

---

## Task 1: Clean Up Module Scaffold

**Files:**
- Delete: `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsView.tsx`
- Delete: `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsView.web.tsx`
- Delete: `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsModule.web.ts`
- Delete: `modules/expo-benchmark-metrics/ios/ExpoBenchmarkMetricsView.swift`
- Delete: `modules/expo-benchmark-metrics/android/src/main/java/expo/modules/benchmarkmetrics/ExpoBenchmarkMetricsView.kt`
- Modify: `modules/expo-benchmark-metrics/index.ts`
- Modify: `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetrics.types.ts`
- Modify: `modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsModule.ts`

- [ ] **Step 1: Delete View files**

Remove all 5 View-related files listed above. These are unused — the module only exposes sync functions, no views.

- [ ] **Step 2: Replace TypeScript module interface**

`modules/expo-benchmark-metrics/src/ExpoBenchmarkMetricsModule.ts`:
```typescript
import { requireNativeModule } from "expo-modules-core";

declare class ExpoBenchmarkMetricsModule {
  getMemoryUsageBytes(): number;
  getJSThreadCpuTimeMs(): number;
}

export default requireNativeModule<ExpoBenchmarkMetricsModule>(
  "ExpoBenchmarkMetrics"
);
```

- [ ] **Step 3: Clean up types file**

`modules/expo-benchmark-metrics/src/ExpoBenchmarkMetrics.types.ts`:
```typescript
// No types needed — module exposes only primitive return values.
// This file kept for convention; add types here if the API grows.
```

- [ ] **Step 4: Replace index.ts exports**

`modules/expo-benchmark-metrics/index.ts`:
```typescript
import ExpoBenchmarkMetricsModule from "./src/ExpoBenchmarkMetricsModule";

export function getMemoryUsageBytes(): number {
  return ExpoBenchmarkMetricsModule.getMemoryUsageBytes();
}

export function getJSThreadCpuTimeMs(): number {
  return ExpoBenchmarkMetricsModule.getJSThreadCpuTimeMs();
}
```

- [ ] **Step 5: Commit**

```bash
git add -A modules/expo-benchmark-metrics/
git commit -m "chore: clean up expo-benchmark-metrics scaffold, define JS API"
```

---

## Task 2: Implement iOS Native Module

**Files:**
- Modify: `modules/expo-benchmark-metrics/ios/ExpoBenchmarkMetricsModule.swift`

- [ ] **Step 1: Replace Swift module with memory + CPU functions**

`modules/expo-benchmark-metrics/ios/ExpoBenchmarkMetricsModule.swift`:
```swift
import ExpoModulesCore
import Darwin

public class ExpoBenchmarkMetricsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoBenchmarkMetrics")

    Function("getMemoryUsageBytes") { () -> Double in
      var info = mach_task_basic_info()
      var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
      let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
          task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
      }
      guard result == KERN_SUCCESS else {
        return -1
      }
      return Double(info.resident_size)
    }

    Function("getJSThreadCpuTimeMs") { () -> Double in
      let thread = mach_thread_self()
      defer { mach_port_deallocate(mach_task_self_, thread) }

      var info = thread_basic_info()
      var count = mach_msg_type_number_t(MemoryLayout<thread_basic_info>.size) / 4
      let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
          thread_info(thread, thread_flavor_t(THREAD_BASIC_INFO), $0, &count)
        }
      }
      guard result == KERN_SUCCESS else {
        return -1
      }
      let userMs = Double(info.user_time.seconds) * 1000.0
        + Double(info.user_time.microseconds) / 1000.0
      let systemMs = Double(info.system_time.seconds) * 1000.0
        + Double(info.system_time.microseconds) / 1000.0
      return userMs + systemMs
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/barthap/dev/experiments/fetch-benchmark && bunx expo run:ios --no-install 2>&1 | head -50
```

If Swift bridging has issues with the Mach APIs, create an Objective-C++ helper (`ExpoBenchmarkMetricsHelper.mm`) and call it from Swift. This is noted in the spec as an expected fallback.

- [ ] **Step 3: Commit**

```bash
git add modules/expo-benchmark-metrics/ios/
git commit -m "feat(ios): implement getMemoryUsageBytes and getJSThreadCpuTimeMs"
```

---

## Task 3: Implement Android Native Module

**Files:**
- Modify: `modules/expo-benchmark-metrics/android/src/main/java/expo/modules/benchmarkmetrics/ExpoBenchmarkMetricsModule.kt`

- [ ] **Step 1: Replace Kotlin module with memory + CPU functions**

`modules/expo-benchmark-metrics/android/src/main/java/expo/modules/benchmarkmetrics/ExpoBenchmarkMetricsModule.kt`:
```kotlin
package expo.modules.benchmarkmetrics

import android.os.Debug
import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoBenchmarkMetricsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoBenchmarkMetrics")

    Function("getMemoryUsageBytes") {
      val runtime = Runtime.getRuntime()
      val jvmUsed = runtime.totalMemory() - runtime.freeMemory()
      val nativeHeap = Debug.getNativeHeapAllocatedSize()
      return@Function (jvmUsed + nativeHeap).toDouble()
    }

    Function("getJSThreadCpuTimeMs") {
      return@Function SystemClock.currentThreadTimeMillis().toDouble()
    }
  }
}
```

- [ ] **Step 2: Delete the Android View file**

Delete `modules/expo-benchmark-metrics/android/src/main/java/expo/modules/benchmarkmetrics/ExpoBenchmarkMetricsView.kt` if not already deleted in Task 1.

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/barthap/dev/experiments/fetch-benchmark && bunx expo run:android --no-install 2>&1 | head -50
```

- [ ] **Step 4: Commit**

```bash
git add modules/expo-benchmark-metrics/android/
git commit -m "feat(android): implement getMemoryUsageBytes and getJSThreadCpuTimeMs"
```

---

## Task 4: Extend Result Types

**Files:**
- Modify: `benchmarks/types.ts`

- [ ] **Step 1: Add native metric fields and MultiRunResult**

Add to the end of `benchmarks/types.ts` (after existing types, preserving all existing definitions unchanged):

```typescript
export interface MultiRunResult<T extends BenchmarkResult = BenchmarkResult> {
  median: T;
  runs: T[];
  runCount: number;
  warmUpRun?: T;
}
```

Also add the native metric fields as optional properties to the existing `BenchmarkResult` interface (lines 5-10):

```typescript
interface BenchmarkResult {
  durationMs: number;
  sizeBytes: number;
  throughputMbPerCc?: number;
  error?: string;
  statusCode?: number;
  // Native metrics (optional)
  memoryDeltaBytes?: number;
  jsThreadCpuMs?: number;
  gcCount?: number;
  gcTotalPauseMs?: number;
}
```

- [ ] **Step 2: Export the new types**

Ensure `MultiRunResult` is exported (use `export interface` as above).

- [ ] **Step 3: Commit**

```bash
git add benchmarks/types.ts
git commit -m "feat: add native metrics fields and MultiRunResult type"
```

---

## Task 5: GC Stats Utility

**Files:**
- Create: `benchmarks/gc-utils.ts`

- [ ] **Step 1: Create gc-utils.ts**

`benchmarks/gc-utils.ts`:
```typescript
export interface GCSnapshot {
  numGCs: number;
  gcTotalTimeMs: number;
}

declare const HermesInternal: {
  getInstrumentedStats?: () => {
    numGCs?: number;
    gcTotalTime?: number;
  };
  collectGarbage?: () => void;
} | undefined;

/**
 * Snapshot current GC stats from Hermes. Returns null if unavailable.
 */
export function getGCSnapshot(): GCSnapshot | null {
  try {
    if (typeof HermesInternal === "undefined") return null;
    const stats = HermesInternal.getInstrumentedStats?.();
    if (!stats || stats.numGCs == null || stats.gcTotalTime == null) return null;
    return { numGCs: stats.numGCs, gcTotalTimeMs: stats.gcTotalTime };
  } catch {
    return null;
  }
}

/**
 * Diff two GC snapshots to get delta.
 */
export function diffGCSnapshots(
  before: GCSnapshot | null,
  after: GCSnapshot | null
): { gcCount: number; gcTotalPauseMs: number } | null {
  if (!before || !after) return null;
  return {
    gcCount: after.numGCs - before.numGCs,
    gcTotalPauseMs: Math.max(0, after.gcTotalTimeMs - before.gcTotalTimeMs),
  };
}

/**
 * Best-effort GC trigger. Uses HermesInternal if available, falls back to global.gc.
 */
export function tryCollectGarbage(): void {
  try {
    if (typeof HermesInternal !== "undefined") {
      HermesInternal.collectGarbage?.();
      return;
    }
  } catch {}
  try {
    (globalThis as any).gc?.();
  } catch {}
}
```

- [ ] **Step 2: Commit**

```bash
git add benchmarks/gc-utils.ts
git commit -m "feat: add GC stats utility wrapping HermesInternal"
```

---

## Task 6: Native Metrics Measurement Wrapper

**Files:**
- Create: `benchmarks/measure.ts`

- [ ] **Step 1: Create measure.ts**

`benchmarks/measure.ts`:
```typescript
import type { BenchmarkResult } from "./types";
import { getGCSnapshot, diffGCSnapshots } from "./gc-utils";

let BenchmarkMetrics: {
  getMemoryUsageBytes(): number;
  getJSThreadCpuTimeMs(): number;
} | null = null;

try {
  BenchmarkMetrics = require("expo-benchmark-metrics");
} catch {
  // Module not available — native metrics will be undefined
}

interface Snapshot {
  memoryBytes: number | null;
  cpuTimeMs: number | null;
  gc: { numGCs: number; gcTotalTimeMs: number } | null;
}

function takeSnapshot(): Snapshot {
  return {
    memoryBytes: BenchmarkMetrics?.getMemoryUsageBytes() ?? null,
    cpuTimeMs: BenchmarkMetrics?.getJSThreadCpuTimeMs() ?? null,
    gc: getGCSnapshot(),
  };
}

/**
 * Wraps a benchmark run function, adding native metric deltas to the result.
 */
export async function withNativeMetrics<T extends BenchmarkResult>(
  fn: () => Promise<T>
): Promise<T> {
  const before = takeSnapshot();
  const result = await fn();
  const after = takeSnapshot();

  const gcDiff = diffGCSnapshots(before.gc, after.gc);

  return {
    ...result,
    memoryDeltaBytes:
      before.memoryBytes != null && after.memoryBytes != null
        ? after.memoryBytes - before.memoryBytes
        : undefined,
    jsThreadCpuMs:
      before.cpuTimeMs != null && after.cpuTimeMs != null
        ? Math.round((after.cpuTimeMs - before.cpuTimeMs) * 100) / 100
        : undefined,
    gcCount: gcDiff?.gcCount,
    gcTotalPauseMs: gcDiff?.gcTotalPauseMs,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add benchmarks/measure.ts
git commit -m "feat: add withNativeMetrics measurement wrapper"
```

---

## Task 7: Multi-Run Orchestrator

**Files:**
- Create: `benchmarks/multi-run.ts`

- [ ] **Step 1: Create multi-run.ts**

`benchmarks/multi-run.ts`:
```typescript
import type { BenchmarkResult, MultiRunResult } from "./types";
import { withNativeMetrics } from "./measure";
import { tryCollectGarbage } from "./gc-utils";

export interface MultiRunOptions {
  runCount: number;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Runs a benchmark multiple times with warm-up, returns median result.
 * Each run is wrapped with native metrics collection.
 */
export async function runMultiple<T extends BenchmarkResult>(
  runFn: () => Promise<T>,
  options: MultiRunOptions
): Promise<MultiRunResult<T>> {
  const { runCount, onProgress } = options;

  // Warm-up run (discarded from stats)
  onProgress?.(0, runCount);
  const warmUpRun = await withNativeMetrics(runFn);
  tryCollectGarbage();

  // Measured runs
  const runs: T[] = [];
  for (let i = 0; i < runCount; i++) {
    onProgress?.(i + 1, runCount);
    const result = await withNativeMetrics(runFn);
    runs.push(result);

    if (i < runCount - 1) {
      tryCollectGarbage();
    }
  }

  // Pick median by durationMs
  const sorted = [...runs].sort((a, b) => a.durationMs - b.durationMs);
  const medianIndex = Math.floor(sorted.length / 2);
  const median = sorted[medianIndex];

  return {
    median,
    runs,
    runCount,
    warmUpRun: warmUpRun as T,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add benchmarks/multi-run.ts
git commit -m "feat: add multi-run orchestrator with warm-up and median"
```

---

## Task 8: Integrate Multi-Run into Whole-Body Screen

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Update imports and state type**

At top of `index.tsx`, add imports:
```typescript
import type { MultiRunResult } from "../../benchmarks/types";
import { runMultiple } from "../../benchmarks/multi-run";
```

Change state on line 18 from:
```typescript
const [results, setResults] = useState<Record<string, BenchmarkResult>>({});
```
to:
```typescript
const [results, setResults] = useState<Record<string, MultiRunResult>>({});
const [runCount, setRunCount] = useState(3);
const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
```

- [ ] **Step 2: Update runBenchmark to use runMultiple**

Replace the `runBenchmark` function (lines 29-56) with:
```typescript
const runBenchmark = async (id: string) => {
  const benchmark = benchmarks.find((b) => b.id === id);
  if (!benchmark) return;
  try {
    setStatuses((prev) => ({ ...prev, [id]: "running" }));
    setResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const multiResult = await runMultiple(() => benchmark.run(url), {
      runCount,
      onProgress: (current, total) => setRunProgress({ current, total }),
    });

    setResults((prev) => ({ ...prev, [id]: multiResult }));
    setStatuses((prev) => ({ ...prev, [id]: "success" }));
  } catch (e) {
    setStatuses((prev) => ({ ...prev, [id]: "error" }));
    setResults((prev) => ({
      ...prev,
      [id]: {
        median: {
          durationMs: 0,
          sizeBytes: 0,
          error: e instanceof Error ? e.message : String(e),
        },
        runs: [],
        runCount: 0,
      },
    }));
  } finally {
    setRunProgress(null);
  }
};
```

- [ ] **Step 3: Update ResultsChart and BenchmarkCard to use median**

Where `results` is passed to `ResultsChart`, map to medians:
```typescript
const medianResults = Object.fromEntries(
  Object.entries(results).map(([id, mr]) => [id, mr.median])
);
```
Pass `results={medianResults}` to `ResultsChart`.

For `BenchmarkCard`, pass `result={results[b.id]?.median}`.

- [ ] **Step 4: Add run count stepper and progress display**

Add a row near the "Run Selected" button with a stepper for run count:
```typescript
<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
  <Text>Runs:</Text>
  <Button onPress={() => setRunCount((c) => Math.max(1, c - 1))}>-</Button>
  <Text>{runCount}</Text>
  <Button onPress={() => setRunCount((c) => Math.min(10, c + 1))}>+</Button>
</View>
```

Show progress when running:
```typescript
{runProgress && (
  <Text>Run {runProgress.current}/{runProgress.total}</Text>
)}
```

- [ ] **Step 5: Add export function**

Add imports at the top of `index.tsx` (if not already present):
```typescript
import { Share } from "react-native";
import Constants from "expo-constants";
```

Add an export function matching the pattern already used in `streaming.tsx`:
```typescript
const exportResults = async () => {
  const data = {
    exportVersion: 2,
    device: Constants.deviceName ?? "unknown",
    timestamp: new Date().toISOString(),
    runCount,
    results: Object.fromEntries(
      Object.entries(results).map(([id, mr]) => [
        id,
        { median: mr.median, runs: mr.runs, warmUpRun: mr.warmUpRun },
      ])
    ),
  };
  await Share.share({ message: JSON.stringify(data, null, 2) });
};
```

Add an "Export" button next to "Run Selected".

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: integrate multi-run and export into whole-body screen"
```

---

## Task 9: Integrate Multi-Run into Streaming Screen

**Files:**
- Modify: `app/(tabs)/streaming.tsx`

- [ ] **Step 1: Update imports and state type**

Add imports:
```typescript
import type { MultiRunResult } from "../../benchmarks/types";
import { runMultiple } from "../../benchmarks/multi-run";
```

Change results state (lines 28-31) from:
```typescript
const [results, setResults] = useState<
  Record<ImplKey, Record<string, StreamingBenchmarkResult>>
>({ before: {}, after: {} });
```
to:
```typescript
const [results, setResults] = useState<
  Record<ImplKey, Record<string, MultiRunResult<StreamingBenchmarkResult>>>
>({ before: {}, after: {} });
const [runCount, setRunCount] = useState(3);
const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);
```

- [ ] **Step 2: Update runBenchmark to use runMultiple**

Replace the `runBenchmark` function (lines 49-79). Key change — wrap `benchmark.run(baseUrl)` with `runMultiple`:

```typescript
const runBenchmark = async (id: string) => {
  const benchmark = benchmarks.find((b) => b.id === id);
  if (!benchmark) return;
  try {
    setStatuses((prev) => ({ ...prev, [id]: "running" }));
    setResults((prev) => ({
      ...prev,
      [activeImpl]: { ...prev[activeImpl], [id]: undefined },
    }));

    const multiResult = await runMultiple(
      () => benchmark.run(baseUrl) as Promise<StreamingBenchmarkResult>,
      {
        runCount,
        onProgress: (current, total) => setRunProgress({ current, total }),
      }
    );

    setResults((prev) => ({
      ...prev,
      [activeImpl]: { ...prev[activeImpl], [id]: multiResult },
    }));
    setStatuses((prev) => ({ ...prev, [id]: "success" }));
  } catch (e) {
    setStatuses((prev) => ({ ...prev, [id]: "error" }));
    setResults((prev) => ({
      ...prev,
      [activeImpl]: {
        ...prev[activeImpl],
        [id]: {
          median: {
            durationMs: 0,
            sizeBytes: 0,
            timeToFirstChunkMs: 0,
            chunkCount: 0,
            error: e instanceof Error ? e.message : String(e),
          },
          runs: [],
          runCount: 0,
        },
      },
    }));
  } finally {
    setRunProgress(null);
  }
};
```

- [ ] **Step 3: Update currentResults derivation and chart/card props**

Derive medians for chart and card:
```typescript
const currentMultiResults = results[activeImpl];
const currentResults = Object.fromEntries(
  Object.entries(currentMultiResults)
    .filter(([, mr]) => mr != null)
    .map(([id, mr]) => [id, mr.median])
);
```

Pass `results={currentResults}` to `ResultsChart` and `result={currentMultiResults[b.id]?.median}` to `BenchmarkCard`.

- [ ] **Step 4: Add run count stepper and progress display**

Same pattern as Task 8, Step 4 — add stepper and progress text near the action buttons.

- [ ] **Step 5: Update exportResults**

Replace `exportResults` (lines 89-96) with enhanced version. `Constants` and `Share` are already imported in this file:
```typescript
const exportResults = async () => {
  const data = {
    exportVersion: 2,
    device: Constants.deviceName ?? "unknown",
    timestamp: new Date().toISOString(),
    runCount,
    results: Object.fromEntries(
      Object.entries(results).map(([impl, benchmarks]) => [
        impl,
        Object.fromEntries(
          Object.entries(benchmarks)
            .filter(([, mr]) => mr != null)
            .map(([id, mr]) => [
              id,
              { median: mr.median, runs: mr.runs, warmUpRun: mr.warmUpRun },
            ])
        ),
      ])
    ),
  };
  await Share.share({ message: JSON.stringify(data, null, 2) });
};
```

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/streaming.tsx
git commit -m "feat: integrate multi-run and enhanced export into streaming screen"
```

---

## Task 10: Update BenchmarkCard with Native Metrics Display

**Files:**
- Modify: `components/BenchmarkCard.tsx`

- [ ] **Step 1: Add native metrics section**

After the existing metrics block (after the `droppedFrames` section around line 95), add a collapsible native metrics section:

```typescript
{(result.memoryDeltaBytes != null ||
  result.jsThreadCpuMs != null ||
  result.gcCount != null) && (
  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e0e0e0" }}>
    <Text style={{ fontSize: 11, fontWeight: "bold", color: "#666", marginBottom: 4 }}>
      Native Metrics
    </Text>
    {result.memoryDeltaBytes != null && (
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>Memory delta</Text>
        <Text style={styles.metricValue}>
          {result.memoryDeltaBytes >= 0 ? "+" : ""}
          {formatBytes(Math.abs(result.memoryDeltaBytes))}
        </Text>
      </View>
    )}
    {result.jsThreadCpuMs != null && (
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>JS CPU time</Text>
        <Text style={styles.metricValue}>{result.jsThreadCpuMs} ms</Text>
      </View>
    )}
    {result.gcCount != null && (
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>GC</Text>
        <Text style={styles.metricValue}>
          {result.gcCount} collections, {result.gcTotalPauseMs ?? 0} ms
        </Text>
      </View>
    )}
  </View>
)}
```

Import `formatBytes` from `../benchmarks/utils` if not already imported.

- [ ] **Step 2: Commit**

```bash
git add components/BenchmarkCard.tsx
git commit -m "feat: display native metrics in BenchmarkCard"
```

---

## Task 11: Remove GC Calls from Existing Benchmark Wrappers

**Files:**
- Modify: `benchmarks/utils.ts`
- Modify: `benchmarks/streaming-utils.ts`

Now that `runMultiple` handles GC between runs, the per-benchmark GC calls in `makeBenchmark` (utils.ts lines 48-52) and `makeStreamingBenchmark` (streaming-utils.ts lines 19-22) are redundant.

- [ ] **Step 1: Remove GC calls from makeBenchmark**

In `benchmarks/utils.ts`, remove lines 48-52:
```typescript
// Remove this block:
try {
  global.gc();
} catch {
  globalThis.gc();
}
```

- [ ] **Step 2: Remove GC calls from makeStreamingBenchmark**

In `benchmarks/streaming-utils.ts`, remove lines 19-22 (the same GC block).

- [ ] **Step 3: Commit**

```bash
git add benchmarks/utils.ts benchmarks/streaming-utils.ts
git commit -m "refactor: remove per-benchmark GC calls, now handled by multi-run orchestrator"
```

---

## Task 12: Manual Smoke Test

- [ ] **Step 1: Run on iOS simulator**

```bash
cd /Users/barthap/dev/experiments/fetch-benchmark && bunx expo run:ios
```

Start the test server in a separate terminal:
```bash
cd /Users/barthap/dev/experiments/fetch-benchmark && bun run serve
```

Verify:
- Whole-body tab: select 1 benchmark, run it, confirm multi-run executes (progress shows "Run 1/3", "2/3", "3/3")
- Result card shows native metrics section (memory delta, JS CPU time, GC stats)
- Export button produces valid JSON with all runs

- [ ] **Step 2: Run on Android emulator**

```bash
cd /Users/barthap/dev/experiments/fetch-benchmark && bunx expo run:android
```

Same verification as iOS.

- [ ] **Step 3: Verify streaming tab**

- Switch to Streaming tab
- Run a single "Stream drain 1MB" benchmark
- Confirm multi-run works, native metrics appear
- Export and verify JSON structure matches spec (exportVersion: 2, runs array, warmUpRun)

- [ ] **Step 4: Commit any fixes from smoke testing**

```bash
git add -A && git commit -m "fix: smoke test fixes"
```

Only commit this if there were actual fixes needed.

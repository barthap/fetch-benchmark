# Native Benchmark Metrics Module — Implementation Prompt

## Context

The `fetch-benchmark` app at `~/dev/experiments/fetch-benchmark` has a streaming benchmark screen that measures ReadableStream performance of expo-fetch. The benchmarks currently collect metrics via pure JS (throughput, TTFC, chunk count, frame drops via requestAnimationFrame).

This prompt describes a **custom Expo module** (`expo-benchmark-metrics`) that exposes native-level metrics not accessible from JS, to enrich the streaming benchmark data.

## What to Build

A local Expo module in `modules/expo-benchmark-metrics/` that provides:

### Metrics to Expose

1. **Memory high-water mark**
   - iOS: Use `os_proc_available_memory()` or `mach_task_basic_info` to get resident memory before and after streaming
   - Android: Use `Runtime.getRuntime().totalMemory() - freeMemory()` or `Debug.getNativeHeapAllocatedSize()`
   - Expose as: `getMemoryUsageBytes(): number` — call before and after benchmark, diff for peak usage

2. **Native chunk dispatch counter**
   - Hook into the expo-fetch native layer to count `didReceiveResponseData` calls
   - iOS: Add a counter in `ExpoFetchModule.swift` that increments on each data callback
   - Android: Same pattern in the Kotlin/Java fetch implementation
   - Expose as: `resetChunkCounter()` and `getChunkCount(): number`
   - This measures how many native-to-JS dispatches occur, which the ChunkCoalescer should reduce

3. **JS thread CPU time** (nice-to-have)
   - iOS: Use `thread_info()` with `THREAD_BASIC_INFO` to get CPU time for the JS thread
   - Android: Use `android.os.Process.getElapsedCpuTime()` or `/proc/self/stat`
   - Expose as: `getJSThreadCpuTimeMs(): number` — snapshot before/after

4. **GC pause tracking** (nice-to-have)
   - Hermes: Listen for GC events via `HermesInternal.getInstrumentedStats()` if available
   - Expose as: `getGCStats(): { count: number, totalPauseMs: number }`

### Module Structure

```
modules/expo-benchmark-metrics/
  index.ts                           # JS API
  src/
    ExpoBenchmarkMetricsModule.ts    # Module definition
  ios/
    ExpoBenchmarkMetricsModule.swift # iOS implementation
  android/
    src/main/java/.../
      ExpoBenchmarkMetricsModule.kt  # Android implementation
  expo-module.config.json
```

### JS API

```typescript
import * as BenchmarkMetrics from 'expo-benchmark-metrics';

// Memory
const memBefore = BenchmarkMetrics.getMemoryUsageBytes();
// ... run benchmark ...
const memAfter = BenchmarkMetrics.getMemoryUsageBytes();
const peakMemory = memAfter - memBefore;

// Chunk counter (requires patched expo-fetch)
BenchmarkMetrics.resetChunkCounter();
// ... run streaming benchmark ...
const nativeChunks = BenchmarkMetrics.getChunkCount();

// CPU time (nice-to-have)
const cpuBefore = BenchmarkMetrics.getJSThreadCpuTimeMs();
// ... run benchmark ...
const cpuAfter = BenchmarkMetrics.getJSThreadCpuTimeMs();
```

### Integration with Streaming Benchmarks

The streaming benchmark screen should:
1. Check if `expo-benchmark-metrics` is installed (optional dependency)
2. If available, call `getMemoryUsageBytes()` before/after each benchmark
3. If available, use `resetChunkCounter()` / `getChunkCount()` around stream drains
4. Display native metrics alongside JS-collected metrics in the result cards

### Existing App Patterns

- The app uses Expo SDK 55, React Native 0.83, Hermes engine
- UI is React Native Paper
- Benchmarks are defined in `benchmarks/` with a `makeBenchmark()` utility
- The streaming benchmarks use `StreamingBenchmarkResult` which extends `BenchmarkResult`
- Local Expo modules go in `modules/` and are auto-linked

### Key Considerations

- Memory measurement is inherently noisy — consider averaging multiple runs
- The chunk dispatch counter requires coordination with expo-fetch internals (either via a shared global counter or by patching expo-fetch to call into this module)
- GC stats via Hermes may not be stable API — guard with try/catch
- All native methods should be synchronous for minimal overhead during benchmarking

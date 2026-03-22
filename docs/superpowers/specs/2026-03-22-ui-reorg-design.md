# Benchmark App Reorganization — Design Spec

## Overview

Reorganize the fetch-benchmark app's code and UI around two first-class concepts: **TestDefinition** (what to measure) and **Implementation** (which fetch to use). Currently, whole-body benchmarks duplicate test logic per category, and the UI mixes test identity with implementation identity. This redesign separates them cleanly, enabling grouped comparison charts, multi-implementation selection, and a unified screen layout across both tabs.

## Background

Current pain points:
- `benchmarks/index.ts` duplicates 5 test definitions × 3 categories (15 benchmark objects with copy-pasted logic)
- Streaming tab hardcodes "before"/"after" as the only two implementations, making a 3rd awkward to add
- The UI displays a flat list of results with no cross-implementation comparison
- Category selection is radio-based (streaming) — only one implementation visible at a time
- BenchmarkCard mixes "basic" and "native" metrics in different visual styles

## Architecture

Two phases in a single implementation plan:

```
Phase 1: Code organization
  -> Shared Implementation/TestDefinition types
  -> Whole-body: 5 tests defined once, 3 implementations injected
  -> Streaming: refactor to same pattern, proper implementation labels
  -> Results keyed as Record<implId, Record<testId, MultiRunResult>>

Phase 2: UI
  -> New screen layout (both tabs share structure)
  -> Grouped-by-test charts, transposed result cards
  -> Standalone web export viewer tool
```

---

## Phase 1: Code Organization

### 1a. Shared Types

**File: `benchmarks/implementation.ts`** (new)

```typescript
interface Implementation {
  id: string;
  label: string;         // Full name: "Built-in RN fetch"
  shortLabel: string;    // Chart label, ≤10 chars: "Built-in"
  color: string;         // Hex color, consistent across chart + cards
  fetchFn: (url: string) => Promise<Response>;
  enabled: boolean;      // false if module not installed at runtime
}

interface TestDefinition<TResult extends BenchmarkResult = BenchmarkResult> {
  id: string;
  name: string;          // "res.json()"
  description: string;
  run: (impl: Implementation, url: string) => Promise<TResult>;
}
```

Each screen defines its own `Implementation[]` and `TestDefinition[]`. The abstraction shape is shared; the registries are independent.

**Results storage shape** (used by both screens):

```typescript
type ResultsMap<T extends BenchmarkResult = BenchmarkResult> =
  Record<string, Record<string, MultiRunResult<T>>>;
// Outer key: impl.id, inner key: test.id
```

### 1b. Whole-Body Benchmarks

**File: `benchmarks/whole-body.ts`** (new, replaces `benchmarks/index.ts`)

Define 5 test definitions once. Each test's `run` function receives an `Implementation` and uses `impl.fetchFn`. The existing `makeBenchmark` helper is adapted to accept an `Implementation` parameter — it continues to handle prefetch/run separation, `measurePrefetchTime`, size extraction from `Content-Length`, and throughput calculation. Tests don't re-implement this logic.

```typescript
// Helper adapted from existing makeBenchmark — handles timing, size, throughput
function makeTest(config: {
  id: string;
  name: string;
  description: string;
  prefetch?: (impl: Implementation, url: string) => Promise<Response>; // defaults to impl.fetchFn(url)
  run: (response: Response) => Promise<void>;
  measurePrefetchTime?: boolean;
}): TestDefinition;

const jsonTest = makeTest({
  id: "json",
  name: "res.json()",
  description: "Parse JSON from response body",
  run: async (response) => { await response.json(); },
});

export const wholeBodyTests: TestDefinition[] = [
  jsonTest, textTest, textJsonParseTest, arrayBufferTest, textEncoderTest
];

export const wholeBodyImplementations: Implementation[] = [
  {
    id: "builtin",
    label: "Built-in RN fetch",
    shortLabel: "Built-in",
    color: "#e74c3c",
    fetchFn: globalThis.fetch,
    enabled: true,
  },
  {
    id: "expo",
    label: "Expo Fetch",
    shortLabel: "Expo",
    color: "#3498db",
    fetchFn: expoFetch,
    enabled: true,
  },
  {
    id: "nitro",
    label: "Nitro Fetch",
    shortLabel: "Nitro",
    color: "#2ecc71",
    fetchFn: nitroFetch,
    enabled: /* runtime check */,
  },
];
```

The adapted `makeTest` helper wraps the prefetch/run pattern internally. The external interface is always `TestDefinition.run(impl, url) => Promise<BenchmarkResult>`.

The existing `[EXPO NEXT] res.arrayBuffer()` special variant is removed — it was a one-off experiment that doesn't fit the new model.

**Delete: `benchmarks/index.ts`** — fully replaced.

### 1c. Streaming Benchmarks

**File: `benchmarks/streaming.ts`** (modified)

Refactor `createStreamingBenchmarks(fetchFn)` to use `Implementation`:

```typescript
const streamDrain50mb: TestDefinition<StreamingBenchmarkResult> = {
  id: "stream-drain-50mb",
  name: "Stream drain 50MB",
  description: "Read 50MB response via ReadableStream",
  run: async (impl, baseUrl) => {
    return drainStream(impl.fetchFn, `${baseUrl}/chunked?size=50mb`);
  },
};

export const streamingTests: TestDefinition<StreamingBenchmarkResult>[] = [...];

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
    fetchFn: expoFetchNext,
    enabled: /* runtime check */,
  },
  // 3rd implementation easy to add here
];
```

### 1d. Runner Changes

`benchmarks/multi-run.ts` — the `runMultiple` function signature stays the same: `(runFn: () => Promise<T>, options) => Promise<MultiRunResult<T>>`. The caller constructs the `runFn` closure from `test.run(impl, url)`.

No changes needed to `multi-run.ts`, `measure.ts`, `utils.ts`, `gc-utils.ts`, or `streaming-utils.ts`.

---

## Phase 2: UI

### 2a. Screen Layout

Both tabs share the same vertical layout:

1. **ConfigBar** — URL input, run count stepper, metric selector chips
2. **ResultsChartGroup** — grouped-by-test bar charts (only tests with results)
3. **ImplementationSelector** — checkboxes with color dots
4. **RunControls** — Run Selected, Select All/Deselect, Export buttons
5. **TestCardList** — flat FlatList of expandable test cards

### 2b. New Components

**`components/ConfigBar.tsx`** (extracted from screen inline code)
- URL text input
- Run count stepper (1–10)
- Metric selector chips (available metrics depend on result type)

**`components/MetricSelector.tsx`**
- Horizontal chip/pill row
- Available metrics derived from result type:
  - Whole-body: Duration, Throughput, Memory, CPU, GC
  - Streaming: Duration, TTFC, Throughput, Chunks, Dropped Frames, Memory, CPU, GC, InterToken
- Controls `chartMetric` state

**`components/ImplementationSelector.tsx`**
- Horizontal row of checkboxes with color dots matching chart bar colors
- Controls `selectedImpls: Set<string>`
- Disabled implementations shown grayed out with explanatory text

**`components/ResultsChartGroup.tsx`** (replaces `ResultsChart.tsx`)
- Props: `tests[]`, `impls[]`, `results: ResultsMap`, `metricKey: string`
- Renders one section per test definition (only those with results)
- Each section: test name header, then one horizontal bar per selected implementation
- Implementation labels truncated to `shortLabel` (≤10 chars, monospace)
- Bar colors match `impl.color`
- Bars sorted by metric value (ascending for "lower is better" metrics like `durationMs`, descending for "higher is better" metrics like `throughputMbPerCc`)
- Metric extraction uses a runtime key accessor: `(result as Record<string, number>)[metricKey]`. A metric registry maps each key to its display name, unit, and sort direction.

**`components/BenchmarkCard.tsx`** (rewritten)
- Represents a single `TestDefinition`, not a test+impl combo
- Header: checkbox (controls membership in `selectedTests`) + test name + description + status indicator
- Status: idle / "● Expo 2/3…" / "Done" / error
- Expandable: tap to reveal transposed results mini-table
- Mini-table layout (mobile):
  - Columns: one per implementation (max 3-4, using `shortLabel` + color dot)
  - Rows: metric names (Time, Size, Speed, Mem Δ, JS CPU, GC count, GC pause)
  - Best value per row highlighted in green + bold
  - Alternating row background for readability
- Only metrics present in results are shown (streaming cards show TTFC, whole-body don't)

**Delete: `components/ResultsChart.tsx`** — replaced by `ResultsChartGroup`

### 2c. Screen State Shape

Both `app/(tabs)/index.tsx` and `app/(tabs)/streaming.tsx` use:

```typescript
const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
const [selectedImpls, setSelectedImpls] = useState<Set<string>>(new Set());
const [results, setResults] = useState<ResultsMap<T>>({});
const [chartMetric, setChartMetric] = useState<string>("durationMs");
const [runCount, setRunCount] = useState(3);
const [runningState, setRunningState] = useState<{
  testId: string;          // which test definition is running
  implId: string;          // which implementation is running (for label lookup)
  runIndex: number;        // current run within runMultiple (1-based)
  runCount: number;        // total runs in runMultiple
} | null>(null);
// Card displays: "● {impl.shortLabel} {runIndex}/{runCount}…"
```

### 2d. Run Execution

"Run Selected" iterates: for each selected test × each selected implementation:
1. Set `runningState` to show progress on the card
2. Call `runMultiple(() => test.run(impl, url), { runCount, onProgress })`
3. Store result in `results[impl.id][test.id]`
4. Clear `runningState`, move to next

Order: iterate tests in outer loop, implementations in inner loop. This groups all impl runs for a test together, giving the chart a complete comparison set before moving on.

### 2e. JSON Export

Bump to `exportVersion: 3` (the current v2 format uses a different results structure). Both screens now export with implementation grouping:

```json
{
  "exportVersion": 3,
  "device": "...",
  "timestamp": "...",
  "runCount": 3,
  "results": {
    "builtin": {
      "json": { "median": {...}, "runs": [...], "warmUpRun": {...} },
      "text": { ... }
    },
    "expo": { ... },
    "nitro": { ... }
  }
}
```

### 2f. Standalone Web Export Viewer

**File: `tools/results-viewer.html`** (new, self-contained)

A single HTML file with inline JS/CSS that:
- Accepts pasted or uploaded JSON export
- Displays the wide/desktop layout (implementations as rows, metrics as columns — the v1 mockup layout)
- Grouped-by-test charts with full labels
- No build step — open directly in browser
- Serves as a richer analysis tool than the mobile UI can provide

---

## What's NOT Changing

- `benchmarks/measure.ts` — `withNativeMetrics` wrapper, works with any `() => Promise<BenchmarkResult>`
- `benchmarks/multi-run.ts` — core `runMultiple` signature unchanged
- `benchmarks/utils.ts` — `formatBytes`, `calculateThroughput`, `makeBenchmark` helper
- `benchmarks/gc-utils.ts` — GC snapshot utilities
- `benchmarks/streaming-utils.ts` — `drainStream`, `createFrameDropCounter`
- `benchmarks/streaming-types.ts` — `StreamingBenchmarkResult` type (extends `BenchmarkResult`)
- `modules/` — native modules untouched
- `server/` — dev server and endpoints untouched
- Tab navigation structure (`app/(tabs)/_layout.tsx`)

## Theme / Color Mode

Enforce a single color mode (dark) to avoid contrast issues with the current react-native-paper setup. Use `expo-status-bar` and `expo-system-ui` to lock the app to dark mode regardless of system setting. React Native Paper's `PaperProvider` should receive a fixed dark theme. This avoids the existing contrast bugs on dark mode and simplifies the UI work.

## Key Considerations

- **Phase ordering matters**: Phase 1 must complete before Phase 2 starts. The new type system is the foundation for the new UI.
- **Implementation `enabled` field**: Some implementations may not be available at runtime (e.g., Nitro module not installed). The UI should show these as disabled checkboxes with explanatory text, not hide them.
- **Color consistency**: Each implementation gets a fixed color used in charts, implementation selector dots, and card mini-table column headers. Colors are defined in the `Implementation` object, not in UI components.
- **Metric availability**: Not all metrics exist on all results. Chart metric selector should only offer metrics that at least one result contains. Card mini-tables skip rows for missing metrics.
- **Mobile constraints**: Chart implementation labels use `shortLabel` (≤10 chars, monospace). Card mini-tables are transposed (impls as columns, metrics as rows) to fit mobile width.
- **Web viewer uses wide layout**: The standalone `tools/results-viewer.html` uses the non-transposed layout (impls as rows) since it runs on desktop browsers.
- **Cancellation**: No abort mechanism for in-progress benchmark suites. Out of scope for this redesign. Navigating away mid-run may leave state inconsistent — acceptable for a dev tool.
- **Streaming endpoint in test definitions**: Each streaming test hardcodes its endpoint path (e.g., `/chunked?size=50mb`) inside its `run` function. This is intentional — the endpoint is part of the test's identity, not a separate concern. Minor duplication is acceptable.

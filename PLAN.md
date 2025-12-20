# Benchmarking App Implementation Plan

## 1. Project Setup & Tooling
- [ ] Initialize git repo (if not fully set up) and commit initial state.
- [ ] Remove default template code (`app-example`, reset `app` directory).
- [ ] Install **Biome** for linting and formatting.
- [ ] Configure `biome.json`.
- [ ] Update `package.json` scripts to use Biome.
- [ ] Install `react-native-paper` for UI components.

## 2. Architecture
- **Directory Structure**:
    ```
    app/
      index.tsx       # Main screen
    components/
      BenchmarkCard.tsx
      RunButton.tsx
    benchmarks/
      index.ts        # Registry of benchmarks
      types.ts        # Interfaces (Benchmark, Result)
      impl/           # Implementation of specific benchmarks
        fetch.ts
        axios.ts
        ...
    utils/
      stats.ts        # Helper to calculate stats
    ```
- **State Management**:
    - Use local state in `index.tsx` or a simple custom hook `useBenchmarks` to manage the list of benchmarks and their running status/results.

## 3. UI Design
- **Theme**: Dark/Light mode support (auto-detect).
- **Header**: Title "Fetch Benchmark".
- **Controls**:
    - URL Input: Allow user to override the test URL.
    - "Run All" button.
- **List**:
    - Scrollable list of benchmark cards.
    - **Card Content**:
        - Title (e.g., "Standard Fetch").
        - Status Indicator (Idle, Running, Success, Error).
        - Results: Time (ms), Size (KB/MB), Throughput (MB/s).
        - "Run" button for individual execution.

## 4. Benchmark Implementations
- **Common Interface**:
    ```typescript
    interface BenchmarkResult {
        durationMs: number;
        sizeBytes: number;
        error?: string;
    }
    type BenchmarkFunction = (url: string) => Promise<BenchmarkResult>;
    ```
- **Candidates**:
    1.  **React Native Fetch**: Built-in `fetch`.
    2.  **Axios**: Popular library (will need install).
    3.  **XMLHttpRequest**: Old school XHR.
    4.  **Expo FileSystem**: `downloadAsync` (to test file download performance vs memory fetch).

## 5. Development Steps
1.  **Clean & Configure**: Remove junk, setup Biome.
    *   *Commit*.
2.  **Core Structure**: Create `benchmarks/` structure and types.
    *   *Commit*.
3.  **UI Skeleton**: Create the main layout and empty list.
    *   *Commit*.
4.  **First Benchmark**: Implement `fetch` benchmark and wire it up.
    *   *Commit*.
5.  **Add Libraries**: Install Axios, etc.
    *   *Commit*.
6.  **More Benchmarks**: Implement Axios, XHR, FileSystem.
    *   *Commit*.
7.  **Refine UI**: Polish the cards, add stats summary.
    *   *Commit*.

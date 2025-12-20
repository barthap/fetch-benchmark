# Gemini Project Guide: Fetch Benchmark App

This document provides instructions and context for managing the **Fetch Benchmark** project.

## 1. Project Overview

A React Native / Expo application designed to benchmark different HTTP client implementations (Standard Fetch, expo/fetch, response.json() vs response.text() + JSON.parse, etc) when handling large JSON/File responses.

## 2. Tech Stack

- **Runtime**: [Bun](https://bun.sh) (Package Manager & Script Runner)
- **Framework**: [Expo](https://expo.dev) (Managed Workflow)
- **UI Library**: [React Native Paper](https://callstack.github.io/react-native-paper/)
- **Language**: TypeScript
- **Linting/Formatting**: [Biome](https://biomejs.dev)

## 3. Project Structure

```
/
├── app/                 # Expo Router screens
│   ├── _layout.tsx      # Root layout (Provider setup)
│   └── index.tsx        # Main benchmark screen
├── benchmarks/          # Core benchmarking logic
│   ├── types.ts         # Interfaces (Benchmark, Result)
│   ├── utils.ts         # Helpers (formatBytes, throughput calc)
│   ├── index.ts         # Benchmark registry (Export array)
│   └── impl/            # Implementation files
│       ├── fetch.ts
│       ├── expoFetch.ts
│       └── ...
├── components/          # Reusable UI components
│   └── BenchmarkCard.tsx
├── biome.json           # Biome configuration
└── package.json         # Dependencies & Scripts
```

## 4. Key Commands

- **Install Dependencies**: `bun install`
- **Start App**: `bun run start` (or `npx expo start`)
- **Lint & Check**: `bun run check`
- **Format Code**: `bun run format`
- **Check Dependencies**: `bunx expo-doctor`
- **Fix Dependency Versions**: `bun expo install --fix`

## 5. Maintenance

- **Health Check**: Periodically run `bunx expo-doctor` to ensure the project configuration and dependencies are healthy.
- **Dependency Sync**: Use `bun expo install --fix` to automatically align installed package versions with the requirements of the current Expo SDK.

## 6. Development Conventions

### Code Style (Biome)

- **Imports**: Use `import type` for type-only imports (Enforced by Biome).
- **Error Handling**: Avoid `any` in catch blocks. Use `unknown` and cast to `Error` or string safely.

  ```typescript
  try {
    // ...
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    // handle error
  }
  ```

- **Formatting**: Run `bun run format` before committing.

### Adding a New Benchmark

1. **Create Implementation**: Add a new file in `benchmarks/impl/` (e.g., `myClient.ts`).
2. **Implement Interface**: Export a const object adhering to the `Benchmark` interface.

   ```typescript
   import type { Benchmark, BenchmarkResult } from "../types";

   export const myClientBenchmark: Benchmark = {
     id: "my-client",
     name: "My Client",
     description: "Description of the method.",
     run: async (url: string): Promise<BenchmarkResult> => {
       // Implementation...
     },
   };
   ```

3. **Register**: Import and add the new benchmark to the `benchmarks` array in `benchmarks/index.ts`.

## 6. UI/UX Guidelines

- Use **React Native Paper** components (`Text`, `Card`, `Button`) for consistency.
- Ensure the UI remains responsive during benchmarks (async operations).
- Display errors clearly in the benchmark card.

## 7. Current Benchmarks

- **Standard Fetch**: Native `fetch` API + `response.blob()`.
- **Axios**: `axios.get` with `responseType: 'blob'`.
- **XMLHttpRequest**: Legacy `XMLHttpRequest` with `responseType = 'blob'`.
- **Expo FileSystem**: `FileSystem.downloadAsync` (tests download-to-disk performance).

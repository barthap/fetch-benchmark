// benchmarks/whole-body.ts
import { fetch as expoFetch } from "expo/fetch";

import type { Implementation, TestDefinition } from "./implementation";
import type { BenchmarkResult } from "./types";
import { calculateThroughput } from "./utils";

/**
 * Adapted from the old makeBenchmark — handles prefetch/run separation,
 * measurePrefetchTime, Content-Length extraction, and throughput.
 */
function makeTest(config: {
  id: string;
  name: string;
  description: string;
  prefetch?: (impl: Implementation, url: string) => Promise<Response>;
  run: (response: Response) => Promise<void>;
  measurePrefetchTime?: boolean;
}): TestDefinition {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    run: async (impl, url) => {
      const prefetchFn = config.prefetch ?? ((i, u) => i.fetchFn(u));

      let start = Date.now();
      const response = await prefetchFn(impl, url);

      if (!config.measurePrefetchTime) {
        start = Date.now();
      }

      await config.run(response);
      const end = Date.now();

      const durationMs = end - start;
      const sizeBytes = parseInt(
        response.headers.get("Content-Length") as string,
        10,
      );
      const throughput = calculateThroughput(sizeBytes, durationMs);

      return {
        durationMs,
        sizeBytes,
        throughputMbPerCc: throughput,
        statusCode: response.status,
      };
    },
  };
}

const measurePrefetchTime = true;

export const wholeBodyTests: TestDefinition[] = [
  makeTest({
    id: "json",
    name: "res.json()",
    description: "Parse response as JSON",
    measurePrefetchTime,
    run: async (response) => {
      await response.json();
    },
  }),
  makeTest({
    id: "text",
    name: "res.text()",
    description: "Parse response as text",
    measurePrefetchTime,
    run: async (response) => {
      await response.text();
    },
  }),
  makeTest({
    id: "text-json-parse",
    name: "res.text() + JSON.parse",
    description: "Parse plain text as JSON",
    measurePrefetchTime,
    run: async (response) => {
      const text = await response.text();
      JSON.parse(text);
    },
  }),
  makeTest({
    id: "array-buffer",
    name: "res.arrayBuffer()",
    description: "Parse response as ArrayBuffer",
    measurePrefetchTime,
    run: async (response) => {
      await response.arrayBuffer();
    },
  }),
  makeTest({
    id: "text-encoder",
    name: "res.text() + TextEncoder",
    description: "Encode text string to bytes",
    measurePrefetchTime,
    run: async (response) => {
      const text = await response.text();
      new TextEncoder().encode(text);
    },
  }),
];

// Try to import nitro-fetch; may not be installed
let nitroFetchFn: typeof fetch | undefined;
try {
  nitroFetchFn = require("react-native-nitro-fetch").fetch;
} catch {
  // Not installed
}

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
    fetchFn: nitroFetchFn ?? globalThis.fetch,
    enabled: !!nitroFetchFn,
  },
];

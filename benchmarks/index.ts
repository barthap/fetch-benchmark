import { fetch as expoFetchNext } from "expo-fetch-next/fetch";
import { fetch as expoFetch } from "expo/fetch";
import { fetch as nitroFetch } from "react-native-nitro-fetch";

import type { Benchmark } from "./types";
import { makeBenchmark } from "./utils";
import { Platform } from "react-native";

const measurePrefetchTime = true;

export const benchmarks: Benchmark[] = [
  makeBenchmark({
    id: "res-json",
    name: "res.json()",
    category: "Built-in",
    description: "Parse response as JSON",
    prefetch: fetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.json();
    },
  }),
  makeBenchmark({
    id: "res-text",
    name: "res.text()",
    category: "Built-in",
    description: "Parse response as text",
    prefetch: fetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.text();
    },
  }),
  makeBenchmark({
    id: "res-text-json-parse",
    name: "res.text() and JSON.parse",
    category: "Built-in",
    description: "Parse plain text as JSON",
    prefetch: fetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.text();
      const _json = JSON.parse(_result);
    },
  }),
  makeBenchmark({
    id: "res-array-buffer",
    name: "res.arrayBuffer()",
    category: "Built-in",
    description: "Parse response as ArrayBuffer",
    prefetch: fetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.arrayBuffer();
    },
  }),
  makeBenchmark({
    id: "res-text-encoder",
    name: "res.text() and TextEncoder",
    category: "Built-in",
    description: "Encode text string to bytes",
    prefetch: fetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const text = await response.text();
      const _bytes = new TextEncoder().encode(text);
    },
  }),
  // expo-fetch
  makeBenchmark({
    id: "expo-res-json",
    name: "res.json()",
    category: "Expo",
    description: "Parse response as JSON",
    prefetch: expoFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.json();
    },
  }),
  makeBenchmark({
    id: "expo-res-text",
    name: "res.text()",
    category: "Expo",
    description: "Parse response as text",
    prefetch: expoFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.text();
    },
  }),
  makeBenchmark({
    id: "expo-res-text-json-parse",
    name: "res.text() and JSON.parse",
    category: "Expo",
    description: "Parse plain text as JSON",
    prefetch: expoFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.text();
      const _json = JSON.parse(_result);
    },
  }),
  makeBenchmark({
    id: "expo-res-array-buffer",
    name: "res.arrayBuffer()",
    category: "Expo",
    description: "Parse response as ArrayBuffer (zero-copy)",
    prefetch: expoFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.arrayBuffer();
    },
  }),
  makeBenchmark({
    id: "next-expo-res-array-buffer",
    name: "[EXPO NEXT] res.arrayBuffer()",
    category: "Expo",
    description: "Parse response as ArrayBuffer (zero-copy)",
    prefetch: expoFetchNext,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.arrayBuffer();
    },
  }),
  makeBenchmark({
    id: "expo-res-text-encoder",
    name: "res.text() and TextEncoder",
    category: "Expo",
    description: "Encode text string to bytes",
    prefetch: expoFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const text = await response.text();
      const _bytes = new TextEncoder().encode(text);
    },
  }),
  // nitro-fetch
  makeBenchmark({
    id: "nitro-res-json",
    name: "res.json()",
    category: "Nitro",
    description: "Parse response as JSON",
    prefetch: nitroFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.json();
    },
  }),
  makeBenchmark({
    id: "nitro-res-text",
    name: "res.text()",
    category: "Nitro",
    description: "Parse response as text",
    prefetch: nitroFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.text();
    },
  }),
  makeBenchmark({
    id: "nitro-res-text-json-parse",
    name: "res.text() and JSON.parse",
    category: "Nitro",
    description: "Parse plain text as JSON",
    prefetch: nitroFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.text();
      const _json = JSON.parse(_result);
    },
  }),
  makeBenchmark({
    id: "nitro-res-array-buffer",
    name: "res.arrayBuffer()",
    category: "Nitro",
    description: "Parse response as ArrayBuffer",
    prefetch: nitroFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const _result = await response.arrayBuffer();
    },
  }),
  makeBenchmark({
    id: "nitro-res-text-encoder",
    name: "res.text() and TextEncoder",
    category: "Nitro",
    description: "Encode text string to bytes",
    prefetch: nitroFetch,
    measurePrefetchTime,
    run: async (response: Response): Promise<void> => {
      const text = await response.text();
      const _bytes = new TextEncoder().encode(text);
    },
  }),
  // axiosBenchmark,
  // xhrBenchmark,
  // fileSystemBenchmark,
];

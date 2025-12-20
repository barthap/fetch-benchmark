import { fetch as expoFetch } from "expo/fetch";
import { fetch as nitroFetch } from "react-native-nitro-fetch";

import type { Benchmark } from "./types";
import { makeBenchmark } from "./utils";

export const benchmarks: Benchmark[] = [
  // fetchBenchmark,
  // expoFetchBenchmark,
  makeBenchmark({
    id: "res-json",
    name: "res.json()",
    category: "Built-in",
    description: "Parse response as JSON",
    run: async (url: string): Promise<Response> => {
      const response = await fetch(url);
      const _result = await response.json();
      return response;
    },
  }),
  makeBenchmark({
    id: "res-text",
    name: "res.text()",
    category: "Built-in",
    description: "Parse response as text",
    run: async (url: string): Promise<Response> => {
      const response = await fetch(url);
      const _result = await response.text();
      return response;
    },
  }),
  makeBenchmark({
    id: "res-text-json-parse",
    name: "res.text() and JSON.parse",
    category: "Built-in",
    description: "Parse plain text as JSON",
    run: async (url: string): Promise<Response> => {
      const response = await fetch(url);
      const _result = await response.text();
      const _json = JSON.parse(_result);
      return response;
    },
  }),
  makeBenchmark({
    id: "res-array-buffer",
    name: "res.arrayBuffer()",
    category: "Built-in",
    description: "Parse response as ArrayBuffer",
    run: async (url: string): Promise<Response> => {
      const response = await fetch(url);
      const _result = await response.arrayBuffer();
      return response;
    },
  }),
  makeBenchmark({
    id: "res-text-encoder",
    name: "res.text() and TextEncoder",
    category: "Built-in",
    description: "Encode text string to bytes",
    run: async (url: string): Promise<Response> => {
      const response = await fetch(url);
      const text = await response.text();
      const _bytes = new TextEncoder().encode(text);
      return response;
    },
  }),
  // expo-fetch
  makeBenchmark({
    id: "expo-res-json",
    name: "res.json()",
    category: "Expo",
    description: "Parse response as JSON",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const _result = await response.json();
      return response;
    },
  }),
  makeBenchmark({
    id: "expo-res-text",
    name: "res.text()",
    category: "Expo",
    description: "Parse response as text",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const _result = await response.text();
      return response;
    },
  }),
  makeBenchmark({
    id: "expo-res-text-json-parse",
    name: "res.text() and JSON.parse",
    category: "Expo",
    description: "Parse plain text as JSON",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const _result = await response.text();
      const _json = JSON.parse(_result);
      return response;
    },
  }),
  makeBenchmark({
    id: "expo-res-array-buffer",
    name: "res.ArrayBuffer()",
    category: "Expo",
    description: "Parse response as ArrayBuffer",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const _result = await response.arrayBuffer();
      return response;
    },
  }),
  makeBenchmark({
    id: "expo-res-text-encoder",
    name: "res.text() and TextEncoder",
    category: "Expo",
    description: "Encode text string to bytes",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const text = await response.text();
      const _bytes = new TextEncoder().encode(text);
      return response;
    },
  }),
  // nitro-fetch
  makeBenchmark({
    id: "nitro-res-json",
    name: "res.json()",
    category: "Nitro",
    description: "Parse response as JSON",
    run: async (url: string): Promise<Response> => {
      const response = await nitroFetch(url);
      const _result = await response.json();
      return response;
    },
  }),
  makeBenchmark({
    id: "nitro-res-text",
    name: "res.text()",
    category: "Nitro",
    description: "Parse response as text",
    run: async (url: string): Promise<Response> => {
      const response = await nitroFetch(url);
      const _result = await response.text();
      return response;
    },
  }),
  makeBenchmark({
    id: "nitro-res-text-json-parse",
    name: "res.text() and JSON.parse",
    category: "Nitro",
    description: "Parse plain text as JSON",
    run: async (url: string): Promise<Response> => {
      const response = await nitroFetch(url);
      const _result = await response.text();
      const _json = JSON.parse(_result);
      return response;
    },
  }),
  makeBenchmark({
    id: "nitro-res-array-buffer",
    name: "res.ArrayBuffer()",
    category: "Nitro",
    description: "Parse response as ArrayBuffer",
    run: async (url: string): Promise<Response> => {
      const response = await nitroFetch(url);
      const _result = await response.arrayBuffer();
      return response;
    },
  }),
  makeBenchmark({
    id: "nitro-res-text-encoder",
    name: "res.text() and TextEncoder",
    category: "Nitro",
    description: "Encode text string to bytes",
    run: async (url: string): Promise<Response> => {
      const response = await nitroFetch(url);
      const text = await response.text();
      const _bytes = new TextEncoder().encode(text);
      return response;
    },
  }),
  // axiosBenchmark,
  // xhrBenchmark,
  // fileSystemBenchmark,
];

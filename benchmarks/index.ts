import { fetch as expoFetch } from "expo/fetch";

import type { Benchmark } from "./types";
import { makeBenchmark } from "./utils";

export const benchmarks: Benchmark[] = [
  // fetchBenchmark,
  // expoFetchBenchmark,
  makeBenchmark({
    id: "res-json",
    name: "res.json()",
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
    name: "Expo res.json()",
    description: "Parse response as JSON",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const _result = await response.json();
      return response;
    },
  }),
  makeBenchmark({
    id: "expo-res-text",
    name: "Expo res.text()",
    description: "Parse response as text",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const _result = await response.text();
      return response;
    },
  }),
  makeBenchmark({
    id: "expo-res-text-json-parse",
    name: "Expo res.text() and JSON.parse",
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
    name: "Expo res.ArrayBuffer()",
    description: "Parse response as ArrayBuffer",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const _result = await response.arrayBuffer();
      return response;
    },
  }),
  makeBenchmark({
    id: "expo-res-text-encoder",
    name: "Expo res.text() and TextEncoder",
    description: "Encode text string to bytes",
    run: async (url: string): Promise<Response> => {
      const response = await expoFetch(url);
      const text = await response.text();
      const _bytes = new TextEncoder().encode(text);
      return response;
    },
  }),
  // axiosBenchmark,
  // xhrBenchmark,
  // fileSystemBenchmark,
];

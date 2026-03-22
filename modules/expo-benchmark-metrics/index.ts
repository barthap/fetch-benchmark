import ExpoBenchmarkMetricsModule from "./src/ExpoBenchmarkMetricsModule";

export function getMemoryUsageBytes(): number {
  return ExpoBenchmarkMetricsModule.getMemoryUsageBytes();
}

export function getJSThreadCpuTimeMs(): number {
  return ExpoBenchmarkMetricsModule.getJSThreadCpuTimeMs();
}

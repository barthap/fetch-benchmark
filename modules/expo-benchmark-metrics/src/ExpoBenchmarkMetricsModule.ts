import { requireNativeModule } from "expo-modules-core";

declare class ExpoBenchmarkMetricsModule {
  getMemoryUsageBytes(): number;
  getJSThreadCpuTimeMs(): number;
}

export default requireNativeModule<ExpoBenchmarkMetricsModule>(
  "ExpoBenchmarkMetrics"
);

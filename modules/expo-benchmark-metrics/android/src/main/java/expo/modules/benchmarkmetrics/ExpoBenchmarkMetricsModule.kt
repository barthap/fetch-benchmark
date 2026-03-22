package expo.modules.benchmarkmetrics

import android.os.Debug
import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoBenchmarkMetricsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoBenchmarkMetrics")

    Function("getMemoryUsageBytes") {
      val runtime = Runtime.getRuntime()
      val jvmUsed = runtime.totalMemory() - runtime.freeMemory()
      val nativeHeap = Debug.getNativeHeapAllocatedSize()
      return@Function (jvmUsed + nativeHeap).toDouble()
    }

    Function("getJSThreadCpuTimeMs") {
      return@Function SystemClock.currentThreadTimeMillis().toDouble()
    }
  }
}

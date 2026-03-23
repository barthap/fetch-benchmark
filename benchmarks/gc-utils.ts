export interface GCSnapshot {
  numGCs: number;
  gcTotalTimeMs: number;
}

declare const HermesInternal: {
  getInstrumentedStats?: () => {
    numGCs?: number;
    gcTotalTime?: number;
  };
  collectGarbage?: () => void;
} | undefined;

/**
 * Snapshot current GC stats from Hermes. Returns null if unavailable.
 */
export function getGCSnapshot(): GCSnapshot | null {
  try {
    if (typeof HermesInternal === "undefined") return null;
    const stats = HermesInternal.getInstrumentedStats?.();
    if (!stats || stats.numGCs == null || stats.gcTotalTime == null) return null;
    return { numGCs: stats.numGCs, gcTotalTimeMs: stats.gcTotalTime };
  } catch {
    return null;
  }
}

/**
 * Diff two GC snapshots to get delta.
 */
export function diffGCSnapshots(
  before: GCSnapshot | null,
  after: GCSnapshot | null
): { gcCount: number; gcTotalPauseMs: number } | null {
  if (!before || !after) return null;
  return {
    gcCount: after.numGCs - before.numGCs,
    gcTotalPauseMs: Math.max(0, after.gcTotalTimeMs - before.gcTotalTimeMs),
  };
}

/**
 * Best-effort GC trigger. Uses HermesInternal if available, falls back to global.gc.
 */
export function tryCollectGarbage(): void {
  try {
    if (typeof HermesInternal !== "undefined") {
      HermesInternal.collectGarbage?.();
      return;
    }
  } catch {}
  try {
    (globalThis as any).gc?.();
  } catch {}
}

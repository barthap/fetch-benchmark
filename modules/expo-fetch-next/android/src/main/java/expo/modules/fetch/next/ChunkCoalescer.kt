// Copyright 2015-present 650 Industries. All rights reserved.

package expo.modules.fetch.next

import expo.modules.kotlin.jni.NativeArrayBuffer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.nio.ByteBuffer
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Accumulates small network chunks into larger buffers before flushing.
 * Reduces the number of JS thread dispatches by coalescing multiple small chunks
 * into fewer, larger NativeArrayBuffer emissions.
 *
 * Thread safety: all mutable state is protected by [lock]. The [onFlush] callback
 * is always called outside the lock to avoid holding it during JS thread dispatch.
 */
internal class ChunkCoalescer(
  private val sizeThreshold: Int = DEFAULT_SIZE_THRESHOLD,
  private val timeoutMs: Long = DEFAULT_TIMEOUT_MS,
  private val coroutineScope: CoroutineScope,
  private val onFlush: (NativeArrayBuffer) -> Unit
) {
  private var buffer: ByteBuffer = ByteBuffer.allocateDirect(sizeThreshold)
  private var timerJob: Job? = null
  private val lock = ReentrantLock()

  /**
   * Append a chunk to the coalescing buffer.
   * If the chunk would overflow the buffer, flushes first.
   * If a single chunk exceeds [sizeThreshold], it is emitted directly without buffering.
   */
  fun append(data: ByteArray) {
    if (data.size > sizeThreshold) {
      // Oversized chunk: flush pending data, then emit this chunk directly
      val pending = lock.withLock {
        cancelTimerLocked()
        flushBufferLocked()
      }
      pending?.let { onFlush(it) }
      val directBuffer = ByteBuffer.allocateDirect(data.size)
      directBuffer.put(data)
      onFlush(NativeArrayBuffer.wrap(directBuffer))
      return
    }

    // Tiny chunk (e.g. SSE token): append then flush immediately to preserve
    // real-time delivery. Coalescing overhead isn't worth it for tiny payloads.
    if (data.size <= IMMEDIATE_FLUSH_THRESHOLD) {
      val pending = lock.withLock {
        buffer.put(data)
        cancelTimerLocked()
        flushBufferLocked()
      }
      pending?.let { onFlush(it) }
      return
    }

    val pending = lock.withLock {
      if (buffer.remaining() < data.size) {
        val flushed = flushBufferLocked()
        buffer.put(data)
        resetTimerLocked()
        flushed
      } else {
        buffer.put(data)
        resetTimerLocked()
        null
      }
    }
    pending?.let { onFlush(it) }
  }

  /**
   * Append data by reading directly from an Okio [okio.Buffer] into the coalescing buffer,
   * bypassing intermediate ByteArray allocation. Uses [okio.Buffer.read] from [ReadableByteChannel].
   */
  fun appendFromOkio(okioBuffer: okio.Buffer) {
    val available = okioBuffer.size
    if (available == 0L) return

    if (available > sizeThreshold) {
      // Oversized: flush pending, then emit a purpose-allocated direct buffer
      val pending = lock.withLock {
        cancelTimerLocked()
        flushBufferLocked()
      }
      pending?.let { onFlush(it) }
      val direct = ByteBuffer.allocateDirect(available.toInt())
      while (okioBuffer.size > 0L) { okioBuffer.read(direct) }
      check(direct.position() == available.toInt()) {
        "Incomplete Okio drain: expected $available bytes, got ${direct.position()}"
      }
      onFlush(NativeArrayBuffer.wrap(direct))
      return
    }

    // Tiny chunk (e.g. SSE token): append then flush immediately
    if (available <= IMMEDIATE_FLUSH_THRESHOLD) {
      val pendingPair = lock.withLock {
        val overflow = if (buffer.remaining() < available.toInt()) {
          flushBufferLocked()
        } else null
        while (okioBuffer.size > 0L && buffer.hasRemaining()) { okioBuffer.read(buffer) }
        cancelTimerLocked()
        val current = flushBufferLocked()
        Pair(overflow, current)
      }
      pendingPair.first?.let { onFlush(it) }
      pendingPair.second?.let { onFlush(it) }
      return
    }

    val pending = lock.withLock {
      val flushed = if (buffer.remaining() < available.toInt()) {
        flushBufferLocked()
      } else null
      while (okioBuffer.size > 0L && buffer.hasRemaining()) { okioBuffer.read(buffer) }
      check(okioBuffer.size == 0L) {
        "Okio buffer not fully drained: ${okioBuffer.size} bytes remaining"
      }
      resetTimerLocked()
      flushed
    }
    pending?.let { onFlush(it) }
  }

  /**
   * Flush any pending data. Call before emitting didComplete or on cancel.
   * Cancels the timer to prevent races.
   */
  fun flush() {
    val pending = lock.withLock {
      cancelTimerLocked()
      flushBufferLocked()
    }
    pending?.let { onFlush(it) }
  }

  /**
   * Discard any pending data and cancel the timer.
   */
  fun cancel() {
    lock.withLock {
      cancelTimerLocked()
      buffer.clear()
    }
  }

  // All *Locked methods must be called with lock held.

  private fun flushBufferLocked(): NativeArrayBuffer? {
    val size = buffer.position()
    if (size == 0) return null

    val slice = ByteBuffer.allocateDirect(size)
    buffer.flip()
    slice.put(buffer)
    buffer = ByteBuffer.allocateDirect(sizeThreshold)
    return NativeArrayBuffer.wrap(slice)
  }

  private fun resetTimerLocked() {
    timerJob?.cancel()
    timerJob = coroutineScope.launch {
      delay(timeoutMs)
      val pending = lock.withLock {
        flushBufferLocked()
      }
      pending?.let { onFlush(it) }
    }
  }

  private fun cancelTimerLocked() {
    timerJob?.cancel()
    timerJob = null
  }

  companion object {
    const val DEFAULT_SIZE_THRESHOLD = 64 * 1024  // 64KB
    const val DEFAULT_TIMEOUT_MS = 16L             // ~1 frame
    const val IMMEDIATE_FLUSH_THRESHOLD = 256      // Chunks this small bypass coalescing
  }
}

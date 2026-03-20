const SIZE_MAP: Record<string, number> = {
  "1mb": 1 * 1024 * 1024,
  "10mb": 10 * 1024 * 1024,
  "50mb": 50 * 1024 * 1024,
  "100mb": 100 * 1024 * 1024,
};

export function handleChunked(url: URL): Response {
  const sizeParam = url.searchParams.get("size") ?? "50mb";
  const chunkSizeParam = url.searchParams.get("chunkSize") ?? "64kb";
  const throttleParam = url.searchParams.get("throttle"); // e.g. "1mbps"

  const totalBytes = SIZE_MAP[sizeParam] ?? 50 * 1024 * 1024;
  const chunkSize = parseSize(chunkSizeParam);
  const throttleBytesPerSec = throttleParam ? parseThrottle(throttleParam) : null;

  const stream = new ReadableStream({
    async start(controller) {
      let sent = 0;
      const chunk = new Uint8Array(chunkSize);
      // Fill with deterministic data
      for (let i = 0; i < chunk.length; i++) {
        chunk[i] = i % 256;
      }

      while (sent < totalBytes) {
        const remaining = totalBytes - sent;
        const toSend = remaining < chunkSize ? chunk.slice(0, remaining) : chunk;
        controller.enqueue(toSend);
        sent += toSend.byteLength;

        if (throttleBytesPerSec) {
          const delayMs = (toSend.byteLength / throttleBytesPerSec) * 1000;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(totalBytes),
    },
  });
}

function parseSize(s: string): number {
  const match = s.match(/^(\d+)(kb|mb)$/i);
  if (!match) return 64 * 1024;
  const num = parseInt(match[1], 10);
  return match[2].toLowerCase() === "mb" ? num * 1024 * 1024 : num * 1024;
}

function parseThrottle(s: string): number {
  const match = s.match(/^(\d+)mbps$/i);
  if (!match) return 1 * 1024 * 1024;
  return parseInt(match[1], 10) * 1024 * 1024 / 8; // mbps -> bytes per second
}

import { handleChunked } from "./endpoints/chunked";
import { handleSSE } from "./endpoints/sse";
import { join } from "path";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");
const PORT = 3001;

// Pre-load fixtures into memory to avoid disk I/O stalls during benchmarks
const fileCache = new Map<string, Buffer>();
async function preloadFixtures() {
  const glob = new Bun.Glob("*");
  for await (const name of glob.scan(FIXTURES_DIR)) {
    const buf = await Bun.file(join(FIXTURES_DIR, name)).arrayBuffer();
    fileCache.set(`/${name}`, Buffer.from(buf));
    console.log(`  Cached: ${name} (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)`);
  }
}
await preloadFixtures();

const server = Bun.serve({
  port: PORT,
  idleTimeout: 120, // seconds — slow clients (Android debug, PowerShell) need more time
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/chunked") {
      return handleChunked(url);
    }

    if (url.pathname === "/sse") {
      return handleSSE();
    }

    // Serve from in-memory cache
    const cached = fileCache.get(url.pathname);
    if (cached) {
      return new Response(cached, {
        headers: {
          "Content-Type": url.pathname.endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Benchmark server running on http://localhost:${server.port}`);
console.log(`Static files served from: ${FIXTURES_DIR}`);

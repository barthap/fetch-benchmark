import { handleChunked } from "./endpoints/chunked";
import { handleSSE } from "./endpoints/sse";
import { join } from "path";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");
const PORT = 3001;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/chunked") {
      return handleChunked(url);
    }

    if (url.pathname === "/sse") {
      return handleSSE();
    }

    // Static file serving from fixtures/
    const filePath = join(FIXTURES_DIR, url.pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Benchmark server running on http://localhost:${server.port}`);
console.log(`Static files served from: ${FIXTURES_DIR}`);

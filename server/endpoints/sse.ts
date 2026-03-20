const TOTAL_TOKENS = 500;
const WORDS = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
];

function randomToken(): string {
  const count = 1 + Math.floor(Math.random() * 3);
  const words = Array.from({ length: count }, () => WORDS[Math.floor(Math.random() * WORDS.length)]);
  return words.join(" ");
}

function getDelay(tokenIndex: number): number {
  const burstSize = 5 + Math.floor(Math.random() * 11);
  const inBurst = tokenIndex % (burstSize + 3) < burstSize;
  if (inBurst) {
    return 5 + Math.floor(Math.random() * 11);
  }
  return 40 + Math.floor(Math.random() * 41);
}

export function handleSSE(): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      for (let i = 0; i < TOTAL_TOKENS; i++) {
        const token = randomToken();
        const sseFrame = `data: ${token}\n\n`;
        controller.enqueue(encoder.encode(sseFrame));

        const delay = getDelay(i);
        await new Promise((r) => setTimeout(r, delay));
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

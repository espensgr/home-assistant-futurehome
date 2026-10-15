import { createApp } from './app.ts';
import { MemoryStore } from './store.ts';

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8787),
  fetch: createApp(new MemoryStore()).fetch,
});

console.log(`Capabilities collector listening on :${server.port}`);

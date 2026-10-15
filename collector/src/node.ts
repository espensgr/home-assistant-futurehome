import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { MemoryStore } from './store.ts';

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: createApp(new MemoryStore()).fetch, port }, () =>
  console.log(`Capabilities collector listening on :${port}`),
);

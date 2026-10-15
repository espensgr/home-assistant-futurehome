import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { InvalidReport, parseReport } from './capabilities.ts';
import type { Store } from './store.ts';

// shortcut: no rate limiting, add it (or put the app behind a WAF rule) before going live
export function createApp(store: Store) {
  const app = new Hono();

  app.get('/health', (c) => c.text('ok'));

  app.post(
    '/v1/capabilities',
    bodyLimit({
      maxSize: 512 * 1024,
      onError: (c) => c.text('Too large', 413),
    }),
    async (c) => {
      let report;
      try {
        report = parseReport(await c.req.json());
      } catch (e) {
        if (e instanceof InvalidReport || e instanceof SyntaxError) {
          return c.text(e.message, 400);
        }
        throw e;
      }

      const now = new Date().toISOString();
      for (const { fingerprint, device } of report.devices) {
        await store.upsert({
          fingerprint,
          device,
          addonVersion: report.addonVersion,
          now,
        });
      }
      return c.body(null, 204);
    },
  );

  app.get('/v1/devices', async (c) => c.json(await store.list()));

  return app;
}

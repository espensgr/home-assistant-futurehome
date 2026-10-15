import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.ts';
import { MemoryStore } from './store.ts';
import { parseReport } from './capabilities.ts';

const report = (overrides: Record<string, unknown> = {}) => ({
  schema: 1,
  addon_version: '1.9.1',
  devices: [
    {
      model: 'zw_271_2049_4098',
      model_alias: null,
      adapter: 'zwave-ad',
      type: 'sensor',
      subtype: 'presence',
      services: [
        {
          name: 'sensor_temp',
          endpoint: '0',
          enabled: true,
          intf: ['evt.sensor.report', 'cmd.sensor.get_report'],
          props: {
            sup_units: ['C'],
            owner: 'Kari Nordmann',
            thing_role: 'main',
          },
        },
      ],
      fingerprint: 'anything-the-client-says',
      ...overrides,
    },
  ],
});

const post = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request('/v1/capabilities', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('stores a report, re-applying the allowlist and its own fingerprint', async () => {
  const app = createApp(new MemoryStore());
  assert.equal((await post(app, report())).status, 204);
  assert.equal((await post(app, report())).status, 204);

  const [stored, ...rest] = await (await app.request('/v1/devices')).json();
  assert.equal(rest.length, 0);
  assert.equal(stored.reports, 2);
  assert.match(stored.fingerprint, /^[0-9a-f]{16}$/);
  assert.deepEqual(stored.device.services[0].props, {
    owner: '<string>',
    sup_units: ['C'],
    thing_role: 'main',
  });
  assert.deepEqual(stored.device.services[0].intf, [
    'cmd.sensor.get_report',
    'evt.sensor.report',
  ]);
  assert.ok(!JSON.stringify(stored).includes('Kari'));
});

test('rejects malformed reports', async () => {
  const app = createApp(new MemoryStore());
  for (const body of [
    { schema: 2, devices: [] },
    report({ services: 'nope' }),
    report({ model: 'x'.repeat(500) }),
    report({ services: [{ name: 'a', endpoint: [7], intf: [] }] }),
    { schema: 1, devices: Array(201).fill(report().devices[0]) },
  ]) {
    assert.equal(
      (await post(app, body)).status,
      400,
      JSON.stringify(body).slice(0, 80),
    );
  }
  assert.equal(
    (
      await app.request('/v1/capabilities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      })
    ).status,
    400,
  );
  assert.deepEqual(await (await app.request('/v1/devices')).json(), []);
});

test('fingerprint ignores the order of services, intf and props', () => {
  const svc = (name: string) => ({
    name,
    endpoint: '0',
    enabled: true,
    intf: ['b', 'A', 'a'],
    props: { sup_b: 1, Sup_a: 2, is_c: true },
  });
  const reversed = (s: ReturnType<typeof svc>) => ({
    ...s,
    intf: [...s.intf].reverse(),
    props: Object.fromEntries(Object.entries(s.props).reverse()),
  });
  const fp = (services: unknown[]) =>
    parseReport({ schema: 1, devices: [{ model: 'm', services }] }).devices[0]
      .fingerprint;

  assert.equal(
    fp([svc('battery'), svc('Basic'), svc('sensor_temp')]),
    fp([reversed(svc('sensor_temp')), svc('battery'), reversed(svc('Basic'))]),
  );
});

test('dashboard lists devices and escapes what clients send', async () => {
  const app = createApp(new MemoryStore());
  await post(app, report({ model_alias: '<script>alert(1)</script>' }));

  const page = await (await app.request('/')).text();
  assert.ok(page.includes('zw_271_2049_4098'));
  assert.ok(page.includes('sensor_temp'));
  assert.ok(!page.includes('<script>alert(1)'));
  assert.ok(page.includes('&lt;script&gt;'));
});

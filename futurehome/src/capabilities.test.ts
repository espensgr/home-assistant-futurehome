import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDevice } from './capabilities';
import type { VinculumPd7Device } from './fimp/vinculum_pd7_device';

const device = (name: string, address: string): VinculumPd7Device =>
  ({
    id: Number(address),
    client: { name, comment: `${name} on the second floor` },
    room: 4,
    model: 'zw_271_2049_4098',
    modelAlias: null,
    fimp: { adapter: 'zwave-ad', address, group: 'ch_0' },
    param: { temperature: 22.2, presence: false },
    type: { type: 'sensor', subtype: 'presence' },
    services: {
      sensor_temp: {
        addr: `/rt:dev/rn:zw/ad:1/sv:sensor_temp/ad:${address}_0`,
        enabled: true,
        intf: ['evt.sensor.report', 'cmd.sensor.get_report'],
        props: { sup_units: ['C'], is_secure: false, owner: 'Kari Nordmann' },
      },
    },
  }) as unknown as VinculumPd7Device;

test('keeps capabilities and drops anything personal', () => {
  const result = sanitizeDevice(device('Bedroom sensor', '11'));
  const json = JSON.stringify(result);

  for (const secret of ['Bedroom', 'second floor', 'ad:11', 'Kari', '22.2']) {
    assert.ok(!json.includes(secret), `leaked "${secret}"`);
  }
  assert.deepEqual(result.services, [
    {
      name: 'sensor_temp',
      endpoint: '0',
      enabled: true,
      intf: ['cmd.sensor.get_report', 'evt.sensor.report'],
      props: { is_secure: false, owner: '<string>', sup_units: ['C'] },
    },
  ]);
  assert.equal(result.model, 'zw_271_2049_4098');
  assert.equal(result.adapter, 'zwave-ad');
});

test('identical devices share a fingerprint regardless of name and address', () => {
  assert.equal(
    sanitizeDevice(device('Kitchen', '11')).fingerprint,
    sanitizeDevice(device('Hallway', '27')).fingerprint,
  );
});

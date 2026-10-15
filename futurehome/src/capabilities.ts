// Opt-in sharing of device capabilities (model, services, intf, props) so
// support can be prioritised across installations. Only allowlisted structure
// leaves the house: never names, rooms, addresses, hub ID, readings or state.

import axios from 'axios';
import { createHash } from 'crypto';
import { log } from './logger';
import type { VinculumPd7Device } from './fimp/vinculum_pd7_device';

export const CAPABILITIES_SCHEMA = 1;

// Props whose values describe what a device can do. Any other prop keeps only
// its type, so a new field can't leak by accident.
const CAPABILITY_PROP =
  /^(sup_|supports_|supported_|is_|min_|max_)|^(slots|thing_role)$/;

export type CapabilityService = {
  name: string;
  endpoint: string | null;
  enabled: boolean | null;
  intf: string[];
  props: Record<string, unknown>;
};

export type DeviceCapabilities = {
  model: string | null;
  model_alias: string | null;
  adapter: string | null;
  type: string | null;
  subtype: string | null;
  services: CapabilityService[];
  fingerprint: string;
};

// Plain code-unit order: localeCompare depends on the runtime's ICU data
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'list';
  if (value === null) return 'null';
  return typeof value === 'object' ? 'map' : typeof value;
}

export function sanitizeDevice(device: VinculumPd7Device): DeviceCapabilities {
  const services = Object.entries(device.services ?? {})
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([name, svc]) => ({
      name,
      // e.g. "/rt:dev/rn:zw/ad:1/sv:battery/ad:11_0" → "0"; the node address is dropped
      endpoint: svc?.addr?.match(/\/ad:[^/]*_(\d+)$/)?.[1] ?? null,
      enabled: typeof svc?.enabled === 'boolean' ? svc.enabled : null,
      intf: [...(svc?.intf ?? [])].sort(),
      props: Object.fromEntries(
        Object.entries((svc?.props ?? {}) as Record<string, unknown>)
          .sort(([a], [b]) => byCodeUnit(a, b))
          .map(([key, value]) => [
            key,
            CAPABILITY_PROP.test(key) ? value : `<${typeOf(value)}>`,
          ]),
      ),
    }));

  const capabilities = {
    model: device.model ?? null,
    model_alias: device.modelAlias ?? null,
    adapter: device.fimp?.adapter ?? null,
    type: device.type?.type ?? null,
    subtype: device.type?.subtype ?? null,
    services,
  };

  return {
    ...capabilities,
    // Same model + same capabilities → same fingerprint, sent only once
    fingerprint: createHash('sha256')
      .update(JSON.stringify(capabilities))
      .digest('hex')
      .slice(0, 16),
  };
}

const reported = new Set<string>();

/**
 * Reports capabilities of devices not reported yet in this run. Without a
 * collector URL the payload is only logged, so it can be inspected first.
 */
export async function reportCapabilities(parameters: {
  devices: VinculumPd7Device[];
  url: string;
  addonVersion: string;
}) {
  const devices = parameters.devices
    .map(sanitizeDevice)
    .filter((d) => !reported.has(d.fingerprint))
    .filter(
      (d, i, all) =>
        all.findIndex((o) => o.fingerprint === d.fingerprint) === i,
    );
  if (!devices.length) return;

  const payload = {
    schema: CAPABILITIES_SCHEMA,
    addon_version: parameters.addonVersion,
    devices,
  };

  if (!parameters.url) {
    log.info(
      `Device capabilities (not sent, no collector URL):\n${JSON.stringify(payload)}`,
    );
  } else {
    try {
      await axios.post(parameters.url, payload, { timeout: 10000 });
      log.info(`Shared capabilities of ${devices.length} device variant(s)`);
    } catch (e) {
      // Retried on the next device list, since nothing is marked as reported
      log.warn('Failed to share device capabilities', e);
      return;
    }
  }
  devices.forEach((d) => reported.add(d.fingerprint));
}

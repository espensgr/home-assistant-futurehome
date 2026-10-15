import { createHash } from 'node:crypto';

// Mirrors futurehome/src/capabilities.ts. The collector re-applies the
// allowlist and recomputes the fingerprint itself, so an old or modified
// client can't store anything else.
const CAPABILITY_PROP =
  /^(sup_|supports_|supported_|is_|min_|max_)|^(slots|thing_role)$/;
const TYPE_PLACEHOLDER = /^<(list|null|map|string|number|boolean)>$/;

const MAX_DEVICES = 200;
const MAX_SERVICES = 100;
const MAX_INTF = 100;
const MAX_PROPS = 100;
const MAX_STRING = 200;
const MAX_PROP_JSON = 4000;

export type Service = {
  name: string;
  endpoint: string | null;
  enabled: boolean | null;
  intf: string[];
  props: Record<string, unknown>;
};

export type Device = {
  model: string | null;
  model_alias: string | null;
  adapter: string | null;
  type: string | null;
  subtype: string | null;
  services: Service[];
};

export type Report = {
  addonVersion: string;
  devices: { fingerprint: string; device: Device }[];
};

export class InvalidReport extends Error {}

function fail(message: string): never {
  throw new InvalidReport(message);
}

function str(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length > MAX_STRING) {
    fail(`${field} must be a string of at most ${MAX_STRING} characters`);
  }
  return value;
}

function optionalStr(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : str(value, field);
}

function list(value: unknown, max: number, field: string): unknown[] {
  if (!Array.isArray(value) || value.length > max) {
    fail(`${field} must be a list of at most ${max} items`);
  }
  return value;
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'list';
  if (value === null) return 'null';
  return typeof value === 'object' ? 'map' : typeof value;
}

function prop(key: string, value: unknown): unknown {
  if (CAPABILITY_PROP.test(key)) {
    if (JSON.stringify(value).length > MAX_PROP_JSON)
      fail(`props.${key} is too large`);
    return value;
  }
  return typeof value === 'string' && TYPE_PLACEHOLDER.test(value)
    ? value
    : `<${typeOf(value)}>`;
}

function service(raw: any, i: number): Service {
  if (!raw || typeof raw !== 'object') fail(`services[${i}] must be an object`);
  const props = raw.props ?? {};
  if (typeof props !== 'object' || Array.isArray(props)) {
    fail(`services[${i}].props must be an object`);
  }
  if (Object.keys(props).length > MAX_PROPS) {
    fail(`services[${i}].props has more than ${MAX_PROPS} keys`);
  }
  if (raw.endpoint != null && !/^\d{1,4}$/.test(raw.endpoint)) {
    fail(`services[${i}].endpoint must be a number string`);
  }
  return {
    name: str(raw.name, `services[${i}].name`),
    endpoint: raw.endpoint ?? null,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : null,
    intf: list(raw.intf, MAX_INTF, `services[${i}].intf`)
      .map((v, j) => str(v, `services[${i}].intf[${j}]`))
      .sort(),
    props: Object.fromEntries(
      Object.keys(props)
        .sort()
        .map((key) => [str(key, 'prop key'), prop(key, props[key])]),
    ),
  };
}

function device(raw: any, i: number): Device {
  if (!raw || typeof raw !== 'object') fail(`devices[${i}] must be an object`);
  // Key order matters: it must match the add-on, so fingerprints agree
  return {
    model: optionalStr(raw.model, `devices[${i}].model`),
    model_alias: optionalStr(raw.model_alias, `devices[${i}].model_alias`),
    adapter: optionalStr(raw.adapter, `devices[${i}].adapter`),
    type: optionalStr(raw.type, `devices[${i}].type`),
    subtype: optionalStr(raw.subtype, `devices[${i}].subtype`),
    services: list(raw.services, MAX_SERVICES, `devices[${i}].services`)
      .map(service)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function fingerprint(device: Device): string {
  return createHash('sha256')
    .update(JSON.stringify(device))
    .digest('hex')
    .slice(0, 16);
}

/** Validates a report from the add-on and returns only what may be stored. */
export function parseReport(body: any): Report {
  if (!body || typeof body !== 'object') fail('body must be a JSON object');
  if (body.schema !== 1) fail('unsupported schema');
  return {
    addonVersion: str(body.addon_version ?? 'unknown', 'addon_version'),
    devices: list(body.devices, MAX_DEVICES, 'devices').map((raw, i) => {
      const d = device(raw, i);
      return { fingerprint: fingerprint(d), device: d };
    }),
  };
}

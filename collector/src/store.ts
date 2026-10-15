import type { Device } from './capabilities.ts';

export type StoredDevice = {
  fingerprint: string;
  device: Device;
  addon_version: string;
  first_seen: string;
  last_seen: string;
  reports: number;
};

/** Storage backend. Swap the in-memory one for D1, SQLite, … when deploying. */
export interface Store {
  upsert(entry: {
    fingerprint: string;
    device: Device;
    addonVersion: string;
    now: string;
  }): Promise<void>;
  list(): Promise<StoredDevice[]>;
}

// shortcut: data is lost on restart, replace with a persistent store before going live
export class MemoryStore implements Store {
  private devices = new Map<string, StoredDevice>();

  async upsert({
    fingerprint,
    device,
    addonVersion,
    now,
  }: Parameters<Store['upsert']>[0]) {
    const existing = this.devices.get(fingerprint);
    this.devices.set(fingerprint, {
      fingerprint,
      device,
      addon_version: addonVersion,
      first_seen: existing?.first_seen ?? now,
      last_seen: now,
      reports: (existing?.reports ?? 0) + 1,
    });
  }

  async list() {
    return [...this.devices.values()].sort(
      (a, b) =>
        (a.device.model ?? '').localeCompare(b.device.model ?? '') ||
        a.fingerprint.localeCompare(b.fingerprint),
    );
  }
}

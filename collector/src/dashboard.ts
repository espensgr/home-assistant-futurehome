import { html } from 'hono/html';
import type { StoredDevice } from './store.ts';

// Everything interpolated through html`` is escaped: the data comes from clients.

const day = (iso: string) => iso.slice(0, 10);

function groupByModel(devices: StoredDevice[]) {
  const groups = new Map<string, StoredDevice[]>();
  for (const d of devices) {
    const key = d.device.model ?? '(no model)';
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.entries()];
}

function variant(d: StoredDevice) {
  return html`<details>
    <summary>
      <code>${d.fingerprint}</code>
      <span>
        ${d.device.services.length}
        service${d.device.services.length === 1 ? '' : 's'}
      </span>
      <span>${d.reports} report${d.reports === 1 ? '' : 's'}</span>
      <span>last seen ${day(d.last_seen)}</span>
      <span>add-on ${d.addon_version}</span>
    </summary>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Interfaces</th>
          <th>Props</th>
        </tr>
      </thead>
      <tbody>
        ${d.device.services.map(
          (s) =>
            html`<tr class="${s.enabled === false ? 'disabled' : ''}">
              <td>
                <code>${s.name}</code>
                ${s.endpoint === null ? '' : html`<small>ep ${s.endpoint}</small>`}
                ${s.enabled === false ? html`<small>disabled</small>` : ''}
              </td>
              <td>
                ${s.intf.map((i) => html`<code class="chip">${i}</code>`)}
              </td>
              <td>
                ${Object.entries(s.props).map(
                  ([k, v]) =>
                    html`<div>
                      <code>${k}</code>
                      <code class="value">${JSON.stringify(v)}</code>
                    </div>`,
                )}
              </td>
            </tr>`,
        )}
      </tbody>
    </table>
  </details>`;
}

export function dashboard(devices: StoredDevice[]) {
  const groups = groupByModel(devices);
  const reports = devices.reduce((sum, d) => sum + d.reports, 0);

  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Futurehome device capabilities</title>
        <style>
          :root {
            color-scheme: light dark;
            --bg: #f6f7f9;
            --card: #fff;
            --text: #1d2330;
            --muted: #6b7385;
            --line: #e3e6ec;
            --chip: #eef1f6;
            --accent: #2f6fed;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #12151b;
              --card: #1a1e26;
              --text: #e6e9ef;
              --muted: #8b93a5;
              --line: #2a303b;
              --chip: #232934;
              --accent: #7aa2ff;
            }
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            font:
              15px/1.5 system-ui,
              -apple-system,
              sans-serif;
            background: var(--bg);
            color: var(--text);
          }
          main {
            max-width: 1100px;
            margin: 0 auto;
            padding: 32px 20px 64px;
          }
          h1 {
            font-size: 22px;
            margin: 0 0 4px;
          }
          .stats {
            color: var(--muted);
            margin: 0 0 28px;
          }
          .stats b {
            color: var(--text);
          }
          section {
            background: var(--card);
            border: 1px solid var(--line);
            border-radius: 10px;
            padding: 16px 20px;
            margin-bottom: 14px;
          }
          h2 {
            font-size: 16px;
            margin: 0;
          }
          .meta {
            color: var(--muted);
            font-size: 13px;
            margin: 2px 0 10px;
          }
          .meta span + span::before {
            content: '·';
            margin: 0 8px;
          }
          code {
            font:
              12.5px ui-monospace,
              SFMono-Regular,
              Menlo,
              monospace;
          }
          .chip {
            display: inline-block;
            background: var(--chip);
            border-radius: 4px;
            padding: 1px 6px;
            margin: 0 4px 4px 0;
          }
          .value {
            color: var(--muted);
            word-break: break-word;
          }
          details {
            border-top: 1px solid var(--line);
          }
          summary {
            cursor: pointer;
            padding: 10px 0;
            display: flex;
            flex-wrap: wrap;
            gap: 4px 16px;
            color: var(--muted);
            font-size: 13px;
          }
          summary::-webkit-details-marker {
            display: none;
          }
          summary::before {
            content: '▸';
            transition: transform 0.15s;
          }
          details[open] > summary::before {
            transform: rotate(90deg);
          }
          summary code {
            color: var(--accent);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          th {
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            color: var(--muted);
            padding: 6px 8px;
            border-bottom: 1px solid var(--line);
          }
          td {
            vertical-align: top;
            padding: 8px;
            border-bottom: 1px solid var(--line);
          }
          td:first-child {
            white-space: nowrap;
          }
          td small {
            display: block;
            color: var(--muted);
            font-size: 12px;
          }
          tr.disabled {
            opacity: 0.55;
          }
          .empty {
            color: var(--muted);
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Futurehome device capabilities</h1>
          <p class="stats">
            <b>${groups.length}</b> models · <b>${devices.length}</b> variants ·
            <b>${reports}</b> reports
          </p>
          ${
            groups.length
              ? groups.map(([model, variants]) => {
                  const first = variants[0].device;
                  return html`<section>
                    <h2>${first.model_alias ?? model}</h2>
                    <p class="meta">
                      <span><code>${model}</code></span>
                      ${first.adapter ? html`<span>${first.adapter}</span>` : ''}
                      ${
                        first.type
                          ? html`<span
                              >${first.type}${first.subtype ? ` / ${first.subtype}` : ''}</span
                            >`
                          : ''
                      }
                      <span
                        >${variants.length}
                        variant${variants.length === 1 ? '' : 's'}</span
                      >
                    </p>
                    ${variants.map(variant)}
                  </section>`;
                })
              : html`<p class="empty">No reports yet.</p>`
          }
        </main>
      </body>
    </html>`;
}

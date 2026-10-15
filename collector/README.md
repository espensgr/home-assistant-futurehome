# Capabilities collector

Receives the opt-in **Share device capabilities** reports from the Futurehome add-on (see issue #49) and keeps one entry per device variant (fingerprint), with first/last seen and a report count.

It re-validates every report: only capability-style props keep their value, and the fingerprint is recomputed here, so a client can't store anything else.

## Run locally

Requires Node 23.6+ (runs TypeScript directly).

```sh
npm install
npm start          # listens on :8787 (PORT to change)
npm test
```

## API

- `POST /v1/capabilities`: report from the add-on (`schema: 1`), returns 204
- `GET /v1/devices`: all stored device variants
- `GET /health`

## Storage

`src/store.ts` defines the `Store` interface. Only an in-memory store exists so far; add a D1 or SQLite implementation and pass it to `createApp()` when deploying.

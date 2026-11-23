# TraceNest

**Find API problems before your users do.**


https://github.com/user-attachments/assets/c5d9c04e-2472-4d4d-a11e-d21f106a0760


TraceNest is an API reliability and testing studio. Send requests, save them in collections, write
assertion suites, compare responses across runs, and monitor endpoints on a schedule — all backed by
real execution data.

## Features

| Area | What it does |
| --- | --- |
| API Playground | GET/POST/PUT/PATCH/DELETE, query params, headers, Bearer/Basic/API-key auth, JSON or raw body. Body / Headers / Cookies / Details tabs with status, time and size. |
| Collections | Save, edit, duplicate and reorder requests. |
| Test Suites | Status, max response time, property exists / equals / type, body contains. Rerun only failed assertions. |
| Regression detection | Every suite run diffs its response against the previous run and lists assertions that newly fail. |
| Response Diff | Recursive JSON diff (added / removed / changed value / changed type) rendered as a tree. |
| Monitoring | Scheduled health checks, uptime %, latency history, statistical latency anomalies. |
| Request History | Filter, search, paginate, inspect and rerun past executions. |
| Dashboard | Totals, success rate, average latency, failing endpoints, response-time chart. |
| AI assistant (optional) | Explains a failed request and suggests assertions. Off unless `ANTHROPIC_API_KEY` is set. |

## Architecture

```
client/  React + Vite + TypeScript, Tailwind v4, shadcn/ui, TanStack Query, Recharts, CodeMirror
  │  /api (Vite proxy in dev, Vercel rewrite in prod) — JWT in an httpOnly cookie
server/  Express 5 + TypeScript, Mongoose, Zod
  ├─ routes/       HTTP layer, validation, ownership checks
  ├─ services/
  │   ├─ executor/ the only outbound HTTP path (SSRF guard, redirects, limits, redaction)
  │   ├─ diff.ts   recursive JSON diff
  │   ├─ assertions.ts
  │   ├─ anomaly.ts
  │   └─ ai.ts
  ├─ jobs/scheduler.ts  monitor loop
  └─ models/       User, Collection, SavedRequest, Execution, TestSuite, Monitor, MonitorCheck
MongoDB
```

### Engineering notes

- **SSRF protection.** Requests run on the server only. URLs must be http/https. Literal IPs are
  checked before connecting; hostnames are checked inside the socket's DNS `lookup`, so the address
  that is validated is the address that is connected to (no DNS-rebinding window). Private, loopback,
  link-local, CGNAT, multicast and cloud-metadata ranges are blocked for IPv4, IPv6 and IPv4-mapped
  IPv6. Redirects are followed manually (max 5) and every hop is re-validated. 15 s timeout, 5 MB cap.
- **Secret handling.** Authorization, cookies, API keys and API-key query params are replaced with
  `[REDACTED]` in stored history and in anything sent to the AI provider.
- **Data isolation.** Every query is scoped by `userId`; another user's ids return 404.
- **JSON diff.** Depth-first walk over both values. Objects compare by key union, arrays by index,
  and a type mismatch stops descent and reports one `type` change at that path.
- **Anomaly detection.** A check is anomalous when its latency exceeds the mean plus three standard
  deviations of recent checks (minimum 20 samples, and at least 50 ms above the mean).
- **Scheduler.** Each due monitor is claimed atomically with `findOneAndUpdate` on `nextRunAt`, so two
  server instances never run the same check twice. One retry per failed check.

## Run locally

Requires Node 22+ and Docker.

```bash
npm install
docker compose up -d            # MongoDB on :27017
cp .env.example server/.env     # then set JWT_SECRET
npm run dev                     # API :4000, web :5173
```

Tests (no Docker needed — uses an in-memory MongoDB):

```bash
npm test
```

To test against APIs on your own machine, set `ALLOW_PRIVATE_TARGETS=true` in `server/.env`
(never in production).

## Deploy

- **API:** Render, using `render.yaml`. Set `MONGO_URI` (e.g. MongoDB Atlas), `JWT_SECRET`,
  `CLIENT_ORIGIN`, and optionally `ANTHROPIC_API_KEY`.
- **Web:** Vercel with root `client/`. Update the Render host in `client/vercel.json`; the rewrite keeps
  `/api` same-origin so the auth cookie stays first-party.

## Known limits

- Rate limits are in-memory per process; use a shared store (e.g. Redis) when running several instances.
- Sessions are stateless JWTs (7-day expiry); logout clears the cookie but does not revoke the token.
- The executor connects to the first resolved public IP only (no fallback across addresses).
- Execution history is kept until deleted; add a TTL index for retention.
- `TRUST_PROXY` must match the real proxy hop count of the deployment (check `X-Forwarded-For`).

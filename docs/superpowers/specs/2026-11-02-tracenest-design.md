# TraceNest — Design

**Tagline:** Find API problems before your users do.

## Intent

Portfolio piece. A developer registers, sends API requests through a backend executor, saves them in
collections, writes assertion suites, diffs responses across runs, and monitors endpoints on a schedule.
It must work end-to-end on real data and be explainable in a technical interview: SSRF-safe executor,
recursive JSON diff, assertion engine, regression detection, statistical latency anomalies.

## Goals

- Auth (register/login/logout, JWT, bcrypt), strict per-user data isolation.
- Dashboard from real executions: totals, success/failed, avg latency, success %, recent runs, failing
  endpoints, response-time chart, empty state.
- Playground: GET/POST/PUT/PATCH/DELETE, URL, query params, headers, auth (Bearer / Basic / API key),
  body (JSON / raw text). Response tabs: Body, Headers, Cookies, Details. Status, time, size.
- Collections: create/rename/delete, add/edit/duplicate/reorder saved requests.
- Test suites: status equals, response time below, property exists / equals / type, body contains.
  Totals, per-assertion results, duration, rerun failed.
- Response diff: pick two executions; added / removed / changed value / changed type, nested objects,
  arrays; visual tree highlighting.
- Monitoring: periodic checks, uptime %, avg latency, failed checks, latency history.
- History: list, inspect, filter by method/status, search URL, paginate, rerun.
- Optional AI debugging assistant; app fully works without a key; never sends secrets.
- Stand-out features: visual JSON diff tree, regression detection (suite run diffs against the
  previous run and lists newly failing assertions), latency anomaly detection (mean + 3σ).

## Non-goals

- Team workspaces, sharing, roles.
- Importing Postman collections, environments/variables, scripting.
- GraphQL, WebSockets, file uploads in request bodies.

## Anti-goals

- Fake numbers, placeholder buttons, nav items that lead nowhere.
- Generic admin-template look; heavy gradients and glow.

## Constraints

- Executor runs server-side only. Block localhost, private, link-local, CGNAT, multicast, metadata
  ranges (IPv4 and IPv6, incl. IPv4-mapped IPv6). Validate the IP actually connected to (DNS rebinding).
  http/https only. Redirects followed manually (max 5), each hop re-validated.
- Request timeout 15 s, response body cap 5 MB, stored body cap 1 MB.
- Sensitive headers (`authorization`, `cookie`, `set-cookie`, `x-api-key`, `proxy-authorization`, and
  the configured API-key header) redacted in stored executions and anything sent to AI.
- Monitor minimum interval 60 s, one retry per check.
- No secrets in git; `.env.example` only.

## Decisions (builder's calls — check these)

- **Repo:** npm workspaces `server/` + `client/`; MongoDB via `docker compose`.
- **Executor uses `node:http`/`node:https`** with a custom `lookup`, not Axios. Reason: the guard must
  check the resolved IP at connect time; stdlib gives that plus manual redirects and byte caps with no
  dependency.
- **bcryptjs** (pure JS bcrypt) — native `bcrypt` needs a compiler toolchain on Windows.
- **JWT in httpOnly cookie** (`SameSite=Lax`). Dev: Vite proxies `/api`. Prod: Vercel rewrite proxies
  `/api` to Render, so the cookie stays first-party.
- **No Project model.** Collections are the organizing unit; the nav has no Projects screen. Add a
  Project level if multi-project grouping is needed later.
- **Saved-request auth stored plaintext in Mongo** (owner-scoped, never logged, redacted in history).
  Encryption at rest is the upgrade path.
- **History rerun:** if the execution came from a saved request, rerun uses that request (with its
  auth); otherwise it opens the redacted snapshot in the Playground for the user to complete.
- **Scheduler:** in-process loop, atomic claim via `findOneAndUpdate` on `nextRunAt`, so a second
  instance cannot double-run a monitor.
- **AI:** Anthropic Messages API via `fetch`, enabled only when `ANTHROPIC_API_KEY` is set.
- **UI:** dark-first, Linear/Vercel feel; Tailwind v4 + shadcn/ui + motion + Recharts + CodeMirror;
  TanStack Query for server state. Nav items appear only when their feature ships.

## Left to the builder

Exact visual details, component breakdown, chart styling, copy.

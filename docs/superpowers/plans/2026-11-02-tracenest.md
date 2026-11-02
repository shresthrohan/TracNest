# TraceNest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship TraceNest — API testing, diff and monitoring studio — end-to-end on real data.

**Architecture:** Express 5 + TypeScript API (`server/`) over MongoDB/Mongoose; one SSRF-guarded
executor service used by Playground, Test Suites and Monitors. React + Vite SPA (`client/`) talks to
`/api` through a proxy with a JWT httpOnly cookie. Pure engines (diff, assertions, anomaly) are
plain functions with unit tests.

**Tech Stack:** Node 25, Express 5, Mongoose 8, Zod, jsonwebtoken, bcryptjs, express-rate-limit,
cookie-parser, Vitest, supertest, mongodb-memory-server; React 19, Vite, Tailwind v4, shadcn/ui,
motion, Recharts, @uiw/react-codemirror, react-router, @tanstack/react-query, sonner.

**Spec:** `docs/superpowers/specs/2026-11-02-tracenest-design.md`

## Global Constraints

- Every Mongo query for user data filters by `userId`; foreign ids resolve to 404, never 403.
- Executor: http/https only; timeout 15000 ms; response cap 5 MB; stored body cap 1 MB; max 5 redirects.
- Blocked ranges: 0.0.0.0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, 224/4, 240/4,
  ::/128, ::1/128, fc00::/7, fe80::/10, ff00::/8; IPv4-mapped IPv6 checked as IPv4.
- `ALLOW_PRIVATE_TARGETS=true` (default false) disables the IP block — tests and local dev only.
- Redacted header names: authorization, cookie, set-cookie, x-api-key, proxy-authorization, plus the
  request's API-key header name. Replacement value: `"[REDACTED]"`.
- Monitor interval min 60 s; one retry; scheduler tick 10 s.
- Errors returned as `{ error: { message: string, code: string } }`; stack never sent.
- UI tasks: load `frontend-design:frontend-design` first. Dark-first, near-black bg, 1px borders,
  one restrained accent; no glow/heavy gradients. Loading skeletons, empty states, error states, toasts.
- No nav item until its page works.

## Review Focus

1. Hostname resolving to a private IP (rebinding) — blocked at connect. Test in Task 4.
2. Redirect from public URL to `http://169.254.169.254/` — blocked. Test in Task 4.
3. Non-JSON / empty / huge response bodies — Playground, diff and assertions must not crash. Tests in Tasks 4, 10, 12.
4. User B requesting user A's resource by id — 404. Tests in Tasks 5, 8, 11, 14.
5. Monitor whose target times out every time — check recorded as failed, scheduler keeps going. Test in Task 14.

---

## Phase 1 — Foundation

### Task 1: Repo + server skeleton

**Files:**
- Create: `package.json` (workspaces `server`, `client`; script `dev` runs both via `concurrently`), `docker-compose.yml` (mongo:7, port 27017, named volume), `.gitignore`, `.env.example`
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`
- Create: `server/src/config/env.ts`, `server/src/config/db.ts`, `server/src/app.ts`, `server/src/server.ts`, `server/src/middleware/error.ts`, `server/src/utils/HttpError.ts`
- Test: `server/tests/health.test.ts`, `server/tests/setup.ts`

**Interfaces:**
- Produces: `env` (zod-parsed: `PORT`, `MONGO_URI`, `JWT_SECRET` min 32 chars, `CLIENT_ORIGIN`, `ALLOW_PRIVATE_TARGETS`, `ANTHROPIC_API_KEY?`, `NODE_ENV`); `createApp(): Express`; `class HttpError(status: number, message: string, code: string)`; `errorHandler` (maps HttpError, ZodError→400 `VALIDATION`, Mongoose CastError→404 `NOT_FOUND`, else 500 `INTERNAL`). `tests/setup.ts` starts mongodb-memory-server, connects, clears collections after each test.

- [ ] Step 1: Test `GET /api/health` → 200 `{ ok: true }`; unknown route → 404 `{ error: { code: "NOT_FOUND" } }`.
- [ ] Step 2: `npm test -w server` — FAIL.
- [ ] Step 3: Implement files above. `app.ts` uses `helmet`-free minimal stack: `express.json({ limit: "1mb" })`, `cookie-parser`, routes, `errorHandler`.
- [ ] Step 4: `npm test -w server` — PASS. `docker compose up -d && npm run dev -w server` logs "listening".
- [ ] Step 5: Commit `feat: server skeleton`.

### Task 2: Auth

**Files:**
- Create: `server/src/models/User.ts`, `server/src/routes/auth.ts`, `server/src/middleware/auth.ts`
- Test: `server/tests/auth.test.ts`, `server/tests/helpers.ts`

**Interfaces:**
- Produces: `User { name, email (unique, lowercase), passwordHash, createdAt }`; routes `POST /api/auth/register {name,email,password(min 8)}`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/me {name?, currentPassword?, newPassword?}`; cookie `tn_token` (httpOnly, SameSite=Lax, secure in prod, 7 d); `requireAuth` sets `req.userId: string`; `helpers.ts` exports `agentFor(email): Promise<supertest.Agent>` (registered + logged in). Auth routes rate-limited 20 req / 15 min / IP.

- [ ] Step 1: Tests: register → `me` returns `{ id, name, email }` without `passwordHash`; duplicate email → 409 `EMAIL_TAKEN`; bad password → 401 `INVALID_CREDENTIALS` (same message for unknown email); `me` without cookie → 401; logout clears cookie; password change requires correct `currentPassword`.
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: Implement. bcryptjs cost 12.
- [ ] Step 4: Run — PASS.
- [ ] Step 5: Commit `feat: auth`.

### Task 3: Client shell + auth screens

**Files:**
- Create: `client/` via Vite react-ts; Tailwind v4; `npx shadcn init` + button, input, label, card, tabs, dialog, alert-dialog, dropdown-menu, select, badge, skeleton, table, sonner, tooltip, separator, textarea, switch
- Create: `client/src/lib/api.ts`, `client/src/hooks/useAuth.tsx`, `client/src/layouts/AppLayout.tsx`, `client/src/components/Sidebar.tsx`, `client/src/components/EmptyState.tsx`, `client/src/pages/Login.tsx`, `client/src/pages/Register.tsx`, `client/src/App.tsx`, `client/src/types.ts`
- Modify: `client/vite.config.ts` (proxy `/api` → `http://localhost:4000`)

**Interfaces:**
- Produces: `api<T>(path: string, init?: { method?, body? }): Promise<T>` (JSON, `credentials: "include"`, throws `ApiError {status, code, message}`); `useAuth(): { user, login, register, logout, loading }`; `Sidebar` takes `items: { to, label, icon }[]`, collapsible, state in localStorage; `EmptyState({ icon, title, description, action? })`; route guard redirects to `/login`.

- [ ] Step 1: Load `frontend-design:frontend-design`; set tokens in `index.css` (bg, surface, border, muted, accent, success, warning, danger; Geist/Inter + JetBrains Mono).
- [ ] Step 2: Implement files. Page transitions with `motion` (fade/translate 150 ms).
- [ ] Step 3: `npm run build -w client` — PASS (no TS errors).
- [ ] Step 4: Manual: register, reload stays logged in, logout returns to `/login`.
- [ ] Step 5: Commit `feat: client shell and auth`.

## Phase 2 — Executor, Playground, History, Dashboard

### Task 4: SSRF-guarded executor

**Files:**
- Create: `server/src/services/executor/guard.ts`, `server/src/services/executor/execute.ts`, `server/src/services/executor/redact.ts`
- Test: `server/tests/executor.test.ts`, `server/tests/guard.test.ts`

**Interfaces:**
- Produces:
  - `isBlockedIp(ip: string): boolean` (uses `node:net` `BlockList`)
  - `type RequestSpec = { method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE"; url: string; query: KV[]; headers: KV[]; auth: AuthConfig; body: { mode: "none"|"json"|"text"; content: string } }`, `KV = { key: string; value: string; enabled: boolean }`, `AuthConfig = { type: "none" } | { type: "bearer"; token } | { type: "basic"; username; password } | { type: "apikey"; key; value; in: "header"|"query" }`
  - `type ExecResult = { ok: boolean; statusCode?: number; statusText?: string; headers: Record<string,string|string[]>; body: string; bodyTruncated: boolean; size: number; timeMs: number; finalUrl: string; redirects: string[]; error?: { code: "BLOCKED"|"TIMEOUT"|"DNS"|"CONNECTION"|"TOO_LARGE"|"INVALID_URL"|"TOO_MANY_REDIRECTS"; message: string } }`
  - `executeRequest(spec: RequestSpec, opts?: { allowPrivate?: boolean; timeoutMs?: number }): Promise<ExecResult>` — never throws.
  - `redactHeaders(h: Record<string, unknown>, extra?: string[]): Record<string, unknown>`; `redactSpec(spec): RequestSpec`.

- [ ] Step 1: Guard tests: blocked `127.0.0.1`, `10.1.2.3`, `169.254.169.254`, `100.64.0.1`, `::1`, `::ffff:127.0.0.1`, `fd00::1`; allowed `93.184.216.34`, `2606:4700::1111`.
- [ ] Step 2: Executor tests (local `http.createServer` on port 0, `allowPrivate: true` unless stated): GET JSON → status 200, body, `timeMs > 0`; POST JSON body echoed with `content-type: application/json`; bearer/basic/apikey(query) applied; `file:///etc/passwd` → `INVALID_URL`; `http://127.0.0.1:port` with `allowPrivate: false` → `BLOCKED`; hostname `localtest.me` via injected resolver returning `127.0.0.1` → `BLOCKED`; 302 to `http://169.254.169.254/` (`allowPrivate: false`, first hop allowed via resolver stub) → `BLOCKED`; server sleeping past `timeoutMs: 200` → `TIMEOUT`; 6 MB body → `TOO_LARGE`; 6-hop redirect chain → `TOO_MANY_REDIRECTS`; redaction replaces `Authorization` and custom api-key header with `"[REDACTED]"`.
- [ ] Step 3: Run — FAIL.
- [ ] Step 4: Implement. Literal-IP hosts checked before connect; hostnames checked inside the agent `lookup` callback (all returned addresses); redirects handled manually (`303` / 301-302 on POST → GET without body); timing with `performance.now()`; accept a `resolver` option for tests.
- [ ] Step 5: Run — PASS. Commit `feat: ssrf-guarded executor`.

### Task 5: Execution model, execute + history routes

**Files:**
- Create: `server/src/models/Execution.ts`, `server/src/validators/request.ts`, `server/src/routes/execute.ts`, `server/src/routes/history.ts`
- Test: `server/tests/history.test.ts`

**Interfaces:**
- Consumes: `executeRequest`, `redactSpec`, `redactHeaders`.
- Produces: `Execution { userId, requestId?, source: "playground"|"suite"|"rerun", request: RequestSpec (redacted), statusCode?, responseTime, responseSize, responseBody (≤1 MB), responseHeaders (redacted), error?, executedAt }`, index `{ userId: 1, executedAt: -1 }`; `requestSpecSchema` (zod); `runAndRecord(userId, spec, extra?): Promise<ExecutionDoc>`;
  `POST /api/execute {spec, requestId?}` → execution; `GET /api/history?page&limit(≤100)&method&status(2xx|3xx|4xx|5xx|error)&q` → `{ items, total, page, pages }` (items omit body); `GET /api/history/:id`; `DELETE /api/history/:id`; `POST /api/history/:id/rerun` (uses saved request if `requestId` exists and is owned, else stored spec).

- [ ] Step 1: Tests: execute stores execution with `[REDACTED]` Authorization; history filters by method/status/q (q is regex-escaped: `q=a.b` does not match `axb`); pagination totals; user B `GET /api/history/:idOfA` → 404.
- [ ] Step 2: Run — FAIL. Step 3: Implement. Step 4: Run — PASS. Step 5: Commit `feat: execution history`.

### Task 6: Playground + History UI

**Files:**
- Create: `client/src/pages/Playground.tsx`, `client/src/components/request/RequestBuilder.tsx`, `client/src/components/request/KeyValueEditor.tsx`, `client/src/components/request/AuthEditor.tsx`, `client/src/components/response/ResponseViewer.tsx`, `client/src/components/JsonEditor.tsx`, `client/src/pages/History.tsx`, `client/src/lib/format.ts`
- Modify: `client/src/App.tsx`, nav items

**Interfaces:**
- Produces: `RequestBuilder({ value: RequestSpec, onChange, onSend, sending })`; `ResponseViewer({ execution })` with tabs Body (pretty JSON via CodeMirror read-only, else text), Headers, Cookies (parsed `set-cookie`), Details (final URL, redirects, size, time, error); `formatBytes`, `formatMs`, `statusTone(code)`; URL ↔ query params kept in sync; `Ctrl/Cmd+Enter` sends. Playground accepts `?execution=<id>` or `?request=<id>` to preload.

- [ ] Step 1: Implement; History table with filters, search (debounced 300 ms), pagination, row → detail drawer, Rerun, "Open in Playground".
- [ ] Step 2: Build passes. Manual: send `GET https://jsonplaceholder.typicode.com/users/1`, see 200; send to `http://127.0.0.1` → readable BLOCKED message; row appears in History.
- [ ] Step 3: Commit `feat: playground and history ui`.

### Task 7: Dashboard

**Files:**
- Create: `server/src/routes/dashboard.ts`, `client/src/pages/Dashboard.tsx`
- Test: `server/tests/dashboard.test.ts`

**Interfaces:**
- Produces: `GET /api/dashboard?days=7` → `{ total, success, failed, avgMs, successRate, recent: Execution[10], failing: { method, url, failures, lastStatus, lastAt }[5], series: { bucket: string (ISO hour/day), avgMs, count, failed }[] }`. Success = no error and status < 400. Aggregation pipeline scoped by `userId`.

- [ ] Step 1: Test with seeded executions (3 ok, 2 failed, one other user): totals 5/3/2, `successRate` 60, other user's rows excluded.
- [ ] Step 2: FAIL → implement → PASS. UI: KPI tiles, Recharts area chart, recent + failing lists, empty state with "Send your first request" linking to Playground.
- [ ] Step 3: Commit `feat: dashboard`.

## Phase 3 — Collections

### Task 8: Collections + saved requests API

**Files:**
- Create: `server/src/models/Collection.ts`, `server/src/models/SavedRequest.ts`, `server/src/routes/collections.ts`, `server/src/routes/requests.ts`
- Test: `server/tests/collections.test.ts`

**Interfaces:**
- Produces: `Collection { userId, name, description }`; `SavedRequest { userId, collectionId, name, order, spec: RequestSpec }`; `GET/POST /api/collections`, `PATCH/DELETE /api/collections/:id` (delete cascades requests); `GET /api/collections/:id/requests`; `POST /api/requests {collectionId, name, spec}`, `GET/PATCH/DELETE /api/requests/:id`, `POST /api/requests/:id/duplicate`, `POST /api/collections/:id/reorder {ids: string[]}`.

- [ ] Step 1: Tests: CRUD; duplicate gets name `"<name> (copy)"` and `order` after source; reorder persists; cascade; user B cannot add request to A's collection (404) or read A's request (404).
- [ ] Step 2: FAIL → implement → PASS. Commit `feat: collections api`.

### Task 9: Collections UI

**Files:** Create `client/src/pages/Collections.tsx`, `client/src/components/SaveRequestDialog.tsx`; modify Playground (Save / Save as).
- [ ] Step 1: Implement: collection list, create/rename/delete (AlertDialog), request list with method badges, duplicate, move up/down, open in Playground, Run.
- [ ] Step 2: Build + manual round trip. Commit `feat: collections ui`.

## Phase 4 — Test Suites

### Task 10: Assertion engine

**Files:** Create `server/src/services/assertions.ts`; Test `server/tests/assertions.test.ts`

**Interfaces:**
- Produces: `type Assertion = { id: string; kind: "status"|"maxTime"|"exists"|"equals"|"type"|"contains"; path?: string; expected?: unknown }`; `type AssertionResult = { id, passed: boolean, actual?: unknown, message: string }`; `getPath(obj, "user.items[0].id"): unknown`; `evaluate(assertions: Assertion[], exec: { statusCode?, responseTime, responseBody: string }): AssertionResult[]`. `type` expected ∈ string|number|boolean|object|array|null.

- [ ] Step 1: Tests: status 200 pass/fail; maxTime 500 vs 620 fails with message `"620 ms > 500 ms"`; `user.id` exists; `user.email` type string; `items[1].name` equals; `type array`; contains on raw text; non-JSON body → JSON assertions fail with `"Response is not JSON"`, status/contains still evaluate.
- [ ] Step 2: FAIL → implement → PASS. Commit `feat: assertion engine`.

### Task 11: Suites API + regression + UI

**Files:**
- Create: `server/src/models/TestSuite.ts`, `server/src/routes/suites.ts`, `client/src/pages/TestSuites.tsx`, `client/src/components/AssertionEditor.tsx`
- Test: `server/tests/suites.test.ts`

**Interfaces:**
- Consumes: `evaluate`, `runAndRecord`, `diffJson` (Task 12 — implement Task 12 first if executing in order matters; suites run fine without regression block until then).
- Produces: `TestSuite { userId, requestId, name, assertions: Assertion[], lastRun?: { executionId, results, passed, failed, durationMs, ranAt, regression?: { changes: DiffChange[], newlyFailing: string[] } } }`; `GET/POST /api/suites`, `GET/PATCH/DELETE /api/suites/:id`, `POST /api/suites/:id/run?only=failed`.
- `regression`: diff previous run's response vs current; `newlyFailing` = ids passing last run, failing now.

- [ ] Step 1: Tests: run against local server stores results; `only=failed` evaluates only previously failing ids and merges; regression lists removed field + newly failing assertion; B cannot run A's suite (404).
- [ ] Step 2: FAIL → implement → PASS. UI: suite list, editor, run button, pass/fail summary, per-assertion rows, regression panel, "Generate from response" (exists+type assertions for top-level keys of last response — deterministic, no AI).
- [ ] Step 3: Commit `feat: test suites`.

## Phase 5 — Response Diff

### Task 12: Diff engine

**Files:** Create `server/src/services/diff.ts`; Test `server/tests/diff.test.ts`

**Interfaces:**
- Produces: `type DiffChange = { path: string; kind: "added"|"removed"|"changed"|"type"; before?: unknown; after?: unknown }`; `diffJson(a: unknown, b: unknown, path = ""): DiffChange[]`; `typeOf(v): "null"|"array"|"object"|"string"|"number"|"boolean"`.
- Arrays compared index-wise; paths use `a.b[2].c`; root path `"$"` when top-level differs.

- [ ] Step 1: Tests: spec example → `[{path:"age",kind:"removed",before:22},{path:"email",kind:"added",after:"john@example.com"}]`; nested change `user.address.city`; `5` → `"5"` is `type`; array grow/shrink → added/removed at `[i]`; identical → `[]`; object→array at root → `type` at `$`.
- [ ] Step 2: FAIL → implement → PASS. Commit `feat: json diff engine`.

### Task 13: Diff route + UI

**Files:** Create `server/src/routes/diff.ts`, `client/src/pages/ResponseDiff.tsx`, `client/src/components/DiffTree.tsx`; Test add to `server/tests/history.test.ts`.
- Produces: `GET /api/diff?a=<execId>&b=<execId>` → `{ a: ExecSummary, b: ExecSummary, changes: DiffChange[], status?: {before, after}, bodyKind: "json"|"text" }` (text bodies → single `changed` at `$` if unequal).
- [ ] Step 1: Test: diff of two owned executions; foreign id → 404.
- [ ] Step 2: UI: two execution pickers (filter by URL), summary counts per kind, `DiffTree` rendering merged tree with green added / red removed / amber changed / violet type, collapse unchanged subtrees, side-by-side raw view toggle.
- [ ] Step 3: Commit `feat: response diff`.

## Phase 6 — Monitoring

### Task 14: Monitors, scheduler, anomaly detection

**Files:**
- Create: `server/src/models/Monitor.ts`, `server/src/models/MonitorCheck.ts`, `server/src/jobs/scheduler.ts`, `server/src/services/anomaly.ts`, `server/src/routes/monitors.ts`
- Modify: `server/src/server.ts` (start scheduler, not in tests)
- Test: `server/tests/anomaly.test.ts`, `server/tests/monitors.test.ts`

**Interfaces:**
- Produces: `Monitor { userId, name, spec: RequestSpec, intervalSec (≥60), expectedStatus, active, nextRunAt, lastCheckedAt?, currentStatus: "pending"|"up"|"down" }`; `MonitorCheck { monitorId, userId, ok, statusCode?, responseTime, error?, anomaly: boolean, checkedAt }` (TTL index 30 days); `isAnomaly(history: number[], value: number): boolean` (needs ≥20 samples; `value > mean + 3·stddev` and `value > mean + 50`); `runDueMonitors(now = new Date()): Promise<number>` (claims one at a time with `findOneAndUpdate({active, nextRunAt ≤ now}, {nextRunAt: now + interval})`); `checkMonitor(m): Promise<MonitorCheck>` (one retry after 2 s on failure); routes `GET/POST /api/monitors`, `GET/PATCH/DELETE /api/monitors/:id`, `POST /api/monitors/:id/check`, `GET /api/monitors/:id/stats?hours=24` → `{ uptime, avgMs, failed, total, series, anomalies }`.

- [ ] Step 1: Anomaly tests: <20 samples → false; flat 100 ms ×30 then 400 → true; noisy series with 140 → false.
- [ ] Step 2: Monitor tests: `intervalSec: 30` → 400; `runDueMonitors` runs due one, skips not-due, sets `nextRunAt`; timing-out target → check `ok:false`, `error.code TIMEOUT`, status `down`, loop continues; stats uptime math; B cannot read A's monitor (404).
- [ ] Step 3: FAIL → implement → PASS. Commit `feat: monitoring backend`.

### Task 15: Monitoring UI

**Files:** Create `client/src/pages/Monitoring.tsx`, `client/src/components/MonitorDialog.tsx`.
- [ ] Step 1: List with status dot (pending shows "Waiting for first check"), uptime %, avg ms, sparkline; detail: latency chart with anomaly points, failed-check table, Check now, pause/resume, edit, delete. Refetch every 15 s.
- [ ] Step 2: Build + manual (create monitor, Check now, see point). Commit `feat: monitoring ui`.

## Phase 7 — AI, Settings

### Task 16: Optional AI debugging assistant

**Files:** Create `server/src/services/ai.ts`, `server/src/routes/ai.ts`, `client/src/components/AiPanel.tsx`; Test `server/tests/ai.test.ts`.
- Load `claude-api` skill before writing `ai.ts`.
- Produces: `buildAiContext(exec): object` (method, URL without query values, status, redacted headers, body ≤ 8 KB, error); `GET /api/ai/status` → `{ enabled }`; `POST /api/ai/explain {executionId}` → `{ explanation, causes: string[], steps: string[], assertions: Assertion[] }`; 503 `AI_DISABLED` when no key.
- [ ] Step 1: Tests: context excludes authorization/cookie/api-key and query values; no key → 503.
- [ ] Step 2: FAIL → implement → PASS. UI: "Explain" button in ResponseViewer only when enabled; "Add assertions to suite". Commit `feat: ai assistant`.

### Task 17: Settings

**Files:** Create `client/src/pages/Settings.tsx`.
- [ ] Step 1: Profile name, change password (uses `PATCH /api/auth/me`), AI status read-only, sign out. Commit `feat: settings`.

## Phase 8 — Hardening + deploy

### Task 18: Hardening, docs, deploy config

**Files:** Modify `server/src/app.ts` (global rate limit 300 req / 15 min / user, execute 60 / min), create `render.yaml`, `client/vercel.json` (rewrite `/api/(.*)` → Render URL), `README.md` (architecture, SSRF design, diff algorithm, run locally, screenshots).
- [ ] Step 1: Test: 61st execute within a minute → 429.
- [ ] Step 2: `npm test -w server` all PASS; `npm run build` both PASS; manual walkthrough of every nav item.
- [ ] Step 3: Commit `chore: hardening and deploy config`.

# TraceNest — project context

API reliability & testing studio (portfolio piece). Users send API requests through a server-side
executor, save them in collections, write assertion suites, diff responses, and monitor endpoints.

## Key docs
- Design / decisions: `docs/superpowers/specs/2026-11-02-tracenest-design.md`
- Plan (18 tasks, 8 phases): `docs/superpowers/plans/2026-11-02-tracenest.md`
- Execution ledger (git-ignored, local only): `.superpowers/sdd/2026-11-02-tracenest/progress.md`
  — task briefs, subagent reports, rulings live next to it.

## Layout
- `server/` — Express 5 + TypeScript (ESM, tsx dev, Vitest + supertest + mongodb-memory-server)
- `client/` — React + Vite + TS, Tailwind v4, shadcn/ui, TanStack Query, motion, Recharts, CodeMirror
- Root: npm workspaces, `docker-compose.yml` (mongo:7), `.env.example` (copy to `server/.env`)

## Commands
- `docker compose up -d` — start MongoDB (Docker Desktop must be running)
- `npm run dev` — server :4000 + client :5173 (Vite proxies `/api`)
- `npm test` — server tests (no Docker needed)
- `npm run build` — both workspaces

## Non-negotiables
- Every user-data query filters by `userId`; foreign ids return 404.
- Executor is the only outbound HTTP path; SSRF guard checks the connected IP (custom `lookup`),
  manual redirects re-validated, 15 s timeout, 5 MB cap. `ALLOW_PRIVATE_TARGETS` is for tests/dev only.
- Sensitive headers are redacted (`[REDACTED]`) in stored executions and AI context.
- No fake data, no placeholder buttons; a nav item appears only when its page works.

## How work runs
- Branch `feat/tracenest`. Per phase batch: one backend subagent (`server/` only) and one UI
  subagent (`client/` only) run in parallel; the controller integrates, verifies, and commits.
  Subagents never commit.
- Diff engine (Task 12) is built before Test Suites (Task 11).

## Status
- [x] Spec + plan written; root workspace committed
- [x] Phase 1–2 (auth, executor, playground, history, dashboard)
- [x] Phase 3–5 (collections, assertion engine, suites + regression, JSON diff engine + diff UI)
- [ ] Phase 6–8 — in progress
- [ ] Phase 6 monitoring · [ ] Phase 7 AI + settings · [ ] Phase 8 hardening + deploy

## Known environment notes
- Windows 11, Node 25, Git Bash. Docker installed but daemon may be off.
- shadcn MCP server may fail to connect; use the shadcn CLI.

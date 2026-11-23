# TracNest (TraceNest): project review

Reviewed 2026-11-16. Based on the README, repository layout, git state, and running the server test suite. I did not read every source file line by line.

## Rating: 8.5 / 10

A well-scoped product with real security engineering. It is the project here that sits closest to something a person could deploy and use.

## What it is

An API testing and reliability studio: a request playground, collections, assertion suites, regression detection between runs, a JSON response diff, scheduled monitors with latency-anomaly detection, history, a dashboard, and an optional AI assistant. Express 5 + TypeScript + MongoDB server, React + TypeScript client. About 6,600 lines and 9 commits.

## What I verified

| Check | Result |
|---|---|
| Server `vitest` (in-memory MongoDB) | 132 passed |
| Client tests | effectively none (one test-related file) |
| Git remote | **none: this project has never been pushed anywhere** |
| Deployment | config files present (`render.yaml`, `client/vercel.json`), not deployed |

## What is good

- **SSRF protection is done properly.** Hostnames are validated inside the socket's DNS lookup, so the address checked is the address connected to and there is no DNS-rebinding window. Private, loopback, link-local, CGNAT and metadata ranges are blocked for IPv4 and IPv6, and every redirect hop is re-validated. Most student API tools omit this entirely.
- Secrets are redacted before they are stored in history or sent to the AI provider.
- Every query is scoped by `userId`, and the JWT lives in an httpOnly cookie.
- The scheduler claims each monitor atomically, so two server instances cannot run the same check twice.
- The known limits are documented accurately.

## What to fix to call it complete

1. **Push it to a remote.** Nine commits exist only on this drive. A disk failure would lose the whole project.
2. **Deploy it.** The Render and Vercel configuration is ready. Note that Render's free tier sleeps, which stops the monitor scheduler; a monitoring product needs an always-on worker.
3. **Client tests.** The diff tree, the assertion builder and the request form have no tests, and there is no end-to-end test of send, save, run suite, and view diff.
4. **Alerting.** Monitors detect downtime and anomalies but notify nobody. Email or webhook alerts are the feature that makes monitoring useful.
5. **Missing features compared with the tools it resembles:** environments and variables (`{{baseUrl}}`), chaining a value from one response into the next request, and import from OpenAPI, Postman or cURL.
6. **Items the README already lists:** rate limits are in memory per process (use Redis), logout does not revoke the JWT, execution history has no TTL index and grows without bound, and the executor has no fallback across resolved addresses.
7. **Naming:** the folder is `TracNest` and the product is `TraceNest`. Use one.
8. Add CI and a LICENSE. Remove the tracked `.gitignore` change or commit it, and ignore `brag-output/`.

## Verdict

The core is complete and well tested on the server side. Push it, deploy it, and add alerts and environment variables, and this is a strong portfolio project.

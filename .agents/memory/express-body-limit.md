---
name: Express global body limit
description: Why photo uploads returned 413 and how it was fixed
---

The global `app.use(express.json())` in `artifacts/api-server/src/app.ts` defaults to 100 kb.
Per-route overrides like `json({ limit: '25mb' })` in the photos router are **never reached** because the global middleware rejects large requests first, before routing.

**Fix applied:** raise the global limit to `'30mb'` so the request reaches the route handler.

**Why:** This is a local LAN API server, not a public endpoint, so a 30 mb global cap is acceptable.
Any future route that needs a stricter limit can still add its own middleware — the global limit is just a ceiling.

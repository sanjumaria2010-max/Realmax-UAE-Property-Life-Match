# Realmax

Life-first UAE property discovery for renting, buying to live, and investing. The live app is branded Realmax with a cinematic dark theme and orange accents; internal Sakan identifiers remain unchanged to preserve API and workspace compatibility.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/sakan run dev` — frontend, served at `/` through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sakan/` — standalone responsive frontend
- `artifacts/mockup-sandbox/src/components/mockups/sakan/` — preserved original canvas design
- `artifacts/api-server/src/routes/sakan.ts` — catalogue, matching, workspace, and enquiry endpoints
- `artifacts/api-server/src/lib/sakan-engine.ts` — illustrative catalogue and server-side eligibility/ranking
- `lib/api-spec/openapi.yaml` — generated API contract source
- `lib/db/src/schema/sakan.ts` — private anonymous workspaces and enquiry records

## Architecture decisions

- The current release intentionally uses labelled sample inventory and synthetic travel estimates; there is no licensed listing feed, routing provider, mortgage service, or agent delivery connection.
- Workspaces are anonymous and browser-scoped, not user accounts. A private HTTP-only cookie grants access; clearing or losing the cookie prevents recovery. Add managed authentication before claiming cross-device access.
- Enquiries are recorded in Sakan, never silently forwarded. User consent covers storage; household destination data is not included.
- The user requested a Netflix-inspired experience: a focused question sequence comes before recommendations. Keep Realmax branding and the original mockup as a historical reference, not a constraint on this new flow.

## Product

All three journeys support editable briefs, sample destination/routine matching, financial planning, ranked property shortlists, area summaries, property details, comparisons, saved homes, and private enquiry history. Workspace state and enquiry records persist in PostgreSQL.

## User preferences

All three audiences are required: renters, live-in homebuyers, and property investors. Household life—not listing browsing—is the core home-seeking concept.

## Gotchas

Regenerate API clients after contract changes. Shared API paths are `/api/sakan/*`. Do not replace illustrative labels with live-market claims without verified source connections.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

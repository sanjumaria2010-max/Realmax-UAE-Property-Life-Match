---
name: API client generation
description: Non-obvious Orval detection behaviour in the pnpm API-spec workspace.
---

Do not assume Orval detects React Query versions from the consuming app. Detection occurs in the generator's package context, which may not declare React Query.

**Why:** Auto-detection selected React Query v4 hooks despite the frontend using v5, producing misleading generated option types.

**How to apply:** Keep generator overrides aligned with the consuming framework version. When upgrading generator tooling, check this deliberately rather than trusting auto-detection. Generated fetch helpers may also require DOM iterable TypeScript definitions even when older generated clients did not.

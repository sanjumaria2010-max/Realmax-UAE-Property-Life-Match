---
name: JSX instrumentation compatibility
description: Replit's development JSX instrumentation can break explicit generic arguments on JSX component tags.
---

Avoid explicit generic type arguments directly in JSX tags in this workspace. Specialize the generic component in a TypeScript variable first, then use that variable as the JSX tag.

**Why:** Development metadata instrumentation inserted attributes before the generic argument, producing invalid JSX even though the original source passed TypeScript checks.

**How to apply:** For typed reusable controls, use an alias such as `const TypedControl = Control<ValueType>` and render `<TypedControl ... />`. Verify the served development page as well as typechecking.

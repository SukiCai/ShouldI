## `packages/`

Shared libraries consumed by one or more **`apps/`** workspaces.

| Package | Responsibility |
|---------|----------------|
| **`contracts`** (**`@shouldi/contracts`**) | Zod schemas and types for API and client boundaries. Build with `npm run build -w @shouldi/contracts` from the repo root. |

Adding a package: create `packages/<name>/` with **`package.json`** `name: "@shouldi/<name>"`, register through root **`workspaces`**: `"packages/*"` (already enabled).

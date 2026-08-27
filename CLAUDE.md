## Project: SnapSplit

This repo is **SnapSplit**. The full specification (roles, flow, data
model, splitting logic, architecture) lives in
[`docs/srs.md`](docs/srs.md). Read it before working on the project to
understand the context and requirements.

## Package Manager

This workspace uses **bun**. Run nx tasks with `bun nx <target>` (e.g. `bun nx build web`,
`bun nx lint web`) and manage dependencies with `bun add` / `bun install`. Do not use pnpm or npm.

## Testing

The API has two test targets:

- `bun nx test api` — unit tests over `apps/api/src`. Cached, no external services.
- `bun nx test:integration api` — integration tests over `apps/api/test`. **Requires a
  reachable Docker socket**: `apps/api/test/setup.ts` boots two testcontainers for the run,
  `mongo:7.0` and MinIO, so the suite exercises the real `S3ObjectStorage` against a real
  S3 API instead of a fake. Without Docker the suite fails while starting the
  containers. Caching is disabled, and the first run pulls both images, so allow up to the
  180s startup budget.

Integration specs get their storage from `testStorage()` in `apps/api/test/setup.ts`, which
points `createReceiptStorage` at MinIO and its per-run bucket. Only the AI extraction
stays faked. Unit specs under `src` keep their own in-memory fakes — that target must stay
cached and free of external services.

`bun nx run-many -t test` and the root `test` script cover only the unit target. Run
`test:integration` explicitly, as CI does via `bun nx affected -t ... test test:integration`.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

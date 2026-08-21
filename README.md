# SnapSplit

Real-time bill splitting for friends. Snap the receipt, let AI parse the
items, and watch your mates claim their tabs live.

## Getting started

### Prerequisites

- **bun** and **Node**, both pinned in `.tool-versions` (`mise install`
  provisions them).
- **Docker**, for the local service stack in `compose.yaml` and for the API
  integration tests.

```sh
bun install
docker compose up -d
cp apps/api/.env.example apps/api/.env
bun dev
```

> [!NOTE]
> Fill in the values that `apps/api/.env.example` lists before running
> `bun dev`.

The web app runs on <http://localhost:4200> and the API on
<http://localhost:3000>.

## Workspace scripts

Run these from the repo root; each one fans out across every project.

| Command         | What it does                                   |
| --------------- | ---------------------------------------------- |
| `bun dev`       | serves the API and the web app in watch mode   |
| `bun preview`   | builds, then runs both apps in production mode |
| `bun build`     | builds every project                           |
| `bun test`      | runs every project's unit tests                |
| `bun typecheck` | type-checks every project                      |
| `bun lint`      | lints every project with Biome                 |
| `bun format`    | formats every project with Biome               |

## Running a single project

Every script above is an Nx target, so you can run it for one project with
`bun nx <target> <project>`. The projects are `api`, `web`, `shared-types`,
`split-logic`, `shadcn-ui` and `shadcn-ui-utils`.

```sh
bun nx serve api           # or: bun dev:api
bun nx serve web           # or: bun dev:web
bun nx test api            # API unit tests only (apps/api/src), cached
bun nx test split-logic    # one library's unit tests
bun nx lint web            # lint a single project
bun nx build api           # build a single project
```

### API integration tests

`bun nx test api` covers `apps/api/src` and stays free of external services.
The suite under `apps/api/test` lives in a separate target:

```sh
bun nx test:integration api
```

It boots two [testcontainers](https://testcontainers.com) for the run
`mongo:7.0` and the `fsouza/fake-gcs-server` emulator — so it needs a reachable
Docker socket; without one it fails while starting the containers rather than
on an assertion. The first run pulls both images, which is why startup allows
180s. Neither `bun test` nor `bun nx run-many -t test` includes this target, so
run it explicitly.

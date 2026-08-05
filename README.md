# SnapSplit

Real-time bill splitting for friends. Snap the receipt, let AI parse the items, and watch your mates claim their tabs live.

## Development

### Prerequisites

- **bun** and **Node**, both pinned in `.tool-versions` (`mise install` provisions them).
- **Docker**, for the local service stack in `compose.yaml` and for the API integration tests.

### Getting started

```sh
bun install
docker compose up -d   # MongoDB, fake-gcs-server, mongo-express
bun dev                # serves the API and the web app
```

The API reads its configuration from the environment; see `apps/api/.env.example` for the
variables it expects.

### Tests

| Command                       | Scope                                   |
| ----------------------------- | --------------------------------------- |
| `bun nx test api`             | API unit tests (`apps/api/src`), cached |
| `bun nx test:integration api` | API integration tests (`apps/api/test`) |
| `bun nx run-many -t test`     | every project's unit tests              |

`test:integration` starts a `mongo:7.0` [testcontainer](https://testcontainers.com), so it
needs a reachable Docker socket — without one it fails while starting the container rather
than on an assertion. The first run pulls the image, which is why startup allows 180s.
`bun nx run-many -t test` does not include it; run the target explicitly.

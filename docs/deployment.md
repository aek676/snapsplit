# Deployment notes

## Web build configuration

The web bundle bakes the API base URL in at build time from `VITE_API_URL`
(see `apps/web/.env.example`). The build fails if it is unset, so deploy
pipelines must provide it.

`VITE_SITE_URL` is baked in the same way, and must be the final public origin:
`apps/web/index.html` interpolates it into the Open Graph and Twitter card
tags, so a wrong value ships share previews pointing at the wrong host.

## Web hosting

The web app deploys to **Cloudflare Workers with static assets**
(`apps/web/wrangler.jsonc`). It declares no `main`, so the Worker serves only
the static bundle — asset requests are free and unmetered on every plan.
`not_found_handling: "single-page-application"` is what makes the client-only
routes (`/s/:code`, `/sessions/:id/review`) survive a hard reload.

`bun nx deploy web` builds and deploys, in CI or locally. It needs
`CLOUDFLARE_API_TOKEN` (an *Edit Cloudflare Workers* token) and
`CLOUDFLARE_ACCOUNT_ID` in the environment, alongside the two `VITE_*` values.
`.github/workflows/cd.yml` runs it from its `deploy` job.

The API rejects the web app until its `CORS_ORIGIN` lists the deployed origin —
`NODE_ENV=production` makes an unset `CORS_ORIGIN` a startup error, and an
origin missing from the list fails at request time instead.

## API hosting

The API runs as a container on a VM. `bun nx publish api` builds the multi-arch
image and pushes it to `ghcr.io/<owner>/<repo>-api`, tagged `sha-<7 chars>` and,
on `main`, `latest`. `bun nx deploy api` then SSHes into the VM and makes it run
that image.

`apps/api/scripts/deploy.sh` deliberately pins the **`sha-` tag, not `latest`**:
it rewrites `API_IMAGE_TAG` in the VM's `.env` before `docker compose pull`, so
a later `docker compose up` on the host brings back the same image rather than
drifting to whatever `latest` points at by then. The tag is the only thing a
deploy touches on the VM — the compose file and every other `.env` value are the
host's, and survive untouched.

The VM needs, once, by hand:

- Docker with the Compose plugin.
- `DEPLOY_PATH` (default `/opt/snapsplit`) holding a `compose.yaml` copied from
  `apps/api/deploy/compose.yaml`, and a `.env` with the runtime configuration
  from `apps/api/.env.example` — at minimum `MONGODB_URI`, `CORS_ORIGIN`,
  `GCS_BUCKET`, `GOOGLE_GENERATIVE_AI_API_KEY`.
- Application Default Credentials for GCS, since `new Storage()` takes no
  explicit credentials — a service account on the VM, or
  `GOOGLE_APPLICATION_CREDENTIALS` pointing at a mounted key.
- `docker login ghcr.io` with a `read:packages` token, if the package is private.

The API's `deploy` target has no `dependsOn: ["publish"]`. It would otherwise
rebuild and re-push the image from whichever runner deploys, dragging Buildx and
a registry login into that job. The ordering belongs to the pipeline instead:
`cd.yml` runs `deploy` with `needs: publish`, so the VM never pulls a tag the
registry has not received yet.

## CI credentials

`.github/workflows/ci.yml` calls `cd.yml` with `secrets: inherit` — a called
workflow receives no repository secrets otherwise, `GITHUB_TOKEN` being the lone
exception. Repository variables need no hand-off.

| Kind | Name | Used by |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | web |
| Secret | `DEPLOY_SSH_KEY` | api — private key with access to the VM |
| Variable | `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_PATH` | api |
| Variable | `DEPLOY_SSH_KNOWN_HOSTS` | api — output of `ssh-keyscan <host>` |
| Variable | `VITE_API_URL`, `VITE_SITE_URL` | web — baked into the public bundle |

The host key is pinned through `DEPLOY_SSH_KNOWN_HOSTS` rather than by relaxing
`StrictHostKeyChecking`: a fresh runner has nothing to trust on first contact,
so it would accept whatever answers. It is therefore required whenever
`DEPLOY_SSH_HOST` is set — leaving it empty fails the SSH setup step outright.
With no `DEPLOY_SSH_HOST` set, that step skips and a web-only deploy still
succeeds.

## Receipt image retention

Sessions expire through the MongoDB TTL index on `createdAt`
(`apps/api/src/schemas/session.ts`, 90 days). TTL deletion happens inside
MongoDB and never notifies the API, so the receipt image a session references
in GCS is **not** deleted with it — only the explicit
`DELETE /sessions/:sessionId` removes the blob eagerly.

To keep orphaned images from accumulating, the bucket named by `GCS_BUCKET`
must carry an Object Lifecycle Management rule that deletes objects at the
same horizon as the TTL index (or slightly beyond it, so no image outlives
its session by much):

```json
{
  "rule": [{ "action": { "type": "Delete" }, "condition": { "age": 90 } }]
}
```

Apply it with:

```sh
gcloud storage buckets update gs://$GCS_BUCKET --lifecycle-file=lifecycle.json
```

Keep the rule's `age` in sync with the TTL index whenever either changes.

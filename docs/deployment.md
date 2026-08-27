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
- `DEPLOY_PATH` (default `/opt/snapsplit`) holding `compose.yaml` and
  `Caddyfile`, both copied from `apps/api/deploy/`, and a `.env` with the
  runtime configuration from `apps/api/.env.example` — at minimum
  `MONGODB_URI`, `CORS_ORIGIN`, the `S3_*` block,
  `GOOGLE_GENERATIVE_AI_API_KEY`, plus `API_DOMAIN` and
  `MONGO_USERNAME`/`MONGO_PASSWORD`, which only the compose file reads.
- `docker login ghcr.io` with a `read:packages` token, if the package is private.
- The first `docker compose up -d`. Deploys after that only recreate `api`, so
  `caddy` and `mongo` come up here and stay up.

`CORS_ORIGIN` is the *web* origin, not the API's own: the Worker URL (or its
custom domain), which is also what `VITE_API_URL` must point back at. Getting
either wrong shows up as the browser blocking every request.

### TLS and DNS

`caddy` terminates TLS for `API_DOMAIN` and proxies to `api:3000` over the
compose network — which is why the `api` service publishes no port. Caddy asks
Let's Encrypt for the certificate over the HTTP-01 challenge, so **80 has to be
reachable as well as 443**, and its `caddy-data` volume keeps the certificate
across recreates.

On Oracle Linux, opening the ports takes two steps, and forgetting the second
is the usual cause of a host that answers nothing:

```sh
# 1. Ingress rules for 80 and 443 in the VCN security list (console).
# 2. The instance's own firewall:
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

DuckDNS resolves every subdomain of a registered name to the same address, so
one record covers `api.<name>.duckdns.org` and anything else the VM serves.
Reserve the instance's public IP (`instance_ocid` in `infra/`) so a stop/start
does not strand that record.

The web app cannot use this domain: a Worker only takes custom domains from
zones in your own Cloudflare account, and `duckdns.org` is not one. It stays on
`workers.dev` until a real domain is added.

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
is **not** deleted with it — only the explicit `DELETE /sessions/:sessionId`
removes the blob eagerly.

The bucket's lifecycle rule is what keeps those orphans from accumulating. It
is `retention_days` in `infra/`, applied by `terraform apply`. Keep it in sync
with the TTL index whenever either changes.

## Infrastructure (Terraform)

`infra/` provisions the receipts bucket with that retention rule, the IAM user
whose key pair the API uses (scoped to this one bucket and nothing else), and
optionally the reserved public IP. The VM itself is deliberately **not** managed
there: it already exists, and a plan that proposed replacing an Always Free
`A1` shape could destroy an instance that capacity limits make hard to get back.

Run it from a laptop — CI has no Oracle credentials, and needs none. Provider
authentication comes from `~/.oci/config` (`oci setup config`).

Bootstrap once, by hand, since Terraform cannot host its own state:

1. An Object Storage bucket for the state (versioning on, so a corrupted state
   can be rolled back).
2. A Customer Secret Key on *your* user — Identity → your user → Customer
   Secret Keys — exported as `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

Then:

```sh
cp infra/backend.hcl.example infra/backend.hcl              # fill in
cp infra/terraform.tfvars.example infra/terraform.tfvars    # fill in
terraform -chdir=infra init -backend-config=backend.hcl
terraform -chdir=infra apply
```

The outputs are the VM's `.env`, verbatim. The secret half of the key pair is
readable only at creation, which is why it comes from the state rather than the
console:

```sh
terraform -chdir=infra output -raw s3_secret_access_key
```

Neither `terraform.tfvars` nor `backend.hcl` nor the state is tracked — the
state holds that secret in clear.

Setting `instance_ocid` reserves the VM's public address, but Oracle will not
convert an ephemeral IP in place: detach it first in the console (the instance's
VNIC → Edit → No public IP). The address you get back is a different one, so
update the DuckDNS record afterwards.

One thing Terraform does not cover: on a pay-as-you-go tenancy the Always Free
limits stop being a hard stop and become a bill. Set a budget with an alert at
Billing & Cost Management → Budgets.

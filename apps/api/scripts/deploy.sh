#!/usr/bin/env sh
set -eu

: "${DEPLOY_SSH_HOST:?expected the VM running the API}"
: "${DEPLOY_SSH_USER:?expected the SSH user on that VM}"

# Deploy the exact commit rather than :latest. The tag is written into the VM's
# .env, so a later `docker compose up` by hand brings back this same image
# instead of silently drifting to whatever :latest points at by then.
sha="${GITHUB_SHA:-$(git rev-parse HEAD)}"
tag="sha-$(printf '%.7s' "$sha")"
dir="${DEPLOY_PATH:-/opt/snapsplit}"

# BatchMode: fail on a missing key instead of hanging on a password prompt,
# which in CI would burn the job's timeout with no useful output.
exec ssh -o BatchMode=yes "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" sh -s -- "$dir" "$tag" <<'REMOTE'
set -eu

cd "$1" || { echo "deploy: $1 does not exist on the host" >&2; exit 1; }
[ -f compose.yaml ] || { echo "deploy: no compose.yaml in $1" >&2; exit 1; }
[ -f .env ] || { echo "deploy: no .env in $1 — the API needs MONGODB_URI, CORS_ORIGIN, GCS_BUCKET…" >&2; exit 1; }

if grep -q '^API_IMAGE_TAG=' .env; then
	sed -i "s|^API_IMAGE_TAG=.*|API_IMAGE_TAG=$2|" .env
else
	printf 'API_IMAGE_TAG=%s\n' "$2" >>.env
fi

docker compose pull api
docker compose up -d api
docker image prune -f
REMOTE

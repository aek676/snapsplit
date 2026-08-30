#!/usr/bin/env sh
set -eu

: "${DEPLOY_SSH_HOST:?expected the VM running the API}"
: "${DEPLOY_SSH_USER:?expected the SSH user on that VM}"

sha="${GITHUB_SHA:-$(git rev-parse HEAD)}"
tag="sha-$(printf '%.7s' "$sha")"

exec ssh -o BatchMode=yes "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" "$tag"

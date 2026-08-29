#!/usr/bin/env sh
# Runs on the VM, next to compose.yaml, and is pinned as the forced command of
# the CI deploy key in ~/.ssh/authorized_keys:
#
#   restrict,command="/opt/apps/snapsplit/deploy-on-host.sh" ssh-ed25519 AAAA… ci@snapsplit
#
# With that in place the key can recreate the API at a tag and nothing else: no
# shell, no forwarding, and whatever CI sends arrives as $SSH_ORIGINAL_COMMAND
# instead of being executed. Copy this file onto the host by hand when it
# changes here, the way compose.yaml is copied — having the deploy ship its own
# script would hand the key back the arbitrary execution the forced command is
# there to remove.
set -eu

# Anything but a short commit tag is a caller doing something unintended; the
# value lands in .env and in a docker pull, so it is checked before it is used.
tag="${SSH_ORIGINAL_COMMAND:-}"
case "$tag" in
	sha-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
	*)
		echo "deploy: expected a sha-xxxxxxx image tag, got '$tag'" >&2
		exit 1
		;;
esac

cd "$(dirname "$0")"
[ -f compose.yaml ] || { echo "deploy: no compose.yaml next to $0" >&2; exit 1; }
[ -f .env ] || { echo "deploy: no .env next to $0 — the API needs MONGODB_URI, CORS_ORIGIN, S3_BUCKET…" >&2; exit 1; }

if grep -q '^API_IMAGE_TAG=' .env; then
	sed -i "s|^API_IMAGE_TAG=.*|API_IMAGE_TAG=$tag|" .env
else
	printf 'API_IMAGE_TAG=%s\n' "$tag" >>.env
fi

docker compose pull api
docker compose up -d api
docker image prune -f

#!/usr/bin/env sh
set -eu

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
